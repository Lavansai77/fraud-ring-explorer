// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const applicationsRouter = require("./routes/applications");
const graphRouter = require("./routes/graph");
const { verifyConnectivity } = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get("/api/health", async (_req, res) => {
  const ok = await verifyConnectivity();
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "database_unreachable", database: ok });
});

app.use("/api/applications", applicationsRouter);
app.use("/api", graphRouter); // /api/ring, /api/suspicious-identifiers

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  if (err.code === "DB_UNAVAILABLE") {
    return res.status(503).json({
      error: "The graph database is currently unreachable. Please try again shortly.",
    });
  }
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`Fraud Ring API listening on http://localhost:${PORT}`);
});
