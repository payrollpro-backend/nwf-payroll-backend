// src/services/taxCalculator.js

// ------------------------------------------------------------------
// 1. CONFIGURATION: FEDERAL TAX RATES (2025)
// ------------------------------------------------------------------

const SS_RATE = 0.062;          // 6.2%
const MEDICARE_RATE = 0.0145;   // 1.45%

const FED_STANDARD_DEDUCTION = {
    single: 15000, 
    married: 30000,
    head_of_household: 22500
};

// 2025 Federal Brackets (Annualized)
const FED_BRACKETS = {
    single: [
        { limit: 11925, rate: 0.10 },
        { limit: 48475, rate: 0.12 },
        { limit: 103350, rate: 0.22 },
        { limit: 197300, rate: 0.24 },
        { limit: 250525, rate: 0.32 },
        { limit: 626350, rate: 0.35 },
        { limit: Infinity, rate: 0.37 }
    ],
    married: [
        { limit: 23850, rate: 0.10 },
        { limit: 96950, rate: 0.12 },
        { limit: 206700, rate: 0.22 },
        { limit: 394600, rate: 0.24 },
        { limit: 501050, rate: 0.32 },
        { limit: 751600, rate: 0.35 },
        { limit: Infinity, rate: 0.37 }
    ]
};

// ------------------------------------------------------------------
// 2. CONFIGURATION: STATE TAX RULES (50 STATES)
// ------------------------------------------------------------------

// States with NO Income Tax on Wages
const NO_TAX_STATES = [
    'AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'
];

// States with FLAT Income Tax Rates (2025 Estimates)
const FLAT_TAX_STATES = {
    'AZ': 0.025,   // 2.5%
    'CO': 0.0425,  // 4.25%
    'GA': 0.0539,  // 5.39% (Georgia moved to flat)
    'ID': 0.05695, // ~5.7%
    'IL': 0.0495,  // 4.95%
    'IN': 0.0305,  // 3.05%
    'IA': 0.038,   // 3.8% (Target 2025)
    'KY': 0.04,    // 4.0%
    'MI': 0.0425,  // 4.25%
    'MS': 0.047,   // 4.7%
    'NC': 0.045,   // 4.5%
    'PA': 0.0307,  // 3.07%
    'UT': 0.0455   // 4.55%
};

// Major Progressive States (Explicit 2025 Brackets)
const PROGRESSIVE_STATES = {
    // California (2024/2025 projected)
    'CA': {
        deduction: { single: 5363, married: 10726 },
        brackets: {
            single: [
                { limit: 10412, rate: 0.01 },
                { limit: 24684, rate: 0.02 },
                { limit: 38959, rate: 0.04 },
                { limit: 54081, rate: 0.06 },
                { limit: 68350, rate: 0.08 },
                { limit: 349137, rate: 0.093 },
                { limit: 418961, rate: 0.103 },
                { limit: 698271, rate: 0.113 },
                { limit: Infinity, rate: 0.123 }
            ],
            married: [
                { limit: 20824, rate: 0.01 },
                { limit: 49368, rate: 0.02 },
                { limit: 77918, rate: 0.04 },
                { limit: 108162, rate: 0.06 },
                { limit: 136700, rate: 0.08 },
                { limit: 698274, rate: 0.093 },
                { limit: 837922, rate: 0.103 },
                { limit: 1396542, rate: 0.113 },
                { limit: Infinity, rate: 0.123 }
            ]
        }
    },
    // New York (Simplified 2025)
    'NY': {
        deduction: { single: 8000, married: 16050 },
        brackets: {
            single: [
                { limit: 8500, rate: 0.04 },
                { limit: 11700, rate: 0.045 },
                { limit: 13900, rate: 0.0525 },
                { limit: 80650, rate: 0.055 },
                { limit: 215400, rate: 0.06 },
                { limit: 1077550, rate: 0.0685 },
                { limit: Infinity, rate: 0.0965 }
            ],
            married: [
                { limit: 17150, rate: 0.04 },
                { limit: 23600, rate: 0.045 },
                { limit: 27900, rate: 0.0525 },
                { limit: 161550, rate: 0.055 },
                { limit: 323200, rate: 0.06 },
                { limit: 2155350, rate: 0.0685 },
                { limit: Infinity, rate: 0.0965 }
            ]
        }
    }
};

// Simplified Fallback for Other States (Estimated Effective Rate)
// Used when exact brackets aren't defined above to prevent $0 tax.
const SIMPLIFIED_STATE_RATES = {
    'AL': 0.04, 'AR': 0.049, 'CT': 0.05, 'DE': 0.055, 
    'HI': 0.07, 'KS': 0.05,  'LA': 0.0425, 'MA': 0.05, 
    'MD': 0.0475, 'ME': 0.06, 'MN': 0.06, 'MO': 0.0495, 
    'MT': 0.05, 'ND': 0.02, 'NE': 0.06, 'NJ': 0.05, 
    'NM': 0.049, 'OH': 0.035, 'OK': 0.04, 'OR': 0.08, 
    'RI': 0.04, 'SC': 0.06, 'VA': 0.05, 'VT': 0.06, 
    'WI': 0.05, 'WV': 0.04
};

// ------------------------------------------------------------------
// 3. HELPER FUNCTIONS
// ------------------------------------------------------------------

function safeNumber(val) {
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) return Number(val);
    return 0;
}

function getPayPeriods(frequency) {
    switch(frequency) {
        case 'weekly': return 52;
        case 'biweekly': return 26;
        case 'semimonthly': return 24;
        case 'monthly': return 12;
        default: return 26;
    }
}

// Generic Progressive Tax Calculator
function calculateProgressiveTax(annualIncome, brackets, standardDeduction) {
    const taxable = Math.max(0, annualIncome - standardDeduction);
    let tax = 0;
    let previousLimit = 0;

    for (const bracket of brackets) {
        const incomeInBracket = Math.min(taxable, bracket.limit) - previousLimit;
        if (incomeInBracket > 0) {
            tax += incomeInBracket * bracket.rate;
            previousLimit = bracket.limit;
        } else {
            break;
        }
    }
    return tax;
}

// ------------------------------------------------------------------
// 4. MAIN TAX LOGIC
// ------------------------------------------------------------------

function calculateStateTax(annualGross, stateCode, filingStatus) {
    const code = (stateCode || '').toUpperCase().trim();
    if (!code || NO_TAX_STATES.includes(code)) return 0;

    // A. Check for Flat Tax States
    if (FLAT_TAX_STATES[code]) {
        // Simple Flat Tax: (Income - Basic Exemption Estimate) * Rate
        // Simplified: Applying rate to Gross for safety, or you can add deductions
        return annualGross * FLAT_TAX_STATES[code];
    }

    // B. Check for Detailed Progressive States (CA, NY, GA)
    if (PROGRESSIVE_STATES[code]) {
        const stateRule = PROGRESSIVE_STATES[code];
        const brackets = stateRule.brackets[filingStatus] || stateRule.brackets.single;
        const deduction = stateRule.deduction[filingStatus] || stateRule.deduction.single;
        
        return calculateProgressiveTax(annualGross, brackets, deduction);
    }

    // C. Fallback for remaining states
    if (SIMPLIFIED_STATE_RATES[code]) {
        // Returns a safe estimated withholding based on average rate
        return annualGross * SIMPLIFIED_STATE_RATES[code];
    }

    return 0; // Unknown state
}

exports.computeTaxesForPaycheck = (employee, grossPay) => {
    // 1. Setup Inputs
    const gross = safeNumber(grossPay);
    const frequency = employee.payFrequency || 'biweekly';
    const periods = getPayPeriods(frequency);
    const annualGross = gross * periods;
    
    const fedStatus = (employee.filingStatus || 'single').toLowerCase();
    const stateStatus = (employee.stateFilingStatus || 'single').toLowerCase();

    // 2. Identify State (Handle address object or direct code)
    let stateCode = employee.stateCode;
    if (!stateCode && employee.address && employee.address.state) {
        stateCode = employee.address.state;
    }
    stateCode = (stateCode || 'GA').substring(0, 2).toUpperCase(); // Default to GA if missing

    // 3. Calculate Taxes
    // Federal
    const annualFedTax = calculateProgressiveTax(
        annualGross, 
        FED_BRACKETS[fedStatus] || FED_BRACKETS.single, 
        FED_STANDARD_DEDUCTION[fedStatus] || FED_STANDARD_DEDUCTION.single
    );

    // State (All 50 States Logic)
    const annualStateTax = calculateStateTax(annualGross, stateCode, stateStatus);

    // FICA
    const socialSecurity = gross * SS_RATE;
    const medicare = gross * MEDICARE_RATE;

    // 4. Convert to Pay Period Amounts
    let federalIncomeTax = annualFedTax / periods;
    let stateIncomeTax = annualStateTax / periods;

    // 5. Apply Extra Withholding / Exemptions
    if (employee.extraFederalWithholding) federalIncomeTax += safeNumber(employee.extraFederalWithholding);
    if (employee.extraStateWithholding) stateIncomeTax += safeNumber(employee.extraStateWithholding);
    
    if (employee.exemptFederal) federalIncomeTax = 0;
    if (employee.exemptState) stateIncomeTax = 0;

    // 6. Rounding
    return {
        federalIncomeTax: Math.round(federalIncomeTax * 100) / 100,
        stateIncomeTax: Math.round(stateIncomeTax * 100) / 100,
        socialSecurity: Math.round(socialSecurity * 100) / 100,
        medicare: Math.round(medicare * 100) / 100,
        totalTaxes: Math.round((federalIncomeTax + stateIncomeTax + socialSecurity + medicare) * 100) / 100,
        netPay: Math.round((gross - (federalIncomeTax + stateIncomeTax + socialSecurity + medicare)) * 100) / 100
    };
};
