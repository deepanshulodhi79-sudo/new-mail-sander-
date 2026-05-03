require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

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

// ================= HELPERS =================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fullServerReset() {
  console.log("🔁 RESET");
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
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (launcherLocked) {
    return res.json({ success: false, message: "⛔ Reset ho raha hai" });
  }

  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;
    setTimeout(fullServerReset, 60 * 60 * 1000);
    return res.json({ success: true });
  }

  return res.json({ success: false, message: "❌ Invalid" });
});

app.get('/launcher', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

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

    const MAX_PER_HOUR = 10;

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
        pass: password // ⚠️ App Password only
      }
    });

    await transporter.verify();

    for (let i = 0; i < recipientList.length; i++) {
      const to = recipientList[i];
      const name = to.split("@")[0];

      const greetings = ["Hi", "Hello", "Hey"];
      const greet = greetings[Math.floor(Math.random() * greetings.length)];

      const mailOptions = {
        from: `"${senderName || "Your Name"}" <${email}>`,
        to,
        subject: subject || "Quick note",

        text: `${greet} ${name},\n\n${message || "Hello"}`,

        html: `
          <div style="font-family:Arial">
            <p>${greet} ${name},</p>
            <p>${(message || "").replace(/\n/g, "<br>")}</p>
            <br>
            <p style="font-size:12px;color:#666">
              If this email is not relevant, you can ignore it.
            </p>
          </div>
        `,

        headers: {
          "X-Mailer": "NodeMailer"
        }
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log("✅ Sent:", to);
      } catch (err) {
        console.log("❌ Error:", err.message);
      }

      // ⏳ Delay (important)
      await delay(2500);
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
