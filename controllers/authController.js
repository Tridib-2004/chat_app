const {
  clearSessionCookie,
  createSessionCookie,
  readCookieValue,
  revokeSession,
  SESSION_COOKIE_NAME,
  validateAccessToken
} = require('../middleware/authMiddleware');

function login(req, res) {
  const accessToken = process.env.CHAT_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(503).json({ error: 'Chat authentication is not configured.' });
  }
  if (!validateAccessToken(req.body && req.body.token, accessToken)) {
    return res.status(401).json({ error: 'Invalid access token.' });
  }

  res.setHeader('Set-Cookie', createSessionCookie(accessToken));
  return res.json({ authenticated: true });
}

function logout(req, res) {
  revokeSession(readCookieValue(req.headers.cookie, SESSION_COOKIE_NAME));
  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.status(204).end();
}

function getSession(req, res) {
  return res.json({ authenticated: true });
}

module.exports = { getSession, login, logout };