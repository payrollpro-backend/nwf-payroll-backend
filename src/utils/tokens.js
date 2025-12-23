// utils/tokens.js
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

function createResetToken() {
  // raw token sent to user
  const raw = crypto.randomBytes(32).toString("hex");
  // store only hash in DB
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function signJwt(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

module.exports = { createResetToken, signJwt };
