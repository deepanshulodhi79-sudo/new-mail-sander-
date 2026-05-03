require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
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
  cookie: {
    maxAge: 60 * 60 * 1000
  }
}));

// ================= HELPERS =================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fullServerReset() {
  console.log("🔁 FULL RESET");
  launcherLocked = true;
  mailLimits = {};

  sessionStore.clear(() => {
    console.log("🧹 Sessions cleared");
  });

  setTimeout(() => {
    launcherLocked = false;
    console.log("✅ Unlocked");
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
      message: "⛔ Reset ho raha hai"
    });
  }

  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;

    setTimeout(fullServerReset, 60 * 60 * 1000);

    return res.json({ success: true });
  }

  return res.json({ success: false, message: "❌ Invalid" });
});

// Launcher
app.get('/launcher', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

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

    if (!mailLimits[email] || now - mailLimits[email].startTime > 3600000) {
      mailLimits[email] = { count: 0, startTime: now };
    }

    const recipientList = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(Boolean);

    const MAX_PER_HOUR = 20;

    if (mailLimits[email].count + recipientList.length > MAX_PER_HOUR) {
      return res.json({
        success: false,
        message: `❌ Max ${MAX_PER_HOUR}/hour`
      });
    }

    // ✅ Gmail transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: email,
        pass: password // ⚠️ App password
      },
      pool: true,
      maxConnections: 1
    });

    await transporter.verify();

    for (let i = 0; i < recipientList.length; i++) {
      const to = recipientList[i];

      const name = to.split("@")[0];
      const msgId = `<${Date.now()}.${i}@${os.hostname()}>`;

      const mailOptions = {
        from: `"${senderName || "Your Name"}" <${email}>`,
        to,
        subject: `${subject || "Hello"} ${Math.floor(Math.random()*1000)}`,

        text: `Hi ${name},\n\n${message || "Hello"}`,

        html: `
          <div style="font-family:Arial">
            <p>Hi ${name},</p>
            <p>${(message || "").replace(/\n/g, "<br>")}</p>
            <br>
            <small>Secure message</small>
          </div>
        `,

        headers: {
          "Message-ID": msgId,
          "X-Mailer": "NodeMailer",
          "List-Unsubscribe": `<mailto:${email}>`
        }
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log("✅ Sent:", to);
      } catch (err) {
        console.log("❌ Error:", err.message);
      }

      await delay(2000); // VERY IMPORTANT
    }

    mailLimits[email].count += recipientList.length;

    res.json({
      success: true,
      message: `✅ Sent ${recipientList.length}`
    });

  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: err.message
    });
  }
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚀 Running on port ${PORT}`);
});
