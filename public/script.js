// ✅ Send Mail (Updated with popup)
function sendMail() {
  const senderName = document.getElementById("senderName").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("pass").value;
  const recipients = document.getElementById("recipients").value;
  const subject = document.getElementById("subject").value;
  const message = document.getElementById("message").value;

  const sendBtn = document.getElementById("sendBtn");
  const statusMessage = document.getElementById("statusMessage");

  sendBtn.disabled = true;
  sendBtn.innerText = "⏳ Sending...";

  fetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senderName, email, password, recipients, subject, message })
  })
  .then(res => res.json())
  .then(data => {
    statusMessage.innerText = data.message;
    if (data.success) {
      alert("✅ Mails sent successfully!"); // ✅ Popup
    } else {
      alert("❌ Failed: " + data.message);
    }
  })
  .catch(err => {
    statusMessage.innerText = "❌ " + err.message;
    alert("❌ Error: " + err.message);
  })
  .finally(() => {
    sendBtn.disabled = false;
    sendBtn.innerText = "Send All";
  });
}
