const crypto = require('crypto');
const { isValidSession, readCookieValue, SESSION_COOKIE_NAME } = require('./authMiddleware');

function initializeSocket(socket, next) {
  const accessToken = process.env.CHAT_ACCESS_TOKEN;
  const session = readCookieValue(socket.handshake.headers.cookie, SESSION_COOKIE_NAME);
  if (!isValidSession(session, accessToken)) {
    return next(new Error('Authentication required'));
  }

  socket.username = 'Anonymous';
  socket.isTyping = false;
  socket.roomName = 'general';
  socket.data.uploadToken = crypto.randomUUID();
  return next();
}

module.exports = initializeSocket;
