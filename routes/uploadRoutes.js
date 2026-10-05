const express = require('express');
const { upload } = require('../config/uploadConfig');
const { verifyUploadSession, handleUploadError } = require('../middleware/uploadMiddleware');
const createUploadController = require('../controllers/uploadController');

function createUploadRoutes(io) {
  const router = express.Router();
  const controller = createUploadController(io);

  router.post('/', upload.single('file'), verifyUploadSession(io), controller.shareFile);
  router.get('/:storedName', controller.downloadFile);
  router.use(handleUploadError);

  return router;
}

module.exports = createUploadRoutes;
