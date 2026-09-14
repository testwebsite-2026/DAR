require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');

require('./src/db'); // initializes the SQLite database + default admin

const authRoutes = require('./src/routes/auth');
const clusterRoutes = require('./src/routes/clusters');
const folderRoutes = require('./src/routes/folders');
const fileRoutes = require('./src/routes/files');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Railway sits behind a proxy/load balancer

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cookieSession({
  name: 'ildf_session',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  maxAge: 12 * 60 * 60 * 1000, // 12 hours
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production'
}));

app.use('/api', authRoutes);
app.use('/api', clusterRoutes);
app.use('/api', folderRoutes);
app.use('/api', fileRoutes);

app.use(express.static(path.join(__dirname, 'public')));

// Client-side router fallback: any non-API GET request gets index.html.
app.get(/^(?!\/api).*/, function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handler (e.g. Multer file-too-large errors).
app.use(function (err, req, res, next) {
  console.error(err);
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is larger than the 25MB upload limit.' });
  }
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, function () {
  console.log('ILDF DAR Batangas portal listening on port ' + PORT);
});
