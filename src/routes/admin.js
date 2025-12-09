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
// 1. ROUTE: ONBOARD SOLO/SELF-EMPLOYED CLIENT
// ==============================================================================

router.post('/onboard-solo', async (req, res) => {
    const adminUser = ensureAdmin(req, res);
    if (!adminUser) return;

    try {
        const {
            email, companyName, businessTaxId, bizRoutingNumber, bizAccountNumber, bizBankName,
            firstName, lastName, payeeRate, payeeSSN, filingStatus, persRoutingNumber, persAccountNumber, persBankName,
            bizStreet, bizCity, bizState, bizZip,
            persStreet, persCity, persState, persZip
        } = req.body;
        
        // Final mandatory check on payeeRate (must be a number >= 0 if present)
        const parsedPayRate = parseFloat(payeeRate) || 0; 
        
        // --- VALIDATION ARRAY ---
        const requiredFields = {
            email, companyName, businessTaxId, bizRoutingNumber, bizAccountNumber, 
            firstName, lastName, persRoutingNumber, persAccountNumber,
            bizStreet, bizCity, bizState, bizZip, 
            persStreet, persCity, persState, persZip
        };
        
        let missingFields = [];
        for (const [key, value] of Object.entries(requiredFields)) {
            // Check if the value is falsy OR if it's a string that is empty after trimming whitespace
            if (!value || String(value).trim() === '') {
                missingFields.push(key);
            }
        }
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                error: `Missing required fields for business, payee, or banking details.`,
                details: `Missing fields: ${missingFields.join(', ')}`
            });
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
            email, firstName, lastName, passwordHash, requiresPasswordChange: true,
            role: 'employer', 
            isSelfEmployed: true, 
            status: 'active', 
            
            companyName,
            externalEmployeeId: businessTaxId,
            
            // Payee Address (Personal Address)
            address: { 
                line1: persStreet,
                city: persCity,
                state: persState,
                zip: persZip
            },
            
            // Pay Configuration
            payType: 'salary', 
            salaryAmount: parsedPayRate, 
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


// ==============================================================================
// 2. ROUTE: CREATE EMPLOYER (Multi-Employee Logic)
// ==============================================================================

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
      isSelfEmployed: false, 
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

// ==============================================================================
// 3. ROUTE: GET/PATCH/DELETE EMPLOYERS/STATS
// ==============================================================================

// GET: List Employers (Fixed for Dropdown)
router.get('/employers', async (req, res) => {
  const adminUser = ensureAdmin(req, res);
  if (!adminUser) return;

  try {
    // ✅ This query correctly gets all companies (multi-employee and solo)
    const employers = await Employee.find({ role: 'employer' })
      .select('companyName firstName lastName email isSelfEmployed') // Ensure isSelfEmployed is selected
      .sort({ companyName: 1 });

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
    if (b.isSelfEmployed !== undefined) emp.isSelfEmployed = b.isSelfEmployed; 

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
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
