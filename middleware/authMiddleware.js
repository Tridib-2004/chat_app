const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'commonroom_session';
const SESSION_DURATION_SECONDS = 12 * 60 * 60;
const revokedSessions = new Map();

function readCookieValue(cookieHeader, cookieName) {
  const cookie = String(cookieHeader || '').split(';').find((part) => {
    return part.trim().startsWith(`${cookieName}=`);
  });
  if (!cookie) return '';

  const value = cookie.trim().slice(cookieName.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function validateAccessToken(candidate, accessToken = process.env.CHAT_ACCESS_TOKEN) {
  if (!accessToken || typeof candidate !== 'string' || candidate.length > 1024) return false;
  return safeEqual(candidate, accessToken);
}

function signExpiry(expiry, accessToken) {
  return crypto.createHmac('sha256', accessToken).update(expiry).digest('hex');
}

function isValidSession(session, accessToken = process.env.CHAT_ACCESS_TOKEN) {
  if (!accessToken || typeof session !== 'string') return false;
  for (const [revokedSession, expiry] of revokedSessions) {
    if (expiry <= Date.now()) revokedSessions.delete(revokedSession);
  }
  if (revokedSessions.has(session)) return false;
  const [expiry, signature, ...extra] = session.split('.');
  const expiryTime = Number(expiry);
  if (extra.length || !Number.isSafeInteger(expiryTime) || expiryTime <= Date.now()) return false;
  return safeEqual(signature, signExpiry(expiry, accessToken));
}

function revokeSession(session) {
  if (!isValidSession(session)) return;
  revokedSessions.set(session, Number(session.split('.')[0]));
}

function createSessionCookie(accessToken) {
  const expiry = String(Date.now() + SESSION_DURATION_SECONDS * 1000);
  const session = `${expiry}.${signExpiry(expiry, accessToken)}`;
  const secureAttribute = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(session)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DURATION_SECONDS}${secureAttribute}`;
}

function clearSessionCookie() {
  const secureAttribute = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureAttribute}`;
}

function requireAuthentication(req, res, next) {
  const session = readCookieValue(req.headers.cookie, SESSION_COOKIE_NAME);
  if (!isValidSession(session)) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  return next();
}

module.exports = {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createSessionCookie,
  isValidSession,
  readCookieValue,
  requireAuthentication,
  revokeSession,
  validateAccessToken
};