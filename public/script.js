// Protect launcher
(function protect() {
  const isLauncher = window.location.pathname.endsWith("launcher.html");
  if (isLauncher && localStorage.getItem("loggedIn") !== "true") {
    window.location.href = "login.html";
  }
})();

// Login
function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      localStorage.setItem("loggedIn", "true");
      window.location.href = "launcher.html";
    } else {
      document.getElementById("loginStatus").innerText = data.message;
    }
  });
}

// Logout
function logout() {
  localStorage.removeItem("loggedIn");
  window.location.href = "login.html";
}

// Send to all at once
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
  })
  .catch(err => {
    statusMessage.innerText = "❌ " + err.message;
  })
  .finally(() => {
    sendBtn.disabled = false;
    sendBtn.innerText = "Send All";
  });
}
