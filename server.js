const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fast-mailer-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// ─── Static files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth Middleware ──────────────────────────────────────────
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/');
}

// ─── Routes ───────────────────────────────────────────────────

// Login page
app.get('/', (req, res) => {
  if (req.session && req.session.loggedIn) return res.redirect('/launcher');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Launcher page (protected)
app.get('/launcher', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// Login API
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USER || 'admin';
  const validPass = process.env.ADMIN_PASS || 'admin123';

  if (username === validUser && password === validPass) {
    req.session.loggedIn = true;
    req.session.username = username;
    return res.json({ success: true, message: 'Login successful' });
  }
  res.json({ success: false, message: '❌ Invalid username or password' });
});

// Logout API
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: '✅ Logged out successfully' });
  });
});

// Send Email API
app.post('/send', requireLogin, async (req, res) => {
  const { senderName, email, password, subject, message, recipients } = req.body;

  if (!email || !password || !recipients) {
    return res.json({ success: false, message: '❌ Email, password and recipients are required' });
  }

  // Parse recipients — comma or newline separated
  const recipientList = recipients
    .split(/[\n,]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  if (recipientList.length === 0) {
    return res.json({ success: false, message: '❌ No valid recipient emails found' });
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: email,
      pass: password
    }
  });

  let successCount = 0;
  let failCount = 0;

  for (const to of recipientList) {
    try {
      await transporter.sendMail({
        from: senderName ? `"${senderName}" <${email}>` : email,
        to,
        subject: subject || '(No Subject)',
        text: message,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      });
      successCount++;
    } catch (err) {
      console.error(`Failed to send to ${to}:`, err.message);
      failCount++;
    }
  }

  if (failCount === 0) {
    res.json({ success: true, message: `✅ All ${successCount} emails sent successfully!` });
  } else if (successCount === 0) {
    res.json({ success: false, message: `❌ All ${failCount} emails failed. Check Gmail & App Password.` });
  } else {
    res.json({ success: true, message: `⚠️ ${successCount} sent, ${failCount} failed` });
  }
});

// ─── Also support /api/send-email route (used in script) ─────
app.post('/api/send-email', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;

  if (!gmailId || !appPassword || !to) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailId, pass: appPassword }
  });

  try {
    await transporter.sendMail({
      from: senderName ? `"${senderName}" <${gmailId}>` : gmailId,
      to,
      subject: subject || '(No Subject)',
      text: messageBody,
      html: `<p>${messageBody.replace(/\n/g, '<br>')}</p>`
    });
    res.json({ success: true });
  } catch (err) {
    console.error(`Send failed to ${to}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Fast Mailer running on port ${PORT}`);
});
