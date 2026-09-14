const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { db, UPLOADS_DIR } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '');
    const safeExt = ext.length <= 10 ? ext : '';
    cb(null, crypto.randomUUID() + safeExt);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE }
});

// Upload a file into a folder.
router.post('/folders/:id/files', requireAuth, upload.single('file'), function (req, res) {
  const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id);
  if (!folder) return res.status(404).json({ error: 'Folder not found.' });
  if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });

  const category = (req.body && req.body.category) || 'Uncategorized';
  const description = (req.body && req.body.description) || '';

  const result = db.prepare(
    `INSERT INTO files (folder_id, title, category, description, file_name, stored_name, mime_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    folder.id,
    req.file.originalname,
    category,
    description,
    req.file.originalname,
    req.file.filename,
    req.file.mimetype,
    req.file.size
  );

  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ file: file });
});

function streamFile(req, res, disposition) {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found.' });
  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File is missing from storage.' });
  }
  res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
  const safeName = String(file.file_name || 'file').replace(/["\\]/g, '');
  res.setHeader('Content-Disposition', disposition + '; filename="' + safeName + '"');
  fs.createReadStream(filePath).pipe(res);
}

// Inline preview — real URL, real Content-Type, no data: URI. This is what
// makes previewing actually work in every browser (Chrome blocks top-level
// navigation to data: URIs, which is why the old localStorage version failed).
router.get('/files/:id/preview', requireAuth, function (req, res) {
  streamFile(req, res, 'inline');
});

router.get('/files/:id/download', requireAuth, function (req, res) {
  streamFile(req, res, 'attachment');
});

router.delete('/files/:id', requireAuth, function (req, res) {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found.' });
  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  fs.unlink(filePath, function () {});
  db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
  res.json({ ok: true });
});

module.exports = router;
