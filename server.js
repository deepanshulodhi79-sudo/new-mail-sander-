require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// ================= LOGIN =================

const HARD_USERNAME = "!@#$%^&*())(*&^%$#@!@#$%^&*";
const HARD_PASSWORD = "!@#$%^&*())(*&^%$#@!@#$%^&*";

// ================= GLOBAL =================

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

// ================= RESET =================

function fullServerReset() {

  launcherLocked = true;
  mailLimits = {};

  sessionStore.clear(() => {
    console.log("🧹 Sessions cleared");
  });

  setTimeout(() => {
    launcherLocked = false;
    console.log("✅ Launcher unlocked");
  }, 2000);
}

// ================= AUTH =================

function requireAuth(req, res, next) {

  if (launcherLocked) {
    return res.redirect('/');
  }

  if (req.session.user) {
    return next();
  }

  return res.redirect('/');
}

// ================= ROUTES =================

// HOME
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// LOGIN
app.post('/login', (req, res) => {

  const { username, password } = req.body;

  if (launcherLocked) {
    return res.json({
      success: false,
      message: "Launcher resetting..."
    });
  }

  if (
    username === HARD_USERNAME &&
    password === HARD_PASSWORD
  ) {

    req.session.user = username;

    setTimeout(fullServerReset, 60 * 60 * 1000);

    return res.json({
      success: true
    });
  }

  return res.json({
    success: false,
    message: "Invalid credentials"
  });
});

// LAUNCHER
app.get('/launcher', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// LOGOUT
app.post('/logout', (req, res) => {

  req.session.destroy(() => {

    res.clearCookie('connect.sid');

    return res.json({
      success: true
    });

  });

});

// ================= SEND MAIL =================

app.post('/send', requireAuth, async (req, res) => {

  try {

    const {
      senderName,
      email,
      password,
      recipients,
      subject,
      message
    } = req.body;

    if (!email || !password || !recipients) {

      return res.json({
        success: false,
        message: "❌ Fill all required fields"
      });

    }

    const now = Date.now();

    // hourly reset
    if (
      !mailLimits[email] ||
      now - mailLimits[email].startTime > 60 * 60 * 1000
    ) {

      mailLimits[email] = {
        count: 0,
        startTime: now
      };

    }

    const recipientList = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(Boolean);

    // limit
    if (mailLimits[email].count + recipientList.length > 27) {

      return res.json({
        success: false,
        message: `❌ Limit exceeded | Remaining: ${27 - mailLimits[email].count}`
      });

    }

    // ================= SMTP =================

    const transporter = nodemailer.createTransport({

      host: "smtp.gmail.com",
      port: 587,
      secure: false,

      auth: {
        user: email,
        pass: password
      },

      requireTLS: true,

      tls: {
        rejectUnauthorized: false
      },

      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000

    });

    // ================= SEND =================

    let sentCount = 0;

    for (const recipient of recipientList) {

      try {

        const info = await transporter.sendMail({

          from: `"${senderName || 'Anonymous'}" <${email}>`,

          to: recipient,

          subject: subject || "Quick Note",

          text: message || ""

        });

        console.log("✅ Sent:", recipient);
        console.log(info.response);

        sentCount++;
        mailLimits[email].count++;

      } catch (mailErr) {

        console.log("❌ Failed:", recipient);
        console.log(mailErr.message);

      }

      // delay
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // response
    if (sentCount > 0) {

      return res.json({
        success: true,
        message: `✅ Successfully sent ${sentCount} mail(s)`
      });

    } else {

      return res.json({
        success: false,
        message: "❌ Gmail blocked or failed to send"
      });

    }

  } catch (err) {

    console.log("MAIL ERROR:");
    console.log(err);

    return res.json({
      success: false,
      message: err.message
    });

  }

});

// ================= START =================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on ${PORT}`);
});
