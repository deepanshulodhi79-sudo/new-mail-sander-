// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 8080;

// 🔑 Hardcoded login
const HARD_USERNAME = "!@#$%^&*())(*&^%$#@!@#$%^&*";
const HARD_PASSWORD = "!@#$%^&*())(*&^%$#@!@#$%^&*";

// ================= GLOBAL STATE =================

let mailLimits = {};
let launcherLocked = false;
const sessionStore = new session.MemoryStore();

// ================= MIDDLEWARE =================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'bulk-mailer-secret',
  resave: false,
  saveUninitialized: true,
  store: sessionStore,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

// ================= FULL RESET =================
function fullServerReset() {
  console.log("🔁 FULL LAUNCHER RESET");
  launcherLocked = true;
  mailLimits = {};
  sessionStore.clear(() => console.log("🧹 All sessions cleared"));
  setTimeout(() => {
    launcherLocked = false;
    console.log("✅ Launcher unlocked for fresh login");
  }, 2000);
}

// ================= AUTH =================
function requireAuth(req, res, next) {
  if (launcherLocked) return res.redirect('/');
  if (req.session.user) return next();
  return res.redirect('/');
}

// ================= ROUTES =================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (launcherLocked) return res.json({ success: false, message: "⛔ Launcher reset ho raha hai, thodi der baad login karo" });
  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;
    setTimeout(fullServerReset, 60 * 60 * 1000);
    return res.json({ success: true });
  }
  return res.json({ success: false, message: "❌ Invalid credentials" });
});

app.get('/launcher', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'launcher.html')));

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: "✅ Logged out successfully" });
  });
});

// ================= HELPERS =================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ✅ Generate a proper RFC-compliant Message-ID
function generateMessageId(senderEmail) {
  const domain = senderEmail.split('@')[1] || os.hostname();
  const unique = crypto.randomBytes(16).toString('hex');
  return `<${unique}@${domain}>`;
}

// ✅ Convert plain text to simple HTML (inline — no external links)
function textToHtml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px 0;line-height:1.6;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:24px 32px;">${paragraphs}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendBatch(transporter, mails, batchSize = 5) {
  for (let i = 0; i < mails.length; i += batchSize) {
    await Promise.allSettled(
      mails.slice(i, i + batchSize).map(m => transporter.sendMail(m))
    );
    await delay(300);
  }
}

// ================= SEND MAIL =================
app.post('/send', requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    if (!email || !password || !recipients) {
      return res.json({ success: false, message: "Email, password and recipients required" });
    }

    const now = Date.now();
    if (!mailLimits[email] || now - mailLimits[email].startTime > 60 * 60 * 1000) {
      mailLimits[email] = { count: 0, startTime: now };
    }

    const recipientList = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(Boolean);

    if (mailLimits[email].count + recipientList.length > 27) {
      return res.json({
        success: false,
        message: `❌ Max 27 mails/hour | Remaining: ${27 - mailLimits[email].count}`
      });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });

    const plainText = message || "";
    const htmlBody  = textToHtml(plainText);
    const fromName  = senderName || 'Anonymous';
    const mailSubject = subject || "Quick Note";
    const sendDate  = new Date().toUTCString();

    const mails = recipientList.map(r => ({
      from: `"${fromName}" <${email}>`,
      to: r,

      // ✅ Inbox-friendly headers
      subject: mailSubject,
      date: sendDate,

      headers: {
        // Unique message ID per mail — avoids dedup filters
        'Message-ID': generateMessageId(email),

        // Signals human-composed mail, not automation
        'X-Mailer': 'Nodemailer',
        'X-Priority': '3',          // Normal priority (1=high flags spam)
        'Importance': 'normal',

        // Unsubscribe header — required by Gmail/Yahoo bulk sender rules 2024
        'List-Unsubscribe': `<mailto:${email}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',

        // MIME content type hint
        'MIME-Version': '1.0',
      },

      // ✅ Both plain text AND HTML — single-part plain text is a spam signal
      text: plainText,
      html: htmlBody,
    }));

    await sendBatch(transporter, mails, 5);
    mailLimits[email].count += recipientList.length;

    return res.json({
      success: true,
      message: `✅ Sent ${recipientList.length} | Used ${mailLimits[email].count}/27`
    });

  } catch (err) {
    return res.json({ success: false, message: err.message });
  }
});

// ================= START =================
app.listen(PORT, () => console.log(`🚀 Mail Launcher running on port ${PORT}`));
