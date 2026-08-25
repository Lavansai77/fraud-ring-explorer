const express = require("express");
const { runQuery } = require("../db");
const { asyncHandler } = require("./helpers");

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/ring?applicationId=<id>&maxHops=<n>
//
// MULTI-HOP TRAVERSAL (>= 2 hops, required by the assignment): starting from
// one application, walks outward through ANY shared identifier
// (phone/email/address/device/bank account) to find every other application
// transitively connected to it - i.e. the full fraud ring, not just direct
// matches.
//
// This is the core "why graph" query. Two applications can be linked only
// through a *chain*: app A and app B share a device: 2 hops. App B and app C
// share a phone number: another 2 hops. So C is 4 hops from A even though A
// and C share nothing directly - a plain "find matching rows" query (the
// kind of thing SQL does well) would completely miss this connection. Only
// a variable-length graph traversal surfaces it, which is exactly the
// pattern the seed data's "chain ring" (A-B-C-D) is built to demonstrate.
// ---------------------------------------------------------------------------
router.get(
  "/ring",
  asyncHandler(async (req, res) => {
    const { applicationId, maxHops } = req.query;
    if (!applicationId) {
      return res.status(400).json({ error: "'applicationId' query param is required." });
    }
    const hops = Math.min(Math.max(parseInt(maxHops, 10) || 8, 2), 12);

    const [exists] = await runQuery(
      `MATCH (a:Application {id: $applicationId}) RETURN a IS NOT NULL AS exists`,
      { applicationId }
    );
    if (!exists?.exists) {
      return res.status(404).json({ error: `No application found with id "${applicationId}"` });
    }

    const members = await runQuery(
      `MATCH (start:Application {id: $applicationId})
       MATCH path = (start)-[:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT*2..${hops}]-(other:Application)
       WHERE other <> start
       WITH other, min(length(path)) AS hopDistance
       MATCH (applicant:Applicant)-[:SUBMITTED]->(other)
       RETURN other.id AS applicationId, applicant.name AS applicantName,
              other.amount AS amount, other.status AS status, hopDistance
       ORDER BY hopDistance ASC, applicantName ASC`,
      { applicationId }
    );

    // The specific shared-identifier edges connecting ring members, so the
    // UI can explain *why* each one is connected rather than just *that*
    // it is.
    const links = await runQuery(
      `MATCH (start:Application {id: $applicationId})
       MATCH path = (start)-[:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT*2..${hops}]-(other:Application)
       WHERE other <> start
       UNWIND range(0, size(nodes(path)) - 2) AS i
       WITH nodes(path)[i] AS n1, nodes(path)[i+1] AS n2
       WHERE (n1:Application AND NOT n2:Application) OR (n2:Application AND NOT n1:Application)
       WITH CASE WHEN n1:Application THEN n1 ELSE n2 END AS app,
            CASE WHEN n1:Application THEN n2 ELSE n1 END AS identifier
       RETURN DISTINCT app.id AS applicationId, labels(identifier)[0] AS identifierType,
              coalesce(identifier.number, identifier.address, identifier.line, identifier.fingerprint) AS identifierValue`,
      { applicationId }
    );

    res.json({
      applicationId,
      maxHops: hops,
      ringSize: members.length + 1,
      members,
      links,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/suspicious-identifiers
//
// A single, uniform query across FIVE different node types (Phone, Email,
// Address, Device, BankAccount) that finds any identifier reused by 2+
// distinct applications - the raw fan-out signal fraud analysts scan first.
// In a relational schema this is five separate "GROUP BY ... HAVING
// count(*) > 1" queries (one per identifier table) unioned together with
// mismatched column shapes; in Cypher, because relationship type does the
// discrimination, it's one pattern.
// ---------------------------------------------------------------------------
router.get(
  "/suspicious-identifiers",
  asyncHandler(async (_req, res) => {
    const rows = await runQuery(`
      MATCH (identifier)<-[:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT]-(app:Application)
      WITH identifier, collect(DISTINCT app) AS apps
      WHERE size(apps) >= 2
      UNWIND apps AS a
      MATCH (applicant:Applicant)-[:SUBMITTED]->(a)
      WITH identifier, apps, collect(DISTINCT applicant.name) AS applicantNames
      RETURN labels(identifier)[0] AS identifierType,
             coalesce(identifier.number, identifier.address, identifier.line, identifier.fingerprint) AS value,
             size(apps) AS applicationCount,
             applicantNames
      ORDER BY applicationCount DESC, identifierType ASC
      LIMIT 25
    `);
    res.json(rows);
  })
);

module.exports = router;
