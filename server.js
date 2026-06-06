const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.post("/send-email", async (req, res) => {
    try {
        const { gmail, appPassword, senderName, recipients, subject, message } = req.body;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: gmail,
                pass: appPassword,
            },
            pool: true,
            maxConnections: 5,
            rateDelta: 1000,
            rateLimit: 5,
        });

        for (const recipient of recipients) {
            const personalizedSubject = subject
                .replace(/{{name}}/gi, recipient.name)
                .replace(/{{email}}/gi, recipient.email);

            const personalizedMessage = message
                .replace(/{{name}}/gi, recipient.name)
                .replace(/{{email}}/gi, recipient.email);

            await transporter.sendMail({
                from: `"${senderName || "Sender"}" <${gmail}>`,
                to: recipient.email,
                replyTo: gmail,
                subject: personalizedSubject,
                text: personalizedMessage,
                html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.7;">
                           ${personalizedMessage.replace(/\n/g, "<br/>")}
                       </div>`,
            });

            await sleep(200);
        }

        res.json({ success: true, sent: recipients.length });
    } catch (error) {
        console.error(error);
        res.json({ success: false, error: error.message });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running on port " + (process.env.PORT || 3000));
});
