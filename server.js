// ================= SEND MAIL (ULTRA TUNED) =================

const os = require('os');

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

    // ⏱️ Hourly reset
    if (!mailLimits[email] || now - mailLimits[email].startTime > 60 * 60 * 1000) {
      mailLimits[email] = { count: 0, startTime: now };
    }

    const recipientList = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(Boolean);

    // ⚠️ Gmail safe limit (realistic)
    const MAX_PER_HOUR = 20;

    if (mailLimits[email].count + recipientList.length > MAX_PER_HOUR) {
      return res.json({
        success: false,
        message: `❌ Max ${MAX_PER_HOUR}/hour | Remaining: ${MAX_PER_HOUR - mailLimits[email].count}`
      });
    }

    // ✅ Gmail transporter (pooled + stable)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: email,
        pass: password // ⚠️ App Password only
      },
      pool: true,
      maxConnections: 1,
      maxMessages: 50
    });

    // verify once
    await transporter.verify();

    // helper: extract simple name from email
    const nameFromEmail = (e) => (e.split("@")[0] || "").replace(/[._-]/g, " ");

    for (let i = 0; i < recipientList.length; i++) {
      const to = recipientList[i];
      const rName = nameFromEmail(to);

      const msgId = `<${Date.now()}.${i}@${os.hostname()}>`;

      const mailOptions = {
        from: `"${senderName || "Your Name"}" <${email}>`,
        to,

        // slight variation to avoid exact duplicates
        subject: `${subject || "Hello 👋"} ${Math.floor(Math.random() * 900 + 100)}`,

        // plain text fallback
        text: `Hi ${rName},\n\n${message || "Hello"}\n\n— ${senderName || "Team"}`,

        // HTML body (clean + simple = better)
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;padding:12px">
            <p>Hi ${rName},</p>
            <p>${(message || "").replace(/\n/g, "<br/>")}</p>

            <br/>
            <p style="font-size:12px;color:#666">
              Sent securely • ${new Date().toLocaleString()}
            </p>
          </div>
        `,

        // 🔐 inbox-friendly headers
        headers: {
          "Message-ID": msgId,
          "X-Mailer": "NodeMailer",
          "List-Unsubscribe": `<mailto:${email}?subject=unsubscribe>`,
          "Precedence": "bulk"
        }
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log("✅ Sent:", to);
      } catch (err) {
        console.log("❌ Failed:", to, err.message);
      }

      // ⏳ Slow down (CRITICAL)
      await delay(2000); // 2 sec gap
    }

    mailLimits[email].count += recipientList.length;

    return res.json({
      success: true,
      message: `✅ Sent ${recipientList.length} | Used ${mailLimits[email].count}/${MAX_PER_HOUR}`
    });

  } catch (err) {
    console.error("SEND ERROR:", err);
    return res.json({
      success: false,
      message: err.message
    });
  }
});
