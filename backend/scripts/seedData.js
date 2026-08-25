// seedData.js
// Generates a realistic-shaped loan application data set: mostly independent,
// legitimate-looking applications, plus a handful of deliberately injected
// "fraud rings" - clusters of applications, filed under different applicant
// names, that secretly reuse the same device fingerprint, phone number, bank
// account, or address. That reuse is exactly the signal a fraud analyst
// looks for, and exactly what the graph traversal in this app surfaces.

const firstNames = [
  "Asha", "Ravi", "Meera", "Kabir", "Diya", "Arjun", "Sana", "Vikram",
  "Neha", "Rohan", "Ila", "Devansh", "Priya", "Karan", "Tara", "Yusuf",
  "Anika", "Aditya", "Zara", "Mihir", "Leela", "Farhan", "Nisha", "Omkar",
  "Sameer", "Pooja", "Rahul", "Anjali", "Vivek", "Kavya",
];
const lastNames = [
  "Rao", "Iyer", "Sharma", "Nair", "Menon", "Kapoor", "Gupta", "Reddy",
  "Chatterjee", "Bose", "Verma", "Malhotra", "Joshi", "Pillai", "Desai",
];
const cities = ["Hyderabad", "Bengaluru", "Mumbai", "Pune", "Chennai", "Delhi", "Kolkata"];
const streets = ["MG Road", "Park Lane", "Lake View Rd", "Church St", "Station Rd", "Ring Road", "Hill St"];
const statuses = ["approved", "pending", "rejected"];

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function makeName(rng) {
  return `${pick(rng, firstNames)} ${pick(rng, lastNames)}`;
}

function makePhone(rng) {
  return `+91-9${Math.floor(rng() * 900000000 + 100000000)}`;
}

function makeEmail(rng, name) {
  const handle = name.toLowerCase().replace(/\s+/g, ".");
  const domain = pick(rng, ["gmail.com", "yahoo.com", "outlook.com", "rediffmail.com"]);
  return `${handle}${Math.floor(rng() * 90 + 10)}@${domain}`;
}

function makeAddress(rng) {
  return `${Math.floor(rng() * 300 + 1)} ${pick(rng, streets)}, ${pick(rng, cities)}`;
}

function makeDevice(rng) {
  let hex = "";
  for (let i = 0; i < 16; i++) hex += Math.floor(rng() * 16).toString(16);
  return `dev-${hex}`;
}

function makeBankAccount(rng) {
  let digits = "";
  for (let i = 0; i < 11; i++) digits += Math.floor(rng() * 10);
  return digits;
}

function makeDate(rng) {
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  const year = 2025 + Math.floor(rng() * 2); // 2025-2026
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function makeAmount(rng) {
  return Math.round((5000 + rng() * 45000) / 500) * 500;
}

/**
 * Builds `normalCount` independent applications (unique identifiers all
 * round) plus a set of deliberately injected fraud rings, where several
 * applications under different applicant names reuse the same device,
 * phone, bank account, or address - simulating one bad actor filing
 * multiple applications under fabricated identities.
 */
function generateApplications(normalCount = 35, seed = 7) {
  const rng = mulberry32(seed);
  const applications = [];
  let appCounter = 1;
  let applicantCounter = 1;

  function nextIds() {
    return {
      applicantId: `applicant-${applicantCounter++}`,
      applicationId: `app-${appCounter++}`,
    };
  }

  // --- Normal, independent applications --------------------------------
  for (let i = 0; i < normalCount; i++) {
    const { applicantId, applicationId } = nextIds();
    const name = makeName(rng);
    applications.push({
      applicantId,
      applicantName: name,
      applicationId,
      amount: makeAmount(rng),
      status: pick(rng, statuses),
      submittedDate: makeDate(rng),
      phone: makePhone(rng),
      email: makeEmail(rng, name),
      address: makeAddress(rng),
      device: makeDevice(rng),
      bankAccount: makeBankAccount(rng),
    });
  }

  // --- Injected fraud rings ----------------------------------------------
  // Ring 1: same device + same phone reused across 5 fabricated identities
  // (classic "one operator, many fake applicants" pattern).
  const ring1Device = makeDevice(rng);
  const ring1Phone = makePhone(rng);
  for (let i = 0; i < 5; i++) {
    const { applicantId, applicationId } = nextIds();
    const name = makeName(rng);
    applications.push({
      applicantId,
      applicantName: name,
      applicationId,
      amount: makeAmount(rng),
      status: pick(rng, statuses),
      submittedDate: makeDate(rng),
      phone: ring1Phone,
      email: makeEmail(rng, name),
      address: makeAddress(rng),
      device: ring1Device,
      bankAccount: makeBankAccount(rng),
    });
  }

  // Ring 2: same payout bank account reused ("money mule" pattern) plus
  // a shared address across 4 identities.
  const ring2BankAccount = makeBankAccount(rng);
  const ring2Address = makeAddress(rng);
  for (let i = 0; i < 4; i++) {
    const { applicantId, applicationId } = nextIds();
    const name = makeName(rng);
    applications.push({
      applicantId,
      applicantName: name,
      applicationId,
      amount: makeAmount(rng),
      status: pick(rng, statuses),
      submittedDate: makeDate(rng),
      phone: makePhone(rng),
      email: makeEmail(rng, name),
      address: ring2Address,
      device: makeDevice(rng),
      bankAccount: ring2BankAccount,
    });
  }

  // Ring 3: a longer chain - A and B share a device, B and C share a phone,
  // C and D share a bank account. No single identifier links all four
  // directly, so only a *multi-hop* traversal (not a simple "shared value"
  // lookup) reveals that all four are connected.
  const chainDevice = makeDevice(rng);
  const chainPhone = makePhone(rng);
  const chainBankAccount = makeBankAccount(rng);

  const a = nextIds();
  const b = nextIds();
  const c = nextIds();
  const d = nextIds();
  const nameA = makeName(rng);
  const nameB = makeName(rng);
  const nameC = makeName(rng);
  const nameD = makeName(rng);

  applications.push(
    {
      applicantId: a.applicantId,
      applicantName: nameA,
      applicationId: a.applicationId,
      amount: makeAmount(rng),
      status: pick(rng, statuses),
      submittedDate: makeDate(rng),
      phone: makePhone(rng),
      email: makeEmail(rng, nameA),
      address: makeAddress(rng),
      device: chainDevice, // shared with B
      bankAccount: makeBankAccount(rng),
    },
    {
      applicantId: b.applicantId,
      applicantName: nameB,
      applicationId: b.applicationId,
      amount: makeAmount(rng),
      status: pick(rng, statuses),
      submittedDate: makeDate(rng),
      phone: chainPhone, // shared with C
      email: makeEmail(rng, nameB),
      address: makeAddress(rng),
      device: chainDevice, // shared with A
      bankAccount: makeBankAccount(rng),
    },
    {
      applicantId: c.applicantId,
      applicantName: nameC,
      applicationId: c.applicationId,
      amount: makeAmount(rng),
      status: pick(rng, statuses),
      submittedDate: makeDate(rng),
      phone: chainPhone, // shared with B
      email: makeEmail(rng, nameC),
      address: makeAddress(rng),
      device: makeDevice(rng),
      bankAccount: chainBankAccount, // shared with D
    },
    {
      applicantId: d.applicantId,
      applicantName: nameD,
      applicationId: d.applicationId,
      amount: makeAmount(rng),
      status: pick(rng, statuses),
      submittedDate: makeDate(rng),
      phone: makePhone(rng),
      email: makeEmail(rng, nameD),
      address: makeAddress(rng),
      device: makeDevice(rng),
      bankAccount: chainBankAccount, // shared with C
    }
  );

  return applications;
}

module.exports = { generateApplications };
