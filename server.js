const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Default route → login
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Hardcoded login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "radha krishna" && password === "shree krishna15") {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Invalid credentials" });
  }
});

// Send to all recipients at once 🚀
app.post("/send", async (req, res) => {
  try {
    const { email, password, senderName, recipients, subject, message } = req.body;

    if (!email || !password || !recipients) {
      return res.json({ success: false, message: "Email, password and recipients are required" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: email, pass: password },
    });

    let mailOptions = {
      from: `"${senderName || "Anonymous"}" <${email}>`,
      to: recipients, // ✅ All recipients together
      subject: subject || "No Subject",
      text: message || "",
    };

    let info = await transporter.sendMail(mailOptions);
    console.log("✅ Mails sent:", info.response);

    res.json({ success: true, message: "All mails sent together 🚀" });
  } catch (err) {
    console.error("❌ Mail error:", err.message);
    res.json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
