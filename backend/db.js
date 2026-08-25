// db.js
// Central place for the CognoDB (Bolt/openCypher) connection.
// CognoDB is wire-compatible with the official Neo4j drivers, so we use
// the standard `neo4j-driver` package pointed at the bolt+s:// URI CognoDB gives us.

require("dotenv").config();
const neo4j = require("neo4j-driver");

const { COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD } = process.env;

if (!COGNODB_URI || !COGNODB_USER || !COGNODB_PASSWORD) {
  console.error(
    "[db] Missing CognoDB connection details. Copy backend/.env.example to backend/.env " +
      "and fill in COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD from console.cognodb.com."
  );
}

let driver = null;

/**
 * Lazily creates (and reuses) a single driver instance for the process.
 * We don't throw here even if env vars are missing - individual routes
 * check driver health and return a clean 503 instead of crashing the server.
 */
function getDriver() {
  if (driver) return driver;

  if (!COGNODB_URI || !COGNODB_USER || !COGNODB_PASSWORD) {
    return null;
  }

  driver = neo4j.driver(
    COGNODB_URI,
    neo4j.auth.basic(COGNODB_USER, COGNODB_PASSWORD),
    {
      maxConnectionPoolSize: 20,
      connectionAcquisitionTimeout: 10000, // ms
    }
  );

  return driver;
}

/**
 * Runs a single Cypher statement inside a managed session, using
 * parameters (never string concatenation) and always closing the session.
 * Returns plain JS records (array of objects) instead of raw driver records.
 */
async function runQuery(cypher, params = {}) {
  const d = getDriver();
  if (!d) {
    const err = new Error("CognoDB is not configured or unreachable.");
    err.code = "DB_UNAVAILABLE";
    throw err;
  }

  const session = d.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => {
      const obj = {};
      record.keys.forEach((key) => {
        obj[key] = neo4jValueToPlain(record.get(key));
      });
      return obj;
    });
  } finally {
    await session.close();
  }
}

/** Same as runQuery but opens a WRITE session (used only by the seed script). */
async function runWrite(cypher, params = {}) {
  const d = getDriver();
  if (!d) {
    const err = new Error("CognoDB is not configured or unreachable.");
    err.code = "DB_UNAVAILABLE";
    throw err;
  }

  const session = d.session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => {
      const obj = {};
      record.keys.forEach((key) => {
        obj[key] = neo4jValueToPlain(record.get(key));
      });
      return obj;
    });
  } finally {
    await session.close();
  }
}

/** Quick connectivity check used by /api/health. */
async function verifyConnectivity() {
  const d = getDriver();
  if (!d) return false;
  try {
    await d.verifyConnectivity();
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Converts neo4j-driver values (Nodes, Relationships, Integers, etc.)
 * into plain JSON-friendly JS values recursively.
 */
function neo4jValueToPlain(value) {
  if (value === null || value === undefined) return value;

  if (neo4j.isInt(value)) {
    return value.toNumber();
  }

  if (Array.isArray(value)) {
    return value.map(neo4jValueToPlain);
  }

  // Node
  if (value.labels && value.properties) {
    return {
      _labels: value.labels,
      ...mapProps(value.properties),
    };
  }

  // Relationship
  if (value.type && value.properties && value.start !== undefined) {
    return {
      _type: value.type,
      ...mapProps(value.properties),
    };
  }

  // Path
  if (value.segments) {
    return value.segments.map((seg) => ({
      start: neo4jValueToPlain(seg.start),
      relationship: neo4jValueToPlain(seg.relationship),
      end: neo4jValueToPlain(seg.end),
    }));
  }

  if (typeof value === "object") {
    return mapProps(value);
  }

  return value;
}

function mapProps(props) {
  const out = {};
  Object.keys(props).forEach((k) => {
    out[k] = neo4jValueToPlain(props[k]);
  });
  return out;
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

module.exports = { runQuery, runWrite, verifyConnectivity, closeDriver };
