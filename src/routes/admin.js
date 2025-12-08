// src/routes/admin.js (Inside router.post('/onboard-solo', ...))

// ... existing code ...

        // Destructure ALL required fields for a single array check
        const requiredFields = [
            email, companyName, businessTaxId, bizRoutingNumber, bizAccountNumber, 
            firstName, lastName, payeeRate, persRoutingNumber, persAccountNumber,
            bizStreet, bizCity, bizState, bizZip, 
            persStreet, persCity, persState, persZip
        ];
        
        // Map the fields to their names for the error message
        const fieldNames = [
            'email', 'companyName', 'businessTaxId', 'bizRoutingNumber', 'bizAccountNumber', 
            'firstName', 'lastName', 'payeeRate', 'persRoutingNumber', 'persAccountNumber',
            'bizStreet', 'bizCity', 'bizState', 'bizZip', 
            'persStreet', 'persCity', 'persState', 'persZip'
        ];

        let missingFields = [];
        requiredFields.forEach((field, index) => {
            if (!field || String(field).trim() === '') {
                missingFields.push(fieldNames[index]);
            }
        });

        if (missingFields.length > 0) {
            return res.status(400).json({ 
                error: `Missing required fields: ${missingFields.join(', ')}. Please fill all fields marked with *.`,
                details: missingFields
            });
        }
        
// ... rest of the code ...
