const path = require('path');
const { uploadDirectory, previewImageTypes } = require('../config/uploadConfig');

function sanitizeFileName(fileName) {
  const normalizedName = fileName.split(String.fromCharCode(92)).join('/');
  return path.basename(normalizedName)
    .replace(/[\x00-\x1f\x7f"]/g, '_')
    .slice(0, 120) || 'download';
}

function createUploadController(io) {
  function shareFile(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'Choose a file to upload.' });
    }

    const socket = req.chatSocket;
    const fileName = sanitizeFileName(req.file.originalname);
    const extension = path.extname(fileName).toLowerCase();
    const previewType = previewImageTypes.get(extension);
    const fileUrl = `/api/uploads/${req.file.filename}`;
    const previewUrl = previewType === req.file.mimetype
      ? `${fileUrl}?preview=true`
      : null;

    io.to(socket.roomName).emit('file shared', {
      username: socket.username,
      senderId: socket.id,
      fileName,
      fileSize: req.file.size,
      previewUrl,
      downloadUrl: `${fileUrl}?name=${encodeURIComponent(fileName)}`,
      timestamp: new Date().toISOString()
    });

    return res.status(201).json({ success: true });
  }

  function downloadFile(req, res) {
    const storedName = req.params.storedName;
    if (!/^[0-9a-f-]{36}(?:\.[a-z0-9]{1,10})?$/.test(storedName)) {
      return res.sendStatus(404);
    }

    const filePath = path.join(uploadDirectory, storedName);
    const previewType = previewImageTypes.get(path.extname(storedName).toLowerCase());
    res.set('X-Content-Type-Options', 'nosniff');

    if (req.query.preview === 'true' && previewType) {
      res.set('Content-Type', previewType);
      res.set('Content-Disposition', 'inline');
      res.set('Content-Security-Policy', "default-src 'none'; sandbox");
      return res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) res.sendStatus(404);
      });
    }

    return res.download(filePath, sanitizeFileName(String(req.query.name || 'download')), (error) => {
      if (error && !res.headersSent) res.sendStatus(404);
    });
  }

  return { shareFile, downloadFile };
}

module.exports = createUploadController;
