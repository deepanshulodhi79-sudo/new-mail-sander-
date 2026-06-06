// ========== RECIPIENT COUNTER ==========
function countRecipients() {
  const raw = document.getElementById('recipients').value;
  const emails = parseEmails(raw);
  const badge = document.getElementById('recipientCount');
  badge.textContent = `${emails.length} recipient${emails.length !== 1 ? 's' : ''}`;
  badge.style.background = emails.length > 50 ? '#ef4444' : '#5b5ef4';
}

function parseEmails(raw) {
  return raw
    .split(/[\n,]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

function togglePass() {
  const inp = document.getElementById('appPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function setStatus(type, icon, text) {
  const bar = document.getElementById('statusBar');
  bar.className = 'status-bar ' + type;
  document.getElementById('statusIcon').textContent = icon;
  document.getElementById('statusText').textContent = text;
}

function addLog(type, icon, message) {
  const logBox = document.getElementById('logBox');
  const logList = document.getElementById('logList');
  logBox.style.display = 'block';
  const item = document.createElement('div');
  item.className = `log-item ${type}`;
  item.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  logList.appendChild(item);
  logBox.scrollTop = logBox.scrollHeight;
}

function clearLog() {
  document.getElementById('logList').innerHTML = '';
  document.getElementById('logBox').style.display = 'none';
}

function setProgress(current, total) {
  const wrap = document.getElementById('progressWrap');
  wrap.style.display = 'flex';
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = `Sending ${current} / ${total}`;
}

function validate() {
  const fields = [
    { id: 'senderName',  label: 'Sender Name' },
    { id: 'gmailId',     label: 'Gmail ID' },
    { id: 'appPassword', label: 'App Password' },
    { id: 'subject',     label: 'Subject' },
    { id: 'messageBody', label: 'Message Body' },
  ];
  for (const f of fields) {
    if (!document.getElementById(f.id).value.trim()) {
      setStatus('error', '❌', `${f.label} is required`);
      document.getElementById(f.id).focus();
      return false;
    }
  }
  const emails = parseEmails(document.getElementById('recipients').value);
  if (emails.length === 0) {
    setStatus('error', '❌', 'Add at least 1 valid recipient email');
    return false;
  }
  if (emails.length > 50) {
    setStatus('error', '❌', 'Max 50 recipients at a time');
    return false;
  }
  return emails;
}

async function sendAll() {
  const emails = validate();
  if (!emails) return;

  const senderName  = document.getElementById('senderName').value.trim();
  const gmailId     = document.getElementById('gmailId').value.trim();
  const appPassword = document.getElementById('appPassword').value.trim();
  const subject     = document.getElementById('subject').value.trim();
  const messageBody = document.getElementById('messageBody').value.trim();

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Sending...';

  clearLog();
  setStatus('sending', '📤', `Sending to ${emails.length} recipients...`);
  setProgress(0, emails.length);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < emails.length; i++) {
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderName, gmailId, appPassword, subject, messageBody, to: emails[i] })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      failCount++;
    }

    setProgress(i + 1, emails.length);
    if (i < emails.length - 2) await sleep(200);
  }

  if (failCount === 0) {
    setStatus('success', '🎉', `All ${successCount} emails sent successfully!`);
    addLog('ok', '✅', `${successCount} emails delivered successfully`);
  } else if (successCount === 0) {
    setStatus('error', '💥', `All ${failCount} emails failed. Check credentials.`);
    addLog('fail', '❌', `All ${failCount} emails failed — check Gmail & App Password`);
  } else {
    setStatus('sending', '⚠️', `${successCount} sent, ${failCount} failed`);
    addLog('ok', '✅', `${successCount} delivered`);
    addLog('fail', '❌', `${failCount} failed`);
  }

  addLog('info', '📊', `Total: ${emails.length} | ✅ ${successCount} success  ❌ ${failCount} failed`);

  btn.disabled = false;
  btn.innerHTML = '<span>🚀</span> Send All';
}

function logoutAll() {
  document.getElementById('senderName').value = '';
  document.getElementById('gmailId').value = '';
  document.getElementById('appPassword').value = '';
  document.getElementById('subject').value = '';
  document.getElementById('messageBody').value = '';
  document.getElementById('recipients').value = '';
  countRecipients();
  clearLog();
  document.getElementById('progressWrap').style.display = 'none';
  setStatus('', '⚡', 'Ready to launch');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
