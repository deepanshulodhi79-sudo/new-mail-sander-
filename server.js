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
        message: "Fill all required fields"
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

    if (mailLimits[email].count + recipientList.length > 27) {
      return res.json({
        success: false,
        message: `Limit exceeded. Remaining: ${27 - mailLimits[email].count}`
      });
    }

    // ================= SMTP =================

    const transporter = nodemailer.createTransport({

      service: "gmail",

      auth: {
        user: email,
        pass: password
      },

      tls: {
        rejectUnauthorized: false
      }

    });

    // ================= SEND =================

    for (const recipient of recipientList) {

      try {

        await transporter.sendMail({

          from: `"${senderName || 'Anonymous'}" <${email}>`,
          to: recipient,
          subject: subject || "Quick Note",
          text: message || ""

        });

        mailLimits[email].count++;

        console.log("✅ Sent:", recipient);

      } catch (mailErr) {

        console.log("❌ Failed:", recipient, mailErr.message);

      }

      // delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return res.json({
      success: true,
      message: `✅ Successfully sent ${recipientList.length} mails`
    });

  } catch (err) {

    console.log("MAIL ERROR:", err);

    return res.json({
      success: false,
      message: err.message
    });
  }
});
