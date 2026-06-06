require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// `/send` API - सीधे Gmail से ईमेल भेजने के लिए
app.post('/send', async (req, res) => {
  const {
    senderName,
    email,
    password,
    subject,
    message,
    recipients,
    'g-recaptcha-response': token
  } = req.body;

  // CAPTCHA वेरिफिकेशन
  try {
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`;
    const responseCaptcha = await axios.post(verifyUrl);
    if (!responseCaptcha.data.success) {
      return res.json({ success: false, message: 'Captcha validation failed' });
    }
  } catch (err) {
    return res.json({ success: false, message: 'Captcha verification error' });
  }

  // Recipients को split करें (कॉमा और नई लाइन से)
  const recipientList = recipients.split(/[\n,]+/).map(r => r.trim()).filter(r => r);

  // Gmail SMTP सेटअप
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: email,
      pass: password
    }
  });

  // मेल भेजने का कोड
  try {
    for (let recipient of recipientList) {
      await transporter.sendMail({
        from: email,
        to: recipient,
        subject: subject,
        text: message
      });
    }
    res.json({ success: true, message: 'Emails sent successfully' });
  } catch (err) {
    res.json({ success: false, message: 'Error sending emails: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
