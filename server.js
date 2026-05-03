const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/send', requireAuth, async (req, res) => {
  try {
    const { senderName, email, recipients, subject, message } = req.body;

    if (!email || !recipients) {
      return res.json({
        success: false,
        message: "Email and recipients required"
      });
    }

    const now = Date.now();

    // ⏱️ Hourly limit reset
    if (!mailLimits[email] || now - mailLimits[email].startTime > 60 * 60 * 1000) {
      mailLimits[email] = { count: 0, startTime: now };
    }

    const recipientList = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(Boolean);

    if (mailLimits[email].count + recipientList.length > 40) {
      return res.json({
        success: false,
        message: `❌ Max 40 mails/hour`
      });
    }

    // 🚀 SEND LOOP (SAFE + PERSONALIZED)
    for (let i = 0; i < recipientList.length; i++) {
      const to = recipientList[i];

      const msg = {
        to,
        from: {
          email: email, // ⚠️ MUST BE VERIFIED IN SENDGRID
          name: senderName || "Your Brand"
        },

        subject: `${subject || "Hello 👋"} ${Math.floor(Math.random()*1000)}`,

        text: message || "Hello",

        html: `
          <div style="font-family:Arial;padding:15px">
            <h2>${subject || "Hello 👋"}</h2>
            <p>${message || ""}</p>

            <br/>
            <p style="font-size:12px;color:#666">
              This message was sent securely.
            </p>
          </div>
        `,

        headers: {
          "X-Priority": "3",
          "X-Mailer": "NodeMailer-Pro",
        }
      };

      try {
        await sgMail.send(msg);
        console.log(`✅ Sent to ${to}`);
      } catch (err) {
        console.log(`❌ Failed ${to}`, err.response?.body || err.message);
      }

      // ⏳ Delay = inbox boost
      await delay(900);
    }

    mailLimits[email].count += recipientList.length;

    return res.json({
      success: true,
      message: `✅ Sent ${recipientList.length} mails`
    });

  } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      message: err.message
    });
  }
});
