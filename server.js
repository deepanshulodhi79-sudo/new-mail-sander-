// Send Mail (Updated ✅ BCC + Popup support)
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
      bcc: recipients,   // ✅ अब सभी को मिलेगा लेकिन list नहीं दिखेगी
      subject: subject || "No Subject",
      text: message || "",
    };

    let info = await transporter.sendMail(mailOptions);
    console.log("✅ Mails sent:", info.response);

    res.json({ success: true, message: "✅ All mails sent successfully!" });
  } catch (err) {
    console.error("❌ Mail error:", err.message);
    res.json({ success: false, message: err.message });
  }
});
