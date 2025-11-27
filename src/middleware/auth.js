// src/routes/auth.js or src/middleware/auth.js
// Temporary lightweight auth middleware so the app can run
// without depending on Employee model or JWT config.

function requireAuth(req, res, next) {
  // For now, we don't enforce JWT on any route that's using this middleware.
  // All your payroll routes are already open and working.
  next();
}

function requireAdmin(req, res, next) {
  // Same here – no admin check enforced yet.
  // Later we can wire this up to a real User/Employer model.
  next();
}

module.exports = { requireAuth, requireAdmin };
