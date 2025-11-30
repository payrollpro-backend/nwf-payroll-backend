// POST /api/employers/register
// Public endpoint to create a new employer + employer user and log them in
router.post('/register', async (req, res) => {
  try {
    const {
      // Company section
      companyName,
      ein,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zip,

      // Employer user (login) section
      firstName,
      lastName,
      email,
      password,
    } = req.body || {};

    // Basic validation
    if (!companyName || !firstName || !lastName || !email || !password) {
      return res.status(400).json({
        error: 'companyName, firstName, lastName, email and password are required',
      });
    }

    // Prevent duplicate user
    const existingUser = await Employee.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: 'An account already exists with this email',
      });
    }

    // Create Employer record (schema will ignore unknown fields if not defined)
    const employer = await Employer.create({
      companyName,
      ein: ein || '',
      phone: phone || '',
      addressLine1: addressLine1 || '',
      addressLine2: addressLine2 || '',
      city: city || '',
      state: state || '',
      zip: zip || '',
      contactName: `${firstName} ${lastName}`,
      contactEmail: email,
    });

    // Hash password for employer user
    const passwordHash = await bcrypt.hash(password, 10);

    // Create the employer "user" in Employee collection
    const employerUser = await Employee.create({
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'employer',
      employer: employer._id,
      companyName: companyName,
      phone: phone || '',
      address: {
        line1: addressLine1 || '',
        line2: addressLine2 || '',
        city: city || '',
        state: state || '',
        zip: zip || '',
      },
    });

    const token = signToken(employerUser);

    return res.status(201).json({
      token,
      user: {
        id: employerUser._id,
        firstName: employerUser.firstName,
        lastName: employerUser.lastName,
        email: employerUser.email,
        role: employerUser.role,
        employerId: employerUser.employer,
      },
      employer,
    });
  } catch (err) {
    console.error('employer register error:', err);
    res.status(500).json({ error: err.message || 'Employer registration failed' });
  }
});
