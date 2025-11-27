async function generateExternalEmployeeId() {
  // Simple sequential-ish generator: Emp ID 01001, 01002, ...
  const count = await Employee.countDocuments();
  const num = 10001 + count; // start at 10001 so it looks “real”
  return `Emp ID ${String(num).padStart(5, '0')}`;
}

router.post('/', async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone,
      companyName, hourlyRate,
      address, dateOfBirth, ssnLast4,
      payMethod, directDeposit,
      federalWithholdingRate, stateWithholdingRate,
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'firstName, lastName and email are required.' });
    }

    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already in use.' });

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const externalEmployeeId = await generateExternalEmployeeId();

    const employee = await Employee.create({
      firstName,
      lastName,
      email,
      phone,
      address,
      dateOfBirth,
      ssnLast4,
      payMethod,
      directDeposit,
      companyName: companyName || 'NWF Payroll Client',
      hourlyRate: hourlyRate || 0,
      federalWithholdingRate,
      stateWithholdingRate,
      externalEmployeeId,
      role: 'employee',
      passwordHash,
    });

    // sendWelcomeEmail(...) – keep as you had
    res.status(201).json({ employee, tempPassword });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
