// routes/paystubs.js
const express = require('express');
const mongoose = require('mongoose');
const puppeteer = require('puppeteer');

const Paystub = require('../models/Paystub');
const Employee = require('../models/Employee');
let PayrollRun;
try {
  PayrollRun = require('../models/PayrollRun');
} catch (e) {
  PayrollRun = null;
}

const { buildPaystubHtml } = require('../utils/paystubTemplate');

const router = express.Router();

// GET /api/paystubs
// Admin: list all paystubs
router.get('/', async (req, res) => {
  try {
    const paystubs = await Paystub.find()
      .populate('employee', 'firstName lastName email externalEmployeeId')
      .sort({ payDate: -1 });

    res.json(paystubs);
  } catch (err) {
    console.error('Error fetching paystubs:', err);
    res.status(500).json({ message: 'Server error fetching paystubs' });
  }
});

// GET /api/paystubs/employee/:employeeId
// Employee: list paystubs by employee
// Accepts either Mongo _id OR externalEmployeeId (like Emp_ID_00000001)
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    const query = {};
    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      query._id = employeeId; // Mongo id
    } else {
      query.externalEmployeeId = employeeId; // human-readable id
    }

    const employee = await Employee.findOne(query);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const stubs = await Paystub.find({ employee: employee._id }).sort({
      payDate: -1,
    });

    res.json(stubs);
  } catch (err) {
    console.error('Error fetching paystubs by employee:', err);
    res
      .status(500)
      .json({ message: 'Server error fetching employee paystubs' });
  }
});

// HTML preview: /api/paystubs/:id/html
router.get('/:id/html', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id).populate(
      'employee',
      'firstName lastName email externalEmployeeId'
    );

    if (!stub) {
      return res.status(404).send('Paystub not found');
    }

    let payrollRunDoc = null;
    if (PayrollRun && stub.payrollRun) {
      payrollRunDoc = await PayrollRun.findById(stub.payrollRun);
    }

    const html = buildPaystubHtml({
      stub,
      employee: stub.employee,
      payrollRun: payrollRunDoc,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error building paystub HTML:', err);
    res.status(500).send('Error building paystub HTML');
  }
});

// PDF download: /api/paystubs/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id).populate(
      'employee',
      'firstName lastName email externalEmployeeId'
    );

    if (!stub) {
      return res.status(404).send('Paystub not found');
    }

    let payrollRunDoc = null;
    if (PayrollRun && stub.payrollRun) {
      payrollRunDoc = await PayrollRun.findById(stub.payrollRun);
    }

    const html = buildPaystubHtml({
      stub,
      employee: stub.employee,
      payrollRun: payrollRunDoc,
    });

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
    });

    await browser.close();

    const employeeId =
      (stub.employee && stub.employee.externalEmployeeId) || 'employee';
    const payDate = stub.payDate
      ? new Date(stub.payDate).toISOString().slice(0, 10)
      : 'date';

    const fileName =
      stub.fileName || `nwf_${employeeId}_${payDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating paystub PDF:', err);
    res.status(500).send('Error generating paystub PDF');
  }
});

// GET /api/paystubs/:id
// Single paystub by its own Paystub _id
router.get('/:id', async (req, res) => {
  try {
    const stub = await Paystub.findById(req.params.id).populate(
      'employee',
      'firstName lastName email externalEmployeeId'
    );

    if (!stub) {
      return res.status(404).json({ message: 'Paystub not found' });
    }

    res.json(stub);
  } catch (err) {
    console.error('Error fetching paystub by id:', err);
    res.status(500).json({ message: 'Server error fetching paystub' });
  }
});

module.exports = router;
