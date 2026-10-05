const fs = require('fs');

function verifyUploadSession(io) {
  return (req, res, next) => {
    if (!req.file) return next();

    const socket = io.sockets.sockets.get(req.body.socketId);
    if (!socket || socket.data.uploadToken !== req.body.uploadToken) {
      fs.unlink(req.file.path, () => {});
      return res.status(401).json({ error: 'Your chat session expired. Reconnect and try again.' });
    }

    req.chatSocket = socket;
    return next();
  };
}

function handleUploadError(error, req, res, next) {
  if (!error) return next();
  const tooLarge = error.code === 'LIMIT_FILE_SIZE';
  return res.status(tooLarge ? 413 : 400).json({
    error: tooLarge ? 'Files must be 10 MB or smaller.' : 'The file could not be uploaded.'
  });
}

module.exports = { verifyUploadSession, handleUploadError };
