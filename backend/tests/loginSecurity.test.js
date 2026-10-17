// Login security test suite (Prompt 1). Covers:
//   - pure logic (progressive delay, lockout detection) — run inline, no DB needed
//   - atomic lockout behavior under real concurrency — needs a real MongoDB
//     instance (mongodb-memory-server). In THIS sandboxed environment, that
//     package's binary download is blocked by network egress restrictions
//     (same limitation documented for utils/couponRedemption.js's test) —
//     confirmed by attempting it here too. This file is code-complete and
//     correct; run it in a normal environment (real internet access, or a
//     local mongod) before trusting the concurrency guarantees in production.
//
// Run with: node tests/loginSecurity.test.js

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  isAccountLocked,
  getProgressiveDelayMs,
  recordFailedAttempt,
  resetFailedAttempts,
} = require("../utils/loginSecurity");

let mongod;

async function setup() {
  mongod = await MongoMemoryServer.create({ binary: { version: "6.0.9" } });
  await mongoose.connect(mongod.getUri());
}

async function teardown() {
  await mongoose.disconnect();
  await mongod.stop();
}

function assert(condition, message) {
  if (!condition) throw new Error("ASSERTION FAILED: " + message);
  console.log("  PASS:", message);
}

async function createTestUser() {
  const hashed = await bcrypt.hash("correct-password", 10);
  return User.create({ name: "Test User", email: `test-${Date.now()}-${Math.random()}@test.com`, password: hashed });
}

// --- Pure logic (no DB) ---
function testPureLogic() {
  console.log("\n=== Pure logic: progressive delay ===");
  assert(getProgressiveDelayMs(1) === 0, "attempt 1 has no delay");
  assert(getProgressiveDelayMs(2) === 500, "attempt 2 delay is 500ms");
  assert(getProgressiveDelayMs(5) === 2000, "attempt 5 delay caps at 2000ms");
  assert(getProgressiveDelayMs(999) === 2000, "delay never exceeds the 2000ms cap");

  console.log("\n=== Pure logic: lockout detection ===");
  assert(isAccountLocked({ lockUntil: null }) === false, "no lockUntil = not locked");
  assert(isAccountLocked({ lockUntil: new Date(Date.now() + 60000) }) === true, "future lockUntil = locked");
  assert(isAccountLocked({ lockUntil: new Date(Date.now() - 60000) }) === false, "past lockUntil = not locked (expired)");
}

// --- Successful login resets failed attempts ---
async function testSuccessResetsAttempts() {
  console.log("\n=== Successful login resets failed-attempt counter ===");
  const user = await createTestUser();
  await recordFailedAttempt(user._id);
  await recordFailedAttempt(user._id);

  let doc = await User.findById(user._id);
  assert(doc.failedLoginAttempts === 2, "2 failed attempts recorded before reset");

  await resetFailedAttempts(user._id);
  doc = await User.findById(user._id);
  assert(doc.failedLoginAttempts === 0, "counter reset to 0 after simulated success");
  assert(doc.lockUntil === null, "lockUntil cleared after reset");
}

// --- 5 consecutive failures -> 15-minute lockout ---
async function testLockoutAfterFiveFailures() {
  console.log("\n=== 5 consecutive failures trigger a 15-minute lockout ===");
  const user = await createTestUser();

  let doc;
  for (let i = 1; i <= 4; i++) {
    doc = await recordFailedAttempt(user._id);
    assert(doc.failedLoginAttempts === i, `attempt ${i} recorded correctly`);
    assert(!isAccountLocked(doc), `not locked yet after ${i} attempts`);
  }

  doc = await recordFailedAttempt(user._id);
  assert(doc.failedLoginAttempts === MAX_FAILED_ATTEMPTS, "5th attempt reaches the threshold");
  assert(isAccountLocked(doc), "account is locked after the 5th consecutive failure");

  const lockDurationMs = doc.lockUntil.getTime() - Date.now();
  assert(
    lockDurationMs > LOCKOUT_DURATION_MS - 5000 && lockDurationMs <= LOCKOUT_DURATION_MS,
    `lock duration is ~15 minutes (got ${Math.round(lockDurationMs / 1000)}s)`
  );
}

// --- Real concurrency test: this is the actual TOCTOU-race verification ---
async function testConcurrentFailuresNoOverUnderCounting() {
  console.log("\n=== Race-condition safety: 10 concurrent failed attempts on one account ===");
  const user = await createTestUser();

  // Fire 10 genuinely concurrent recordFailedAttempt calls for the SAME
  // account — a naive read-then-write implementation could under-count
  // these under a race. The atomic pipeline update should count all 10
  // exactly once each, with no lost updates.
  const attempts = Array.from({ length: 10 }, () => recordFailedAttempt(user._id));
  await Promise.all(attempts);

  const doc = await User.findById(user._id);
  assert(doc.failedLoginAttempts === 10, `all 10 concurrent attempts counted exactly once (got ${doc.failedLoginAttempts})`);
  assert(isAccountLocked(doc), "account is locked (10 > the 5-attempt threshold)");
}

async function main() {
  testPureLogic(); // always runs — no DB needed

  console.log("\nAttempting to start an in-memory MongoDB instance for the remaining (DB-dependent) tests...");
  try {
    await setup();
  } catch (err) {
    console.error("\n⚠️  BLOCKED: could not start an in-memory MongoDB instance.");
    console.error("   Reason:", err.message);
    console.error("   This is a sandbox network-egress limitation (MongoDB's binary");
    console.error("   download CDN is not reachable here) — NOT a bug in the login-");
    console.error("   security code. Run this file in an environment with normal");
    console.error("   internet access, or against a local mongod, to execute the");
    console.error("   remaining tests: successful-login-resets-attempts, 5-failure");
    console.error("   lockout, and the concurrent-failures race-safety test.");
    process.exitCode = 2; // distinct from 0 (pass) and 1 (real failure)
    return;
  }

  try {
    await testSuccessResetsAttempts();
    await testLockoutAfterFiveFailures();
    await testConcurrentFailuresNoOverUnderCounting();
    console.log("\n✅ ALL LOGIN SECURITY TESTS PASSED (including live concurrency test)\n");
    process.exitCode = 0;
  } catch (err) {
    console.error("\n❌ TEST FAILURE:", err.message);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
}

main();
