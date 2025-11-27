const jwt = require('jsonwebtoken');

/**
 * Basic JWT auth middleware.
 * Looks for "Authorization: Bearer <token>"
 */
function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = header.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role,
      employerId: decoded.employerId || null,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function employerOnly(req, res, next) {
  if (!req.user || (req.user.role !== 'employer' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Employer access required' });
  }
  next();
}

module.exports = { auth, adminOnly, employerOnly };
