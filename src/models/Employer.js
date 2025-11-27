const mongoose = require('mongoose');

const EmployerSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    ein: String,
    companyEmail: String,
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      zip: String,
    },
    documents: [
      {
        filename: String,
        url: String,
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
