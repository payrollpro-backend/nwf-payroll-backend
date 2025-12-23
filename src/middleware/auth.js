// src/middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nwf_dev_secret_change_later';

/**
 * requireAuth(['employer'])  -> only employer role allowed
 * requireAuth(['admin'])     -> only admin
 * requireAuth(['admin', 'employer']) -> either
 */
function requireAuth(allowedRoles = []) {
  return function (req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing auth token' });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);

      // payload is created by signToken in routes/auth.js:
      // { id, role, employer }
      if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: 'Forbidden for this role' });
      }

      req.user = payload;
      next();
    } catch (err) {
      console.error('JWT verify error:', err);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = { requireAuth };
