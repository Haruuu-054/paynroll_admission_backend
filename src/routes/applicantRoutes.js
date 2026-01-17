const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Resend } = require('resend');
const crypto = require('crypto');

const resend = new Resend('re_46kKjnbb_NoYHdMnnTyYKJipDk5CdrK29');

// Configure Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/documents');
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File Filter (Optional: restrict to images/pdf)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only .png, .jpg, .jpeg and .pdf format allowed!'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// GET /api/applicants
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM applicants');
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

//total applicants count
router.get("/count", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT COUNT(*) AS total FROM applicants"
    );
    res.json({ total_admissions: rows[0].total });
  } catch (error) {
    console.error("Database error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET pending applicants
router.get('/count/pending', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT COUNT(*) AS pending_count FROM applicants WHERE applicant_status = "pending"'
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET accepted applicants
router.get('/count/accepted', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT COUNT (*) AS accepted_count FROM applicants WHERE applicant_status = "accepted"'
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET rejected applicants count
router.get('/count/rejected', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT COUNT(*) AS rejected_count FROM applicants WHERE applicant_status = "rejected"'
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET all accepted applicants list
router.get('/accepted', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM applicants WHERE applicant_status = "accepted"'
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET all rejected applicants list
router.get('/rejected', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM applicants WHERE applicant_status = "rejected"'
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

//order by oldest
router.get('/old', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM `applicants` ORDER BY timestamp ASC'
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

//order by recent
router.get('/new', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM `applicants` ORDER BY timestamp DESC'
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// Get applicant status by email
router.get("/status", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required.",
    });
  }

  const query = "SELECT applicant_status FROM applicants WHERE email = ? LIMIT 1";

  try {
    const [results] = await db.query(query, [email.toLowerCase()]);

    if (results.length === 0) {
      return res.json({
        success: false,
        message: "Applicant not found.",
      });
    }

    res.json({
      success: true,
      status: results[0].applicant_status,
    });
  } catch (err) {
    console.error("Database error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// Applicant details by admission ID
router.get("/:admission_id", async (req, res) => {
  const { admission_id } = req.params;

  if (!admission_id) {
    return res.status(400).json({ error: "Admission ID is required" });
  }

  const query = `
      SELECT 
        firstname, 
        lastname, 
        middlename, 
        suffix, 
        birth_date, 
        age, 
        birth_place, 
        gender, 
        citizenship, 
        civil_status, 
        religion, 
        ethnicity, 
        last_school_attended, 
        strand_taken, 
        school_address, 
        school_type, 
        year_graduated, 
        father_name, 
        father_occupation, 
        mother_name, 
        mother_occupation, 
        timestamp, 
        parent_number, 
        family_income, 
        email, 
        mobile_number, 
        preferred_course, 
        admission_id, 
        alternate_course_1, 
        alternate_course_2, 
        street, 
        barangay, 
        municipality, 
        province, 
        home_address, 
        applicant_status 
      FROM applicants 
      WHERE admission_id = ? 
      LIMIT 1
    `;

  try {
    const [results] = await db.query(query, [admission_id]);

    if (results.length > 0) {
      res.json({
        exists: true,
        applicant: results[0],
      });
    } else {
      res.json({
        exists: false,
        message: "Applicant not found in registration database",
      });
    }
  } catch (err) {
    console.error("Server error in applicant-details:", err.message);
    return res.status(500).json({
      error: "Failed to fetch applicant details",
      details: err.message,
    });
  }
});

router.patch("/status/:admissionId", async (req, res) => {
  console.log("🔴 PATCH /status endpoint hit!");
  console.log("🔴 Params:", req.params);
  console.log("🔴 Body:", req.body);

  const { admissionId } = req.params;
  const { status, note } = req.body;

  const validStatuses = ["accepted", "rejected"];
  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid status provided." });
  }

  try {
    // 1️⃣ Update applicant status
    const [updateResult] = await db.execute(
      `
      UPDATE applicants
      SET applicant_status = ?
      WHERE admission_id = ?
      `,
      [status, admissionId]
    );

    // 2️⃣ Fetch updated row (similar to Supabase .select())
    const [rows] = await db.execute(
      `
      SELECT *
      FROM applicants
      WHERE admission_id = ?
      `,
      [admissionId]
    );

    // Check if applicant exists
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Applicant not found." });
    }

    // 3️⃣ Send Email Notification
    if (rows.length > 0) {
      const applicant = rows[0];
      if (applicant.email) {
        try {
          const { error } = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: applicant.email,
            subject: `Application Status Update: ${status.toUpperCase()}`,
            html: `<p>Dear ${applicant.firstname} ${applicant.lastname},</p>` +
                  `<p>Your application status has been updated to: <strong>${status}</strong>.</p>` +
                  (note ? `<p>Note from Admissions: ${note}</p>` : '') +
                  `<p>Best regards,<br>Admissions Team</p>`
          });

          if (error) throw error;
          console.log(`Email notification sent to ${applicant.email}`);
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
        }

        // 4️⃣ Save Notification to Database
        try {
          const notification_id = crypto.randomUUID();
          const message = `Your application status has been updated to: ${status}.` + (note ? ` Note: ${note}` : '');
          await db.query(
            'INSERT INTO applicant_notifications (notification_id, admission_id, message, notification_type, is_read, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [notification_id, admissionId, message, 'info', 0]
          );
        } catch (notifError) {
          console.error("Failed to save notification:", notifError);
        }
      }
    }

    res.json({
      success: true,
      message: "Applicant status updated successfully.",
      updated: rows,
    });
  } catch (err) {
    console.error("MySQL error:", err);
    res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
});

// Insert new student application
router.post('/insert', async (req, res, next) => {
  try {
    const {
      // Personal Information
      lastname,
      firstname,
      middlename,
      suffix,
      birth_date,
      age,
      birth_place,
      gender,
      citizenship,
      civil_status,
      religion,
      ethnicity,
      // Address Information
      street,
      barangay,
      municipality,
      province,
      home_address,
      mobile_number,
      email,
      // Educational Background
      last_school_attended,
      strand_taken,
      school_type,
      year_graduated,
      school_address,
      // Family Information
      father_name,
      father_occupation,
      mother_name,
      mother_occupation,
      parent_number,
      family_income,
      // Course Preferences
      preferred_course,
      alternate_course_1,
      alternate_course_2
    } = req.body;

    // Validate required fields
    if (!lastname || !firstname || !birth_date || !gender || !mobile_number || !email || !preferred_course) {
      return res.status(400).json({
        success: false,
        message: 'Required fields are missing'
      });
    }

    // Generate a unique admission ID in the application to avoid database race conditions.
    // The database trigger 'trg_generate_admission_id' should be removed.
    const admission_id = `ADM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    const [result] = await db.query(
      `INSERT INTO applicants (
        admission_id, lastname, firstname, middlename, suffix, birth_date, age, birth_place,
        gender, citizenship, civil_status, religion, ethnicity,
        street, barangay, municipality, province, home_address, mobile_number, email,
        last_school_attended, strand_taken, school_type, year_graduated, school_address,
        father_name, father_occupation, mother_name, mother_occupation,
        parent_number, family_income,
        preferred_course, alternate_course_1, alternate_course_2
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        admission_id, lastname, firstname, middlename, suffix, birth_date, age, birth_place,
        gender, citizenship, civil_status, religion, ethnicity,
        street, barangay, municipality, province, home_address, mobile_number, email,
        last_school_attended, strand_taken, school_type, year_graduated, school_address,
        father_name, father_occupation, mother_name, mother_occupation,
        parent_number, family_income,
        preferred_course, alternate_course_1, alternate_course_2
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Student enrollment data inserted successfully',
      admission_id: admission_id
    });

  } catch (error) {
    next(error);
  }
});

// Helper function to handle single file upload and database insertion
const handleSingleUpload = async (req, res, documentType) => {
  try {
    const { admission_id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: `No file uploaded for ${documentType}.` 
      });
    }

    const file = req.file;
    
    // Generate unique upload_id
    const uploadId = `UPL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    await db.query(
      'INSERT INTO applicant_documents (upload_id, admission_id, document_type, file_name, file_path, file_size, mime_type, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        uploadId,
        admission_id,
        documentType,
        file.filename,
        file.path,
        file.size,
        file.mimetype,
        new Date()
      ]
    );
    
    res.status(200).json({
      success: true,
      message: `${documentType} uploaded successfully.`,
      file: {
        upload_id: uploadId,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
      }
    });
  } catch (error) {
    console.error(`Error uploading ${documentType}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error.',
      error: error.message 
    });
  }
};

// Specific upload endpoints - document_type values MUST match database constraint
router.post('/upload/birth-certificate/:admission_id', 
  upload.single('birth_certificate'), 
  (req, res) => handleSingleUpload(req, res, 'birth_certificate')
);

router.post('/upload/diploma/:admission_id', 
  upload.single('diploma'), 
  (req, res) => handleSingleUpload(req, res, 'form137')
);

router.post('/upload/tor/:admission_id', 
  upload.single('tor'), 
  (req, res) => handleSingleUpload(req, res, 'shs_transcript')
);

router.post('/upload/2x2/:admission_id', 
  upload.single('picture_2x2'), 
  (req, res) => handleSingleUpload(req, res, '2x2_picture')
);

//fetch single document by upload_id
router.get('/document/:upload_id', async (req, res) => {
  const uploadId = req.params.upload_id;
  
  const query = `
    SELECT 
      ad.*,
      a.lastname,
      a.firstname,
      a.middlename
    FROM applicant_documents ad
    LEFT JOIN applicants a ON ad.admission_id = a.admission_id
    WHERE ad.upload_id = ?
  `;
  
  try {
    const [results] = await db.query(query, [uploadId]);

    if (results.length === 0) {
      return res.status(404).json({ 
        error: 'Document not found' 
      });
    }
    
    res.json({
      success: true,
      document: results[0]
    });
  } catch (err) {
    console.error('Error fetching document:', err);
    return res.status(500).json({ 
      error: 'Failed to fetch document',
      details: err.message 
    });
  }
});

// Fetch all documents for a specific admission_id
router.get('/documents/admission/:admission_id', async (req, res) => {
  const { admission_id } = req.params;
  
  try {
    const [results] = await db.query(
      'SELECT * FROM applicant_documents WHERE admission_id = ?', 
      [admission_id]
    );
    
    res.json({
      success: true,
      documents: results
    });
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ 
      error: 'Failed to fetch documents',
      details: err.message 
    });
  }
});

// Fetch only the 2x2 picture for a specific admission_id
router.get('/documents/photo/:admission_id', async (req, res) => {
  const { admission_id } = req.params;
  
  try {
    const [results] = await db.query(
      "SELECT * FROM applicant_documents WHERE admission_id = ? AND document_type = '2x2_picture' ORDER BY uploaded_at DESC LIMIT 1", 
      [admission_id]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Photo not found' 
      });
    }
    
    res.json({
      success: true,
      photo: results[0]
    });
  } catch (err) {
    console.error('Error fetching photo:', err);
    res.status(500).json({ 
      error: 'Failed to fetch photo',
      details: err.message 
    });
  }
});

// Fetch only the birth certificate for a specific admission_id
router.get('/documents/birth-certificate/:admission_id', async (req, res) => {
  const { admission_id } = req.params;
  
  try {
    const [results] = await db.query(
      "SELECT * FROM applicant_documents WHERE admission_id = ? AND document_type = 'birth_certificate' ORDER BY uploaded_at DESC LIMIT 1", 
      [admission_id]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Birth certificate not found' 
      });
    }
    
    res.json({
      success: true,
      document: results[0]
    });
  } catch (err) {
    console.error('Error fetching birth certificate:', err);
    res.status(500).json({ 
      error: 'Failed to fetch birth certificate',
      details: err.message 
    });
  }
});

// Fetch only the diploma (form137) for a specific admission_id
router.get('/documents/diploma/:admission_id', async (req, res) => {
  const { admission_id } = req.params;
  
  try {
    const [results] = await db.query(
      "SELECT * FROM applicant_documents WHERE admission_id = ? AND document_type = 'form137' ORDER BY uploaded_at DESC LIMIT 1", 
      [admission_id]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Diploma not found' 
      });
    }
    
    res.json({
      success: true,
      document: results[0]
    });
  } catch (err) {
    console.error('Error fetching diploma:', err);
    res.status(500).json({ 
      error: 'Failed to fetch diploma',
      details: err.message 
    });
  }
});

// Fetch only the TOR (shs_transcript) for a specific admission_id
router.get('/documents/tor/:admission_id', async (req, res) => {
  const { admission_id } = req.params;
  
  try {
    const [results] = await db.query(
      "SELECT * FROM applicant_documents WHERE admission_id = ? AND document_type = 'shs_transcript' ORDER BY uploaded_at DESC LIMIT 1", 
      [admission_id]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'TOR not found' 
      });
    }
    
    res.json({
      success: true,
      document: results[0]
    });
  } catch (err) {
    console.error('Error fetching TOR:', err);
    res.status(500).json({ 
      error: 'Failed to fetch TOR',
      details: err.message 
    });
  }
});

// Helper function to serve file content directly
const serveFileContent = async (req, res, documentType) => {
  const { admission_id } = req.params;
  
  try {
    const [results] = await db.query(
      "SELECT file_path FROM applicant_documents WHERE admission_id = ? AND document_type = ? ORDER BY uploaded_at DESC LIMIT 1", 
      [admission_id, documentType]
    );
    
    if (results.length === 0) {
      return res.status(404).send('Document not found');
    }
    
    const filePath = results[0].file_path;
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send('File not found on server');
    }
  } catch (err) {
    console.error(`Error serving ${documentType}:`, err);
    res.status(500).send('Error serving file');
  }
};

// Serve the actual file content (for <img> tags or direct viewing)
router.get('/documents/view/photo/:admission_id', (req, res) => serveFileContent(req, res, '2x2_picture'));
router.get('/documents/view/birth-certificate/:admission_id', (req, res) => serveFileContent(req, res, 'birth_certificate'));
router.get('/documents/view/diploma/:admission_id', (req, res) => serveFileContent(req, res, 'form137'));
router.get('/documents/view/tor/:admission_id', (req, res) => serveFileContent(req, res, 'shs_transcript'));


module.exports = router;
