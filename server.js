// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// 🔑 Hardcoded login
const HARD_USERNAME = "!@#$%^&*())(*&^%$#@!@#$%^&*";
const HARD_PASSWORD = "!@#$%^&*())(*&^%$#@!@#$%^&*";

// ================= GLOBAL STATE =================

// Per-sender hourly mail limit
let mailLimits = {};

// Global launcher lock
let launcherLocked = false;

// Session store
const sessionStore = new session.MemoryStore();

// ================= MIDDLEWARE =================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session (1 hour life)
app.use(session({
  secret: 'bulk-mailer-secret',
  resave: false,
  saveUninitialized: true,
  store: sessionStore,
  cookie: {
    maxAge: 60 * 60 * 1000 // 1 hour
  }
}));

// ================= FULL RESET =================

function fullServerReset() {
  console.log("🔁 FULL LAUNCHER RESET");

  launcherLocked = true;
  mailLimits = {};

  sessionStore.clear(() => {
    console.log("🧹 All sessions cleared");
  });

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

// Login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (launcherLocked) {
    return res.json({
      success: false,
      message: "⛔ Launcher reset ho raha hai, thodi der baad login karo"
    });
  }

  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;

    // ⏱️ Full reset after 1 hour
    setTimeout(fullServerReset, 60 * 60 * 1000);

    return res.json({ success: true });
  }

  return res.json({ success: false, message: "❌ Invalid credentials" });
});

// Launcher page
app.get('/launcher', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// ================= LOGOUT =================
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return res.json({
      success: true,
      message: "✅ Logged out successfully"
    });
  });
});

// ================= HELPERS =================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ✅ FIXED: Batch size 2, delay 1500ms — Gmail spam trigger avoid karta hai
async function sendBatch(transporter, mails, batchSize = 2) {
  for (let i = 0; i < mails.length; i += batchSize) {
    await Promise.allSettled(
      mails.slice(i, i + batchSize).map(m => transporter.sendMail(m))
    );
    await delay(1500); // Slower = less spam trigger
  }
}

// ✅ Unique Message-ID generator
function generateMessageId(email) {
  const rand = crypto.randomBytes(8).toString('hex');
  const domain = email.split('@')[1] || 'mail.com';
  return `<${Date.now()}.${rand}@${domain}>`;
}

// ✅ HTML email body banana
function buildHtmlBody(message) {
  const escaped = (message || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:20px 0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:24px 32px;font-size:15px;line-height:1.7;
                       color:#222222;">
              ${escaped}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 20px;">
              <hr style="border:none;border-top:1px solid #eeeeee;margin:0 0 16px;">
              <p style="font-size:12px;color:#999999;margin:0;">
                To unsubscribe, reply with "unsubscribe" in the subject line.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ================= SEND MAIL =================

app.post('/send', requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    if (!email || !password || !recipients) {
      return res.json({
        success: false,
        message: "Email, password and recipients required"
      });
    }

    const now = Date.now();

    // ⏱️ Hourly sender reset
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
      auth: { user: email, pass: password },
      // ✅ Gmail ke liye recommended pool settings
      pool: true,
      maxConnections: 2,
      maxMessages: 10,
      rateDelta: 2000,
      rateLimit: 2,
    });

    const displayName = (senderName && senderName.trim() && senderName !== 'Anonymous')
      ? senderName.trim()
      : email.split('@')[0]; // fallback: email username

    const htmlBody = buildHtmlBody(message);
    const sendDate = new Date().toUTCString();

    const mails = recipientList.map(r => ({
      from: `"${displayName}" <${email}>`,
      to: r,
      subject: subject || "Quick Note",

      // ✅ Inbox-friendly headers
      headers: {
        'Message-ID': generateMessageId(email),
        'Date': sendDate,
        'X-Mailer': 'Nodemailer',
        'X-Priority': '3',
        'List-Unsubscribe': `<mailto:${email}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'Precedence': 'bulk',
        'MIME-Version': '1.0',
      },

      // ✅ Plain text fallback (spam filters dono check karte hain)
      text: message || "",

      // ✅ HTML body — required for inbox delivery
      html: htmlBody,
    }));

    await sendBatch(transporter, mails, 2);

    mailLimits[email].count += recipientList.length;

    return res.json({
      success: true,
      message: `✅ Sent ${recipientList.length} | Used ${mailLimits[email].count}/27`
    });

  } catch (err) {
    console.error("Mail send error:", err);
    return res.json({ success: false, message: err.message });
  }
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚀 Mail Launcher running on port ${PORT}`);
});
