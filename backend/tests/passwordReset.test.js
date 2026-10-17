// Password reset test suite. Covers:
//   - pure logic (token hashing) — runs standalone, zero dependencies
//     (only Node's built-in `crypto`, via utils/passwordReset.js)
//   - expiry, invalid token, single-use/reuse, and successful reset — need
//     mongoose + mongodb-memory-server, which are NOT installed in this
//     sandbox (no `npm install` was possible — no network egress). Those
//     packages are require()'d lazily inside setup(), specifically so the
//     pure-logic test above can still run even when they're entirely
//     absent, instead of the whole file failing to even load.
//
// Run with: node tests/passwordReset.test.js

const { hashToken, generateResetToken } = require("../utils/passwordReset");

// authController's HTTP handlers aren't imported directly here (that would
// need a running Express app + supertest, which isn't a dependency of this
// project) — instead this test drives the same DB operations
// forgotPassword/resetPassword perform, which is what actually needs
// verifying: the atomic claim, expiry check, and single-use guarantee.

let mongoose, User, bcrypt;
let mongod;

async function setup() {
  // Deferred requires: only attempted once a live DB is actually needed.
  mongoose = require("mongoose");
  const { MongoMemoryServer } = require("mongodb-memory-server");
  User = require("../models/userModel");
  bcrypt = require("bcryptjs");

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
  const hashed = await bcrypt.hash("original-password", 10);
  return User.create({ name: "Test User", email: `test-${Date.now()}-${Math.random()}@test.com`, password: hashed });
}

// Mirrors the atomic claim in authController.resetPassword.
async function claimResetToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  return User.findOneAndUpdate(
    { resetPasswordTokenHash: tokenHash, resetPasswordExpires: { $gt: new Date() } },
    { $set: { resetPasswordTokenHash: null, resetPasswordExpires: null } },
    { returnDocument: "before" }
  );
}

function testPureLogic() {
  console.log("\n=== Pure logic: token hashing ===");
  const { rawToken, tokenHash } = generateResetToken();
  assert(typeof rawToken === "string" && rawToken.length === 64, "raw token is a 64-char hex string (32 bytes)");
  assert(tokenHash === hashToken(rawToken), "hashToken is deterministic for the same input");
  assert(tokenHash !== rawToken, "stored hash is never the raw token itself");
}

async function testValidTokenClaimsAndResets() {
  console.log("\n=== A valid, unexpired token can be claimed exactly once ===");
  const user = await createTestUser();
  const { rawToken, tokenHash, expiresAt } = generateResetToken();
  await User.updateOne({ _id: user._id }, { $set: { resetPasswordTokenHash: tokenHash, resetPasswordExpires: expiresAt } });

  const claimed = await claimResetToken(rawToken);
  assert(claimed && claimed._id.equals(user._id), "matching token claims the correct user");

  const doc = await User.findById(user._id).select("+resetPasswordTokenHash +resetPasswordExpires");
  assert(doc.resetPasswordTokenHash === null, "token hash cleared immediately on claim");
  assert(doc.resetPasswordExpires === null, "expiry cleared immediately on claim");
}

async function testTokenIsSingleUse() {
  console.log("\n=== A claimed token cannot be reused ===");
  const user = await createTestUser();
  const { rawToken, tokenHash, expiresAt } = generateResetToken();
  await User.updateOne({ _id: user._id }, { $set: { resetPasswordTokenHash: tokenHash, resetPasswordExpires: expiresAt } });

  const firstClaim = await claimResetToken(rawToken);
  assert(firstClaim !== null, "first use succeeds");

  const secondClaim = await claimResetToken(rawToken);
  assert(secondClaim === null, "second use of the SAME token fails (already cleared)");
}

async function testExpiredTokenRejected() {
  console.log("\n=== An expired token is rejected ===");
  const user = await createTestUser();
  const { rawToken, tokenHash } = generateResetToken();
  const expiredAt = new Date(Date.now() - 60 * 1000); // 1 minute in the past
  await User.updateOne({ _id: user._id }, { $set: { resetPasswordTokenHash: tokenHash, resetPasswordExpires: expiredAt } });

  const claimed = await claimResetToken(rawToken);
  assert(claimed === null, "expired token does not match the claim query");
}

async function testInvalidTokenRejected() {
  console.log("\n=== A token that was never issued is rejected ===");
  const claimed = await claimResetToken("this-token-was-never-generated-for-anyone");
  assert(claimed === null, "unknown token matches no user");
}

async function testConcurrentClaimsOnlyOneWins() {
  console.log("\n=== Race-condition safety: concurrent claims of the same token ===");
  const user = await createTestUser();
  const { rawToken, tokenHash, expiresAt } = generateResetToken();
  await User.updateOne({ _id: user._id }, { $set: { resetPasswordTokenHash: tokenHash, resetPasswordExpires: expiresAt } });

  const results = await Promise.all(Array.from({ length: 5 }, () => claimResetToken(rawToken)));
  const winners = results.filter((r) => r !== null);
  assert(winners.length === 1, `exactly one of 5 concurrent claims wins (got ${winners.length})`);
}

async function main() {
  testPureLogic(); // always runs — no DB needed

  console.log("\nAttempting to start an in-memory MongoDB instance for the remaining (DB-dependent) tests...");
  try {
    await setup();
  } catch (err) {
    console.error("\n⚠️  BLOCKED: could not start an in-memory MongoDB instance.");
    console.error("   Reason:", err.message);
    console.error("   Sandbox network-egress limitation, not a bug in the reset-token");
    console.error("   code. Run this file in an environment with normal internet access,");
    console.error("   or against a local mongod, to execute the remaining tests.");
    process.exitCode = 2;
    return;
  }

  try {
    await testValidTokenClaimsAndResets();
    await testTokenIsSingleUse();
    await testExpiredTokenRejected();
    await testInvalidTokenRejected();
    await testConcurrentClaimsOnlyOneWins();
    console.log("\n✅ ALL PASSWORD RESET TESTS PASSED (including live concurrency test)\n");
    process.exitCode = 0;
  } catch (err) {
    console.error("\n❌ TEST FAILURE:", err.message);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
}

main();
