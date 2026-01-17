const express = require('express');
const router = express.Router();
const db = require('../config/database');
const crypto = require('crypto');

// Option 1: Using Resend (RECOMMENDED - install: npm install resend)
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Option 2: Fallback to Nodemailer with better SMTP config
const nodemailer = require('nodemailer');
const USE_RESEND = process.env.RESEND_API_KEY ? true : false;

// Nodemailer transporter (fallback) - Updated configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 2525, // Changed from 587 to 2525 - better for Render
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // Less strict SSL
  },
  connectionTimeout: 15000, // Increased timeout
  greetingTimeout: 15000
});

// Helper function to send email
async function sendEmail(to, subject, message, recipientName = 'Applicant') {
  const emailContent = `Dear ${recipientName},\n\n${message}\n\nBest regards,\nAdmissions Team`;
  const fromEmail = process.env.FROM_EMAIL || 'paynrollsuper@gmail.com';

  if (USE_RESEND) {
    console.log('📧 Using Resend API to send email...');
    try {
      const result = await resend.emails.send({
        from: `Admissions Team <${fromEmail}>`,
        to: to,
        subject: subject || 'Message from Admissions Team',
        text: emailContent,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Dear ${recipientName},</h2>
            <p style="color: #555; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #777; font-size: 14px;">Best regards,<br><strong>Admissions Team</strong></p>
          </div>
        `
      });
      console.log('✅ Resend email sent:', result);
      return result;
    } catch (error) {
      console.error('❌ Resend error:', error);
      throw error;
    }
  } else {
    console.log('📧 Using Nodemailer (SMTP) to send email...');
    try {
      const mailOptions = {
        from: fromEmail,
        to: to,
        subject: subject || 'Message from Admissions Team',
        text: emailContent,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Dear ${recipientName},</h2>
            <p style="color: #555; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #777; font-size: 14px;">Best regards,<br><strong>Admissions Team</strong></p>
          </div>
        `
      };
      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Nodemailer email sent:', result);
      return result;
    } catch (error) {
      console.error('❌ Nodemailer error:', error);
      throw error;
    }
  }
}

// POST /send-email
router.post('/send-email', async (req, res) => {
  console.log("🔴 POST /api/email/send-email hit!");
  console.log("🔴 Body:", req.body);

  const admission_id = req.body.admission_id || req.body.admissionId;
  const { email, subject, note } = req.body;

  if (!note) {
    return res.status(400).json({ success: false, message: 'Note content is required.' });
  }

  let recipientEmail = email;
  let recipientName = 'Applicant';

  try {
    // If admission_id is provided, fetch applicant details
    if (admission_id) {
      console.log(`🔍 Checking if admission_id exists: ${admission_id}`);
      const [rows] = await db.query(
        'SELECT email, firstname, lastname FROM applicants WHERE admission_id = ?',
        [admission_id]
      );

      console.log(`🔍 Applicants query result:`, rows);

      if (rows.length > 0) {
        recipientEmail = rows[0].email;
        recipientName = `${rows[0].firstname} ${rows[0].lastname}`;
        console.log(`✅ Found applicant: ${recipientName} (${recipientEmail})`);
      } else if (!recipientEmail) {
        console.log(`❌ No applicant found for admission_id: ${admission_id}`);
        return res.status(404).json({ success: false, message: 'Applicant not found.' });
      }
    }

    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: 'Recipient email is required.' });
    }

    // Send email using helper function
    const emailResult = await sendEmail(recipientEmail, subject, note, recipientName);
    console.log(`✅ Email sent successfully to ${recipientEmail}`);

    // Save note to database
    if (admission_id) {
      const notification_id = crypto.randomUUID();
      
      console.log(`💾 Attempting to save to database...`);

      try {
        // Verify the admission_id exists in applicants table
        const [checkExists] = await db.query(
          'SELECT admission_id FROM applicants WHERE admission_id = ?',
          [admission_id]
        );

        if (checkExists.length === 0) {
          console.log(`❌ Foreign key constraint issue: admission_id ${admission_id} does not exist in applicants table`);
          return res.json({ 
            success: true, 
            message: 'Email sent successfully, but admission_id does not exist in applicants table.',
            warning: 'Notification not saved due to missing applicant record.'
          });
        }

        console.log(`✅ Verified admission_id exists in applicants table`);

        const [result] = await db.query(
          'INSERT INTO applicant_notifications (notification_id, admission_id, message, notification_type, is_read) VALUES (?, ?, ?, ?, ?)',
          [notification_id, admission_id, note, 'info', 0]
        );
        
        console.log(`✅ Notification saved to database!`);
        console.log('📊 Insert result:', {
          affectedRows: result.affectedRows,
          insertId: result.insertId
        });

      } catch (dbError) {
        console.error('❌ Database insert error:', dbError);
        
        return res.json({ 
          success: true, 
          message: 'Email sent successfully, but failed to save notification to database.',
          dbError: {
            code: dbError.code,
            message: dbError.message
          }
        });
      }
    } else {
      console.log("⚠️ Skipping database save: No admission_id provided in request.");
    }

    res.json({ success: true, message: 'Email sent and notification saved successfully.' });
  } catch (error) {
    console.error('❌ Error sending email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email.', 
      error: error.message,
      tip: USE_RESEND ? 'Check your RESEND_API_KEY' : 'SMTP connection failed - consider using Resend API'
    });
  }
});

// GET /notes/:admission_id - Fetch all sent notes for a specific applicant
router.get('/notes/:admission_id', async (req, res) => {
  const { admission_id } = req.params;

  if (!admission_id) {
    return res.status(400).json({ success: false, message: 'Admission ID is required.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM applicant_notifications WHERE admission_id = ? ORDER BY created_at DESC',
      [admission_id]
    );

    res.json({ success: true, notes: rows });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notes.', error: error.message });
  }
});

// POST /send-verification - Send verification email with OTP
router.post('/send-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Check if email already exists in applicants table
    const [existingApplicants] = await db.query(
      'SELECT email FROM applicants WHERE email = ?',
      [email]
    );

    if (existingApplicants.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'This email is already registered.' 
      });
    }

    // Delete any existing OTPs for this email
    await db.query('DELETE FROM email_verifications WHERE email = ?', [email]);

    // Store OTP in database
    await db.query(
      'INSERT INTO email_verifications (email, otp, expires_at) VALUES (?, ?, ?)',
      [email, otp, expiresAt]
    );

    // Send verification email
    const subject = 'Email Verification - Paynroll Admissions';
    const message = `Your verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, please ignore this email.`;

    await sendEmail(email, subject, message, 'Applicant');

    console.log(`✅ Verification email sent to ${email} with OTP: ${otp}`);

    res.json({ 
      success: true, 
      message: 'Verification code sent to your email.' 
    });
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send verification email.', 
      error: error.message 
    });
  }
});

// POST /verify-otp - Verify the OTP entered by user
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email and OTP are required.' 
    });
  }

  try {
    // Check if OTP exists and is not expired
    const [rows] = await db.query(
      'SELECT * FROM email_verifications WHERE email = ? AND otp = ? AND expires_at > NOW()',
      [email, otp]
    );

    if (rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification code.' 
      });
    }

    // Delete the used OTP
    await db.query('DELETE FROM email_verifications WHERE email = ?', [email]);

    console.log(`✅ Email ${email} verified successfully`);

    res.json({ 
      success: true, 
      message: 'Email verified successfully.' 
    });
  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify OTP.', 
      error: error.message 
    });
  }
});

module.exports = router;
