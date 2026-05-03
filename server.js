require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// 🔑 Login
const HARD_USERNAME = "!@#$%^&*())(*&^%$#@!@#$%^&*";
const HARD_PASSWORD = "!@#$%^&*())(*&^%$#@!@#$%^&*";

// ================= GLOBAL =================
let launcherLocked = false;
let dailyCount = {};
let warmupMode = true;

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

function randomDelay() {
  return Math.floor(Math.random() * 4000) + 3000; // 3–7 sec
}

function getGreeting() {
  const arr = ["Hi", "Hello", "Hey"];
  return arr[Math.floor(Math.random() * arr.length)];
}

function getVariation(msg) {
  const extras = [
    "",
    "Just checking in.",
    "Let me know your thoughts.",
    "Looking forward to your reply."
  ];
  return msg + "\n\n" + extras[Math.floor(Math.random() * extras.length)];
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

  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;
    return res.json({ success: true });
  }

  return res.json({ success: false });
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

// ================= SEND MAIL (SMART SYSTEM) =================
app.post('/send', requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    if (!email || !password || !recipients) {
      return res.json({ success: false, message: "Required fields missing" });
    }

    const today = new Date().toDateString();

    if (!dailyCount[email] || dailyCount[email].date !== today) {
      dailyCount[email] = { count: 0, date: today };
    }

    const recipientList = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(Boolean);

    // 🔥 Warmup logic
    let limit = warmupMode ? 3 : 10;

    if (dailyCount[email].count + recipientList.length > limit) {
      return res.json({
        success: false,
        message: `❌ Limit reached (${limit}/day)`
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: email,
        pass: password // ⚠️ App password
      }
    });

    await transporter.verify();

    for (let i = 0; i < recipientList.length; i++) {
      const to = recipientList[i];
      const name = to.split("@")[0];

      const greet = getGreeting();
      const finalMsg = getVariation(message || "Hello");

      const mailOptions = {
        from: `"${senderName || "Your Name"}" <${email}>`,
        to,
        subject: subject || "Hello",

        text: `${greet} ${name},\n\n${finalMsg}`,

        html: `
          <div style="font-family:Arial">
            <p>${greet} ${name},</p>
            <p>${finalMsg.replace(/\n/g, "<br>")}</p>
            <br>
            <small>If not relevant, ignore this email.</small>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log("✅ Sent:", to);
      } catch (err) {
        console.log("❌ Error:", err.message);
      }

      await delay(randomDelay());
    }

    dailyCount[email].count += recipientList.length;

    res.json({
      success: true,
      message: `✅ Sent ${recipientList.length} mails`
    });

  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 🔥 Auto disable warmup after 3 days
setTimeout(() => {
  warmupMode = false;
  console.log("🔥 Warmup OFF");
}, 3 * 24 * 60 * 60 * 1000);

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚀 Running on port ${PORT}`);
});
