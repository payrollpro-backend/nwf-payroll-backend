// src/routes/checkout.js

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Employee = require('../models/Employee');
const { requireAuth } = require('../middleware/auth'); 

// Placeholder function to calculate the dynamic price ID based on user status
function determineStripePriceId(isSelfEmployed) {
    // You must create these Price IDs in your Stripe Dashboard first
    return isSelfEmployed ? process.env.STRIPE_PRICE_SOLO : process.env.STRIPE_PRICE_MULTI;
}

router.post('/subscribe', requireAuth(['employer']), async (req, res) => {
    try {
        const userId = req.user.id;
        const { paymentMethodId } = req.body; // Received securely from the frontend

        const employee = await Employee.findById(userId);
        if (!employee) {
            return res.status(404).json({ error: 'Client not found.' });
        }

        const priceId = determineStripePriceId(employee.isSelfEmployed);

        // 1. Create or Update Stripe Customer
        let customer;
        if (employee.stripeCustomerId) {
            // If customer already exists in Stripe, retrieve them
            customer = { id: employee.stripeCustomerId };
        } else {
            // Create a new Customer object in Stripe
            customer = await stripe.customers.create({
                email: employee.email,
                name: `${employee.firstName} ${employee.lastName}`,
                payment_method: paymentMethodId, // Attach the payment method
                invoice_settings: { default_payment_method: paymentMethodId },
            });
        }

        // 2. Create the Subscription
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }], // Use the dynamically determined price
            // Optional: immediately charge the client
            expand: ['latest_invoice.payment_intent'], 
        });

        // 3. Update Internal Database
        employee.stripeCustomerId = customer.id;
        employee.isSubscribed = true;
        employee.subscriptionId = subscription.id;
        await employee.save();

        res.status(200).json({
            success: true,
            message: 'Subscription created successfully.',
            subscriptionStatus: subscription.status,
        });

    } catch (error) {
        console.error('Stripe Subscription Error:', error);
        res.status(500).json({ error: 'Failed to create subscription', details: error.message });
    }
});

module.exports = router;
