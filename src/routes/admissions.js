const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.get("/total", async(req, res)=>{
    try{
        const [rows] = await db.query(
            "SELECT COUNT(*) AS total FROM applicants"
        );
        res.json({total_admissions: rows[0].total});
    }catch(error){
        res.status(500).json({error: error.message});
    }
});

router.get("/:course", async (req, res) => {
  try {
    const course = req.params.course;

    const courseMap = {
      bscs: "BS-Computer Science",
      bsn: "BS-Nursing",
      beed: "Bachelor of Elementary Education (Generalist)",
      associate: "Associate in Computer Studies",
      ab: "AB-Psychology",
      coe: "BS-Computer Engineering",
      accountancy: "BS-Accountancy",
      tourism: "BS-Tourism Management",
      culinary: "BS-Hospitality Management (Culinary)",
      cruise: "BS-Hospitality Management (Cruise)",
      bsee: "Bachelor of Secondary Education (English)",
      bses: "Bachelor of Secondary Education (Science)",
      bsem: "Bachelor of Secondary Education (Math)",
      bsef: "Bachelor of Secondary Education (Filipino)",
      bsess: "Bachelor of Secondary Education (Social Science)",
      bsahr: "BS-Accountancy (Human Resource)",
      bsafm: "BS-Accountancy (Financial Management)",
      bsam: "BS-Accountancy (Marketing)",
    };

    const preferredCourse = courseMap[course.toLowerCase()] || course;
    
    const [rows] = await db.execute(
      'SELECT * FROM applicants WHERE preferred_course = ?',
      [preferredCourse]
    );

    res.json({ 
      applicants: rows, 
      total: rows.length 
    });

  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});




module.exports = router;