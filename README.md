Loan Fraud Ring Explorer:

<add screenshots of the Applications, Ring Tracer, and Suspicious Identifiers views here>

Live demo: <add your deployed URL here> Screen recording: <add your recording link here>

A full-stack application that surfaces hidden loan application fraud rings — clusters of applications, filed under different fabricated identities, that secretly reuse the same phone number, device, address, or bank account — backed by CognoDB, a managed graph database that speaks openCypher over Bolt.

Built for the Wexa AI CognoDB take-home assignment.

Use case

A fraud operator can fabricate cheap things (a name, a fake address) but not expensive ones — a phone number, a device, a payout bank account — so those get reused across several "different" applications. That reuse is invisible looking at one application at a time; it only shows up when you look at applications in relation to each other.

Applications — every application, sorted by how many identifiers it shares with others.
Fraud Ring Tracer — pick one application, walk outward through every shared identifier, and reveal the whole connected cluster — including members that share nothing with the starting application directly, only through a chain (A↔B share a device, B↔C share a phone, C↔D share a bank account: D is invisible to A on paper, but part of the same ring).
Suspicious Identifiers — every phone/email/address/device/bank account reused by 2+ applications, ranked by reuse count.

This mirrors a real production use case: fraud-ring and money-mule detection is one of the most common reasons banks and fintechs adopt a graph database.

Why a graph database?
The strongest signal is often multiple hops away. A ring can be built so no two applications share an identifier directly — the connection exists only as a chain. Finding it is one variable-length traversal: (a)-[:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT*2..8]-(b). In SQL this is a recursive self-join across five join tables with manual cycle detection, and it gets combinatorially worse with every extra hop.
Reuse-detection is naturally polymorphic. Ranking every reused phone, email, address, device, and bank account is one Cypher pattern, since relationship type does the discrimination. In a relational schema each identifier type lives in its own table, so the same question becomes five near-identical GROUP BY ... HAVING count(*) > 1 queries UNION-ed together.
What an analyst actually wants — "show me the whole ring" — is a first-class graph query result (a connected subgraph), not something assembled from several flat result sets after the fact.
Data model
SUBMITTED
USES_PHONE
USES_EMAIL
USES_ADDRESS
USES_DEVICE
USES_BANK_ACCOUNT
Applicant
Application
Phone
Email
Address
Device
BankAccount
Node	Key properties
Applicant	id, name
Application	id, amount, status, submittedDate
Phone	number
Email	address
Address	line
Device	fingerprint
BankAccount	number

Key modeling decision: every identifier node is MERGEd on its value at seed time. So when two applications reuse the same phone number, they both point at the same Phone node — that shared node is the literal graph edge the traversal walks through to connect otherwise-unrelated applications.

Setup & run
1. Create your CognoDB instance
Sign up at console.cognodb.com/signup — no card required.
Create a free c0 instance, pick a region (provisions in under a minute).
Copy the connection URI (bolt+s://<instance-id>.databases.cognodb.cloud) and the generated password for user cognodb. Shown once — save it immediately.
2. Backend
bash
cd backend
npm install
cp .env.example .env
# fill in COGNODB_URI / COGNODB_USER / COGNODB_PASSWORD in .env

npm run seed     # loads 48 applications (35 independent + 3 injected fraud rings)
npm run dev      # API on http://localhost:4000
3. Frontend
bash
cd frontend
npm install
cp .env.example .env   # defaults to http://localhost:4000/api
npm run dev              # app on http://localhost:5173

The seed data has three fraud rings built in — including one chained ring (4 applications, A–D) where no single identifier connects all four, only the multi-hop traversal does. Open Applications, pick one with a "shared" badge, and click Investigate full ring.

The main queries, explained

All queries run via the official neo4j-driver package, always parameterised — no string-concatenated Cypher anywhere.

Fraud ring traversal (GET /api/ring) — the required 2+-hop traversal, and the whole point of the app:

cypher
MATCH (start:Application {id: $applicationId})
MATCH path = (start)-[:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT*2..8]-(other:Application)
WHERE other <> start
WITH other, min(length(path)) AS hopDistance
MATCH (applicant:Applicant)-[:SUBMITTED]->(other)
RETURN other.id AS applicationId, applicant.name AS applicantName, hopDistance
ORDER BY hopDistance ASC

Suspicious identifiers (GET /api/suspicious-identifiers) — the polymorphic query that would be five separate queries unioned together in SQL:

cypher
MATCH (identifier)<-[:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT]-(app:Application)
WITH identifier, collect(DISTINCT app) AS apps
WHERE size(apps) >= 2
RETURN labels(identifier)[0] AS identifierType, size(apps) AS applicationCount
ORDER BY applicationCount DESC

Direct matches on an application (GET /api/applications/:id) — the 1-hop baseline the ring tracer builds on:

cypher
MATCH (a:Application {id: $id})-[rel:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT]->(identifier)
MATCH (identifier)<-[:USES_PHONE|USES_EMAIL|USES_ADDRESS|USES_DEVICE|USES_BANK_ACCOUNT]-(other:Application)
WHERE other <> a
RETURN DISTINCT other.id AS applicationId, type(rel) AS sharedVia
