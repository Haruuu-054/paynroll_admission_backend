const express = require('express');
const router = express.Router();

// GET /api/notifications
router.get('/', (req, res) => {
  res.json({ message: 'Notifications route is working' });
});

module.exports = router;