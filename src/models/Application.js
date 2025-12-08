// src/models/Application.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ApplicationSchema = new Schema({
    role: { type: String, required: true },
    salaryExpectation: { type: String },
    startDate: { type: String },
    
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    
    portfolio: { type: String },
    coverLetter: { type: String },
    referral: { type: String },
    
    status: { 
        type: String, 
        enum: ['New', 'Reviewing', 'Rejected', 'Hired'], 
        default: 'New' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Application', ApplicationSchema);
