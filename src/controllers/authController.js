// controllers/authController.js
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const { sendEmail } = require("../utils/sendEmail");
const { createResetToken, signJwt } = require("../utils/tokens");

const RESET_MIN = Number(process.env.RESET_TOKEN_EXPIRES_MIN || 45);

function sanitizeUser(user) {
  return {
    id: user._id,
    email: user.email,
    role: user.role,
  };
}

/**
 * POST /api/auth/forgot-password
 * body: { email }
 *
 * Security note: Always respond 200 even if user doesn't exist.
 */
exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "Email is required." });

    const user = await User.findOne({ email, isActive: true });

    // Always return success to prevent user enumeration
    if (!user) {
      return res.json({ message: "If that email exists, a reset link has been sent." });
    }

    const { raw, hash } = createResetToken();
    user.resetPasswordTokenHash = hash;
    user.resetPasswordExpiresAt = new Date(Date.now() + RESET_MIN * 60 * 1000);
    await user.save();

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const resetLink = `${appUrl}/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(raw)}`;

    const subject = "Reset your NWF Payroll password";
    const text = `Reset your password: ${resetLink}`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;color:#111;line-height:1.6">
        <h2 style="margin:0 0 10px">Reset your password</h2>
        <p style="margin:0 0 14px">We received a request to reset your password.</p>
        <p style="margin:0 0 18px">
          <a href="${resetLink}" style="display:inline-block;padding:10px 14px;text-decoration:none;border:1px solid #111;color:#111;border-radius:10px">
            Reset Password
          </a>
        </p>
        <p style="margin:0;color:#666;font-size:13px">
          This link expires in ${RESET_MIN} minutes. If you didn’t request this, you can ignore this email.
        </p>
      </div>
    `;

    await sendEmail({ to: user.email, subject, html, text });

    return res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

/**
 * POST /api/auth/reset-password
 * body: { email, token, newPassword }
 */
exports.resetPassword = async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const token = String(req.body.token || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: "email, token, and newPassword are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      email,
      isActive: true,
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link." });
    }

    const saltRounds = 12;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

    // Optional: auto-login after reset
    const jwtToken = signJwt({ sub: String(user._id), role: user.role });

    return res.json({
      message: "Password has been reset.",
      token: jwtToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

/**
 * POST /api/auth/change-password  (auth required)
 * body: { currentPassword, newPassword }
 */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user?.id; // from auth middleware
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (!userId) return res.status(401).json({ message: "Unauthorized." });
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const user = await User.findById(userId);
    if (!user || !user.isActive) return res.status(401).json({ message: "Unauthorized." });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect." });

    const saltRounds = 12;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await user.save();

    return res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("changePassword error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};
