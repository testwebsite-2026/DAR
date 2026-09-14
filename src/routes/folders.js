const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, UPLOADS_DIR } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { findCluster, findMunicipality } = require('../clustersData');

const router = express.Router();

// List folders for a given cluster + municipality, each with a file count.
router.get('/folders', requireAuth, function (req, res) {
  const { cluster, municipality } = req.query;
  if (!cluster || !municipality) {
    return res.status(400).json({ error: 'cluster and municipality query params are required.' });
  }
  if (!findMunicipality(cluster, municipality)) {
    return res.status(404).json({ error: 'Unknown cluster or municipality.' });
  }
  const folders = db.prepare(
    `SELECT f.*, (SELECT COUNT(*) FROM files WHERE folder_id = f.id) AS file_count
     FROM folders f WHERE cluster_slug = ? AND municipality_slug = ?
     ORDER BY f.created_at DESC`
  ).all(cluster, municipality);
  res.json({ folders });
});

// Create a new folder (title record) under a cluster + municipality.
router.post('/folders', requireAuth, function (req, res) {
  const { clusterSlug, municipalitySlug, titleNumber, sequenceNumber, name, location, totalArea } = req.body || {};
  if (!findMunicipality(clusterSlug, municipalitySlug)) {
    return res.status(404).json({ error: 'Unknown cluster or municipality.' });
  }
  if (!titleNumber || !sequenceNumber || !name || !location || !totalArea) {
    return res.status(400).json({ error: 'All folder fields are required.' });
  }
  const result = db.prepare(
    `INSERT INTO folders (cluster_slug, municipality_slug, title_number, sequence_number, name, location, total_area)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(clusterSlug, municipalitySlug, titleNumber, sequenceNumber, name, location, totalArea);
  const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ folder });
});

// Folder detail + its files.
router.get('/folders/:id', requireAuth, function (req, res) {
  const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id);
  if (!folder) return res.status(404).json({ error: 'Folder not found.' });
  const files = db.prepare('SELECT * FROM files WHERE folder_id = ? ORDER BY created_at DESC').all(folder.id);
  const cluster = findCluster(folder.cluster_slug);
  const municipality = findMunicipality(folder.cluster_slug, folder.municipality_slug);
  res.json({ folder: folder, files: files, cluster: cluster, municipality: municipality });
});

// Delete a folder and every file (disk + DB row) that belongs to it.
router.delete('/folders/:id', requireAuth, function (req, res) {
  const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id);
  if (!folder) return res.status(404).json({ error: 'Folder not found.' });
  const files = db.prepare('SELECT * FROM files WHERE folder_id = ?').all(folder.id);
  files.forEach(function (f) {
    const p = path.join(UPLOADS_DIR, f.stored_name);
    fs.unlink(p, function () {});
  });
  db.prepare('DELETE FROM folders WHERE id = ?').run(folder.id);
  res.json({ ok: true });
});

module.exports = router;
