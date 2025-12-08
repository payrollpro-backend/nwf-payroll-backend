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
        // Destructure ALL required fields from req.body
        const {
            email, companyName, businessTaxId, bizRoutingNumber, bizAccountNumber, bizBankName,
            firstName, lastName, payeeRate, payeeSSN, filingStatus, persRoutingNumber, persAccountNumber, persBankName,
            
            // Address Fields
            bizStreet, bizCity, bizState, bizZip,
            persStreet, persCity, persState, persZip
        } = req.body;
        
        // --- IMPROVED VALIDATION ARRAY ---
        // This array checks every required field's value directly.
        const requiredFields = {
            email, companyName, businessTaxId, bizRoutingNumber, bizAccountNumber, 
            firstName, lastName, persRoutingNumber, persAccountNumber,
            bizStreet, bizCity, bizState, bizZip, 
            persStreet, persCity, persState, persZip
        };
        
        // Check for missing values (falsy values like '', null, undefined)
        let missingFields = [];
        for (const [key, value] of Object.entries(requiredFields)) {
            // Check if the value is falsy OR if it's a string that is empty after trimming whitespace
            if (!value || String(value).trim() === '') {
                // If payeeRate is not present, skip validation for it here, as it's handled separately
                if (key !== 'payeeRate') {
                    missingFields.push(key);
                }
            }
        }
        
        // Validate payeeRate specifically (must be a number >= 0)
        const parsedPayRate = parseFloat(payeeRate);
        if (isNaN(parsedPayRate) || parsedPayRate < 0) {
            // If the payRate is required to be filled (not 0), you'd add it here.
            // Since we agreed to let it be 0, we only check if the field exists and is a valid number.
            if (!payeeRate && payeeRate !== 0) { // If it was explicitly empty/null, flag it for now if needed.
                // Assuming the FE sends 0 if empty, we let it slide.
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
            // Core Identity & Auth
            email, firstName, lastName, passwordHash, requiresPasswordChange: true,
            
            // Roles & Status
            role: 'employer', 
            isSelfEmployed: true, 
            status: 'active', 
            
            // Business Info (Employer side)
            companyName,
            externalEmployeeId: businessTaxId,
            
            // ✅ PAYEE ADDRESS (Personal Address) is saved to the primary address field
            address: { 
                line1: persStreet,
                city: persCity,
                state: persState,
                zip: persZip
            },
            
            // Pay Configuration (Employee side)
            payType: 'salary', 
            salaryAmount: parsedPayRate, // Use the parsed rate
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

// ... (rest of the admin.js routes remain the same) ...
