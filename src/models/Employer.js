// src/models/Employer.js

const mongoose = require('mongoose');

const EmployerSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    ein: { type: String },
    companyEmail: { type: String },

    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
    },

    documents: [
      {
        filename: { type: String },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employer', EmployerSchema);
