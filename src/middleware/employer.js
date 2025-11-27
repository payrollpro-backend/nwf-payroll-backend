module.exports = function employerOnly(req, res, next) {
  if (!req.user || (req.user.role !== 'employer' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Employer access required' });
  }
  next();
};
