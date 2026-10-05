const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDirectory = path.join(__dirname, '..', 'uploads');
const previewImageTypes = new Map([
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp']
]);

fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
      callback(null, `${crypto.randomUUID()}${safeExtension}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = { upload, uploadDirectory, previewImageTypes };
