// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const applicantRoutes = require('./routes/applicantRoutes');
const documentRoutes = require('./routes/documentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const errorHandler = require('./middleware/errorHandler');
const admissionRoutes = require("./routes/admissions");
const emailRoutes = require("./routes/emailRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/applicants', applicantRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use("/api/total", admissionRoutes);
app.use("/api/admissions", admissionRoutes);
app.use("/applicants", applicantRoutes);
app.use("/api/admission", applicantRoutes);
app.use("/api/admission-accepted", applicantRoutes);
app.use("/api/admission-rejected", applicantRoutes);
app.use("/api/oldest", applicantRoutes);
app.use("/api/recent", applicantRoutes);
app.use('/api/applicants', applicantRoutes);
app.use('/applicant', applicantRoutes);
app.use('/api/applicants', applicantRoutes);
app.use("/api/admission", applicantRoutes);
app.use('/api/document/upload/psa', applicantRoutes);
app.use('/api/docs', applicantRoutes);
app.use("/api/email", emailRoutes);


// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    database: 'MySQL',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;