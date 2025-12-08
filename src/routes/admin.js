// src/routes/admin.js
const express = require('express');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Helper: ensure the current user is an ADMIN
function ensureAdmin(req, res) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return req.user;
}

// All /api/admin/* routes require a valid JWT with role=admin
router.use(requireAuth(['admin']));

function generateTempPassword() {
  const rand = Math.random().toString(36).slice(2, 8); 
  return `NwfEmp-${rand}!`;
}

// ==============================================================================
// ✅ FINAL ROUTE: ONBOARD SOLO/SELF-EMPLOYED CLIENT
// ==============================================================================

router.post('/onboard-solo', async (req, res) => {
    const adminUser = ensureAdmin(req, res);
    if (!adminUser) return;

    try {
        // ✅ CORRECT LOCATION: Destructure req.body inside the function
        const {
            email, companyName, businessTaxId, bizRoutingNumber, bizAccountNumber, bizBankName,
            firstName, lastName, payeeRate, payeeSSN, filingStatus, persRoutingNumber, persAccountNumber, persBankName,
            
            // Address Fields
            bizStreet, bizCity, bizState, bizZip,
            persStreet, persCity, persState, persZip
        } = req.body;
        
        // FINAL VALIDATION: Check ALL required fields explicitly
        if (
            !email || !companyName || !businessTaxId || 
            !bizRoutingNumber || !bizAccountNumber || 
            !firstName || !lastName || !payeeRate || 
            !persRoutingNumber || !persAccountNumber ||
            !bizStreet || !bizCity || !bizState || !bizZip ||
            !persStreet || !persCity || !persState || !persZip 
        ) {
            return res.status(400).json({ error: 'Missing required fields for business, payee, or banking details. Please fill all fields marked with *.' });
        }
        
        const existing = await Employee.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        // 1. Generate Temp Password
        const tempPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        
        // 2. Create Combined Employer/Employee Record (Solo Client)
        const newSoloClient = await Employee.create({
            // Core Identity & Auth
            email, firstName, lastName, passwordHash, requiresPasswordChange: true,
            
            // Roles & Status
            role: 'employer', 
            isSelfEmployed: true, 
            status: 'active', 
            
            // Business Info (Employer side)
            companyName,
            externalEmployeeId: businessTaxId,
            
            // Payee Address (Personal Address)
            address: { 
                line1: persStreet,
                city: persCity,
                state: persState,
                zip: persZip
            },
            
            // Pay Configuration (Employee side)
            payType: 'salary', 
            salaryAmount: payeeRate, 
            ssn: payeeSSN,
            filingStatus: filingStatus || 'single',

            // Personal Deposit Account (DEPOSIT TARGET)
            directDeposit: {
                bankName: persBankName,
                routingNumber: persRoutingNumber,
                accountNumber: persAccountNumber,
                accountNumberLast4: persAccountNumber.slice(-4),
                accountType: 'Checking'
            },
            
            // Business Withdrawal Account (FUNDS SOURCE)
            businessWithdrawalAccount: {
                bankName: bizBankName,
                routingNumber: bizRoutingNumber,
                accountNumber: bizAccountNumber,
            }
        });

        // 3. Return temp password and ID to Admin
        res.status(201).json({ 
            success: true, 
            message: "Solo client successfully onboarded.",
            employerId: newSoloClient._id, 
            tempPassword: tempPassword 
        });

    } catch (err) {
        console.error("Solo Onboarding Error:", err);
        res.status(500).json({ error: err.message || 'Failed to complete solo client onboarding.' });
    }
});


// POST: Create Employer (Existing Multi-Employee Logic)
router.post('/employers', async (req, res) => {
  const adminUser = ensureAdmin(req, res);
  if (!adminUser) return;

  try {
    const { firstName, lastName, email, companyName, companyEmail, ein, address, documents, customPassword } = req.body || {};

    const normalizedCompanyName = (companyName || '').trim();
    const loginEmail = (email || companyEmail || '').trim().toLowerCase();

    if (!normalizedCompanyName || !loginEmail) {
      return res.status(400).json({ error: 'companyName and email required' });
    }

    const existing = await Employee.findOne({ email: loginEmail });
    if (existing) return res.status(400).json({ error: 'Account already exists' });

    const plainPassword = customPassword || generateTempPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const uniqueId = 'EMP-' + Date.now() + '-' + Math.floor(Math.random() * 100000);

    const employer = await Employee.create({
      firstName: firstName || normalizedCompanyName,
      lastName: lastName || 'Owner',
      email: loginEmail,
      passwordHash,
      role: 'employer',
      companyName: normalizedCompanyName,
      ein: ein || '',
      address: address || {},
      documents: documents || [],
      externalEmployeeId: uniqueId,
      isSelfEmployed: false, // Ensure multi-employee clients are marked false
    });

    res.status(201).json({
      employer: { id: employer._id, email: employer.email, companyName: employer.companyName },
      tempPassword: plainPassword,
      message: 'Employer created successfully.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: List Employers (Fixed for Dropdown)
router.get('/employers', async (req, res) => {
  const adminUser = ensureAdmin(req, res);
  if (!adminUser) return;

  try {
    const employers = await Employee.find({ role: 'employer' })
      .select('companyName firstName lastName email')
      .sort({ companyName: 1 });

    // FIX: Returns a plain Array so the dropdown works
    res.json(employers); 
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employers' });
  }
});

// GET: Stats
router.get('/stats', async (req, res) => {
    try {
        const empCount = await Employee.countDocuments({ role: 'employee' });
        const companyCount = await Employee.countDocuments({ role: 'employer' });
        res.json({ employees: empCount, companies: companyCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH: Update Employer
router.patch('/employers/:id', async (req, res) => {
  const adminUser = ensureAdmin(req, res);
  if (!adminUser) return;

  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp || emp.role !== 'employer') return res.status(404).json({ error: 'Not found' });

    const b = req.body;
    if (b.companyName) emp.companyName = b.companyName;
    if (b.firstName) emp.firstName = b.firstName;
    if (b.lastName) emp.lastName = b.lastName;
    if (b.email) emp.email = b.email;
    if (b.address) emp.address = { ...emp.address, ...b.address };
    if (b.isSelfEmployed !== undefined) emp.isSelfEmployed = b.isSelfEmployed; // Allow admin to change type

    await emp.save();
    res.json({ message: 'Employer updated', employer: emp });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE: Employer
router.delete('/employers/:id', async (req, res) => {
  const adminUser = ensureAdmin(req, res);
  if (!adminUser) return;

  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'Employer deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
