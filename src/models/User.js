// models/User.js
const mongoose = require("mongoose");

const USER_ROLES = ["employer", "employee", "admin"];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: USER_ROLES, required: true },

    // Password: store hash only
    passwordHash: { type: String, required: true },

    // Reset password flow
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpiresAt: { type: Date, default: null },

    // Optional: account status
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ensure unique email per role OR globally unique:
// Option A (recommended): email unique across ALL users
userSchema.index({ email: 1 }, { unique: true });

// Option B (if you truly need same email across roles): comment above and use:
// userSchema.index({ email: 1, role: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
module.exports.USER_ROLES = USER_ROLES;
