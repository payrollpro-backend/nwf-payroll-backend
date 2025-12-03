// src/routes/admin.js

router.post('/employers', async (req, res) => {
  const adminUser = ensureAdmin(req, res);
  if (!adminUser) return;

  try {
    const {
      firstName,
      lastName,
      email,
      companyName,
      ein,
      address,
      documents,
      customPassword,
    } = req.body || {};

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        error: 'firstName, lastName, and email are required',
      });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'An account already exists with this email' });
    }

    const plainPassword = customPassword || generateTempPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // 1. GENERATE A UNIQUE ID
    // This ensures we never send "" (empty string) to the database
    const uniqueId = 'EMP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const employer = await Employee.create({
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'employer',
      companyName: companyName || '',
      ein: ein || '',
      address: address || {},
      documents: documents || [],
      
      // 2. FORCE THE ID HERE
      externalEmployeeId: uniqueId 
    });

    res.status(201).json({
      employer: {
        id: employer._id,
        firstName: employer.firstName,
        lastName: employer.lastName,
        email: employer.email,
        role: employer.role,
        companyName: employer.companyName,
      },
      tempPassword: plainPassword,
      message: 'Employer created successfully.',
    });
  } catch (err) {
    console.error('POST /api/admin/employers error:', err);
    // 3. LOG THE EXACT ERROR
    res.status(500).json({ error: err.message || 'Failed to create employer' });
  }
});
