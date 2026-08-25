// seed.js
// Loads the Loan Fraud Ring graph into CognoDB.
//
// Run with:  npm run seed   (from backend/, after setting up .env)
//
// Data model:
//   (:Applicant {id, name})
//   (:Application {id, amount, status, submittedDate})
//   (:Phone {number}) (:Email {address}) (:Address {line})
//   (:Device {fingerprint}) (:BankAccount {number})
//
//   (Applicant)-[:SUBMITTED]->(Application)
//   (Application)-[:USES_PHONE]->(Phone)
//   (Application)-[:USES_EMAIL]->(Email)
//   (Application)-[:USES_ADDRESS]->(Address)
//   (Application)-[:USES_DEVICE]->(Device)
//   (Application)-[:USES_BANK_ACCOUNT]->(BankAccount)
//
// Identifier nodes (Phone/Email/Address/Device/BankAccount) are MERGEd on
// their value, so when two applications legitimately or fraudulently reuse
// the same phone/device/etc., they end up pointing at the *same* node -
// which is exactly what makes the ring-detection traversal work.

require("dotenv").config();
const { runWrite, closeDriver } = require("../db");
const { generateApplications } = require("./seedData");

async function main() {
  console.log("Seeding CognoDB with the Loan Fraud Ring graph...\n");

  await runWrite("CREATE CONSTRAINT applicant_id IF NOT EXISTS FOR (n:Applicant) REQUIRE n.id IS UNIQUE");
  await runWrite("CREATE CONSTRAINT application_id IF NOT EXISTS FOR (n:Application) REQUIRE n.id IS UNIQUE");
  await runWrite("CREATE CONSTRAINT phone_number IF NOT EXISTS FOR (n:Phone) REQUIRE n.number IS UNIQUE");
  await runWrite("CREATE CONSTRAINT email_address IF NOT EXISTS FOR (n:Email) REQUIRE n.address IS UNIQUE");
  await runWrite("CREATE CONSTRAINT address_line IF NOT EXISTS FOR (n:Address) REQUIRE n.line IS UNIQUE");
  await runWrite("CREATE CONSTRAINT device_fp IF NOT EXISTS FOR (n:Device) REQUIRE n.fingerprint IS UNIQUE");
  await runWrite("CREATE CONSTRAINT bank_account_number IF NOT EXISTS FOR (n:BankAccount) REQUIRE n.number IS UNIQUE");
  console.log("✓ Constraints ensured");

  const applications = generateApplications(35);

  await runWrite(
    `UNWIND $rows AS row
     MERGE (applicant:Applicant {id: row.applicantId})
     SET applicant.name = row.applicantName
     MERGE (application:Application {id: row.applicationId})
     SET application.amount = row.amount,
         application.status = row.status,
         application.submittedDate = row.submittedDate
     MERGE (applicant)-[:SUBMITTED]->(application)

     MERGE (phone:Phone {number: row.phone})
     MERGE (application)-[:USES_PHONE]->(phone)

     MERGE (email:Email {address: row.email})
     MERGE (application)-[:USES_EMAIL]->(email)

     MERGE (address:Address {line: row.address})
     MERGE (application)-[:USES_ADDRESS]->(address)

     MERGE (device:Device {fingerprint: row.device})
     MERGE (application)-[:USES_DEVICE]->(device)

     MERGE (bank:BankAccount {number: row.bankAccount})
     MERGE (application)-[:USES_BANK_ACCOUNT]->(bank)`,
    { rows: applications }
  );

  console.log(`✓ Loaded ${applications.length} applications (35 independent + 3 injected fraud rings)`);
  console.log("\nSeeding complete.");
}

main()
  .catch((err) => {
    console.error("\nSeeding failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDriver();
  });
