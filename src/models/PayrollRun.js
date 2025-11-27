function calcFica(gross) {
  const socialSecurity = gross * 0.062;   // 6.2%
  const medicare       = gross * 0.0145;  // 1.45%
  return { socialSecurity, medicare };
}

router.post('/run', async (req, res) => {
  try {
    const {
      employeeId,
      periodStart,
      periodEnd,
      hoursWorked,
      hourlyRate,
      notes,
    } = req.body;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const rate = hourlyRate || employee.hourlyRate;
    const grossPay = rate * Number(hoursWorked || 0);

    // FICA
    const { socialSecurity, medicare } = calcFica(grossPay);

    // Income taxes (configurable per employee)
    const fedRate   = employee.federalWithholdingRate || 0.18;
    const stateRate = employee.stateWithholdingRate   || 0.05;

    const federalIncomeTax = grossPay * fedRate;
    const stateIncomeTax   = grossPay * stateRate;

    const totalTaxes =
      federalIncomeTax + stateIncomeTax + socialSecurity + medicare;

    const netPay = grossPay - totalTaxes;

    const payrollRun = await PayrollRun.create({
      employee: employee._id,
      periodStart,
      periodEnd,
      hoursWorked,
      hourlyRate: rate,
      grossPay,
      netPay,
      federalIncomeTax,
      stateIncomeTax,
      socialSecurity,
      medicare,
      totalTaxes,
      notes,
    });

    const payDate  = new Date(periodEnd);
    const iso      = payDate.toISOString().slice(0, 10);
    const fileName = `nwf_${iso}.pdf`;

    const paystub = await Paystub.create({
      employee: employee._id,
      payrollRun: payrollRun._id,
      payDate,
      fileName,
    });

    res.status(201).json({ payrollRun, paystub });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
