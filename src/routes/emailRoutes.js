const express = require('express');
const router = express.Router();
const sgMail = require('@sendgrid/mail');
const db = require('../config/database');
const crypto = require('crypto');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// POST /send-email
router.post('/send-email', async (req, res) => {
  console.log("🔴 POST /api/email/send-email hit!");
  console.log("🔴 Body:", req.body);

  // Handle both snake_case and camelCase for admission_id to ensure DB save triggers
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

    const msg = {
      to: recipientEmail,
      from: process.env.EMAIL_FROM || 'houtaruyuki@gmail.com', // Ensure this matches your verified SendGrid sender
      subject: subject || 'Message from MSEUF-CI Admission Registrar',
      html: `<p>Dear ${recipientName},</p><p>${note}</p><p>Best regards,<br>MSEUF-CI Registrar</p>`
    };
    await sgMail.send(msg);

    console.log(`✅ Email sent successfully to ${recipientEmail}`);
    console.log(`📧 Email details:`, {
      subject: subject || 'Message from Admissions Team',
      note: note
    });

    // Save note to database
    if (admission_id) {
      const notification_id = crypto.randomUUID();
      
      console.log(`💾 Attempting to save to database...`);
      console.log(`💾 Data to insert:`, {
        notification_id,
        admission_id,
        message: note,
        notification_type: 'info',
        is_read: 0
      });

      try {
        // First, let's verify the admission_id exists in applicants table
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
          insertId: result.insertId,
          warningCount: result.warningCount
        });

        // Verify the insert worked
        const [verify] = await db.query(
          'SELECT * FROM applicant_notifications WHERE notification_id = ?',
          [notification_id]
        );
        console.log(`🔍 Verification query result:`, verify);

      } catch (dbError) {
        console.error('❌ Database insert error:', dbError);
        console.error('❌ Error code:', dbError.code);
        console.error('❌ Error message:', dbError.message);
        console.error('❌ SQL State:', dbError.sqlState);
        console.error('❌ Full error:', dbError);
        
        // Don't fail the whole request if email was sent successfully
        return res.json({ 
          success: true, 
          message: 'Email sent successfully, but failed to save notification to database.',
          dbError: {
            code: dbError.code,
            message: dbError.message,
            sqlState: dbError.sqlState
          }
        });
      }
    } else {
      console.log("⚠️ Skipping database save: No admission_id provided in request.");
    }

    res.json({ success: true, message: 'Email sent and notification saved successfully.' });
  } catch (error) {
    console.error('❌ Error sending email:', error);
    res.status(500).json({ success: false, message: 'Failed to send email.', error: error.message });
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


module.exports = router;
