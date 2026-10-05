const express = require('express');
const { getSession, login, logout } = require('../controllers/authController');
const { requireAuthentication } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/session', requireAuthentication, getSession);

module.exports = router;