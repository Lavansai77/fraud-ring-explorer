const express = require("express");
const { runQuery } = require("../db");
const { asyncHandler } = require("./helpers");

const router = express.Router();

// GET /api/applications - list view with a lightweight "shared identifier
// count" so the UI can flag which applications are worth a closer look
// without running the full ring traversal for every row up front.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await runQuery(`
      MATCH (applicant:Applicant)-[:SUBMITTED]->(a:Application)
      OPTIONAL MATCH (a)-[:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT]->(identifier)
      WITH applicant, a, identifier
      OPTIONAL MATCH (identifier)<-[:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT]-(other:Application)
      WHERE other <> a
      RETURN a.id AS id,
             applicant.name AS applicantName,
             a.amount AS amount,
             a.status AS status,
             a.submittedDate AS submittedDate,
             count(DISTINCT other) AS sharedWithCount
      ORDER BY sharedWithCount DESC, a.submittedDate DESC
    `);
    res.json(rows);
  })
);

// GET /api/applications/:id - full detail: applicant, all identifiers used,
// and every OTHER application that shares at least one identifier directly
// (a single hop) - the raw signal before we walk further out in /api/ring.
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [base] = await runQuery(
      `MATCH (applicant:Applicant)-[:SUBMITTED]->(a:Application {id: $id})
       RETURN a.id AS id, applicant.name AS applicantName, applicant.id AS applicantId,
              a.amount AS amount, a.status AS status, a.submittedDate AS submittedDate`,
      { id }
    );

    if (!base) return res.status(404).json({ error: `No application found with id "${id}"` });

    const identifiers = await runQuery(
      `MATCH (a:Application {id: $id})
       OPTIONAL MATCH (a)-[:USES_PHONE]->(phone:Phone)
       OPTIONAL MATCH (a)-[:USES_EMAIL]->(email:Email)
       OPTIONAL MATCH (a)-[:USES_ADDRESS]->(address:Address)
       OPTIONAL MATCH (a)-[:USES_DEVICE]->(device:Device)
       OPTIONAL MATCH (a)-[:USES_BANK_ACCOUNT]->(bank:BankAccount)
       RETURN phone.number AS phone, email.address AS email, address.line AS address,
              device.fingerprint AS device, bank.number AS bankAccount`,
      { id }
    );

    const directMatches = await runQuery(
      `MATCH (a:Application {id: $id})-[rel:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT]->(identifier)
       MATCH (identifier)<-[:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT]-(other:Application)
       WHERE other <> a
       MATCH (otherApplicant:Applicant)-[:SUBMITTED]->(other)
       RETURN DISTINCT other.id AS applicationId, otherApplicant.name AS applicantName,
              type(rel) AS sharedVia, labels(identifier)[0] AS identifierType
       ORDER BY applicantName`,
      { id }
    );

    res.json({ ...base, identifiers: identifiers[0] || {}, directMatches });
  })
);

module.exports = router;
