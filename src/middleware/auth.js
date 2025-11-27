// src/middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Basic authentication middleware.
 * Checks for:
 * - Bearer token
 * - Valid signature
 * - Valid expiration
 * - Attaches user ID + role to req.user
 */
module.exports = function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = header.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Missing token' });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach decoded user info to request
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
