const express = require('express');
const { CLUSTERS, CATEGORIES } = require('../clustersData');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/clusters', requireAuth, function (req, res) {
  res.json({ clusters: CLUSTERS, categories: CATEGORIES });
});

module.exports = router;
