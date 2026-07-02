// AI Voice Screening: Automatic/Manual toggle + per-candidate manual call.
// Plain static file (not Jinja-templated) — talks directly to the
// AI_VoiceAgent backend on localhost:3001.
const VOICE_AGENT_URL = 'http://localhost:3001';
const VOICE_AGENT_SECRET = 'be6c290a2b9fd52c342322ac2c8d1feadd328ff8c90675f257b6dd8d5d1d3890';

function updateAutoCallToggleUI(enabled) {
  const autoBtn = document.getElementById('btnAutoCallAuto');
  const manualBtn = document.getElementById('btnAutoCallManual');
  if (!autoBtn || !manualBtn) return;
  autoBtn.style.background = enabled ? '#830026' : 'transparent';
  autoBtn.style.color = enabled ? '#fff' : '#666';
  manualBtn.style.background = !enabled ? '#830026' : 'transparent';
  manualBtn.style.color = !enabled ? '#fff' : '#666';
}

async function loadAutoCallMode() {
  try {
    const res = await fetch(`${VOICE_AGENT_URL}/api/settings/auto-call`, {
      headers: { 'X-Webhook-Secret': VOICE_AGENT_SECRET },
    }).then((r) => r.json());
    updateAutoCallToggleUI(res.enabled !== false);
  } catch (e) {
    console.warn('[AI Voice Screening] backend unreachable on localhost:3001', e);
  }
}

async function setAutoCallMode(enabled) {
  try {
    const res = await fetch(`${VOICE_AGENT_URL}/api/settings/auto-call`, {
      method: 'POST',
      headers: { 'X-Webhook-Secret': VOICE_AGENT_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).then((r) => r.json());
    updateAutoCallToggleUI(res.enabled !== false);
  } catch (e) {
    alert('Could not reach the AI Voice Screening backend on localhost:3001.');
  }
}

async function manualCall(name, phone, email, role, btn) {
  if (!phone) {
    alert('This candidate has no phone number on file.');
    return;
  }
  const original = btn ? btn.textContent : null;
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    const res = await fetch(`${VOICE_AGENT_URL}/api/candidates/manual-call`, {
      method: 'POST',
      headers: { 'X-Webhook-Secret': VOICE_AGENT_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, roleTitle: role }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      alert(`Call triggered for ${name}.`);
    } else {
      alert(`Could not trigger call for ${name}: ${data.error || 'unknown error'}`);
    }
  } catch (e) {
    alert('Could not reach the AI Voice Screening backend on localhost:3001.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = original ?? '📞'; }
  }
}

document.addEventListener('DOMContentLoaded', () => { loadAutoCallMode(); });
