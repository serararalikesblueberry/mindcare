// ═══════════════════════════════════════════════════════
// api.js — MindCare Frontend API Connector
// Add <script src="api.js"></script> to every HTML page
// ═══════════════════════════════════════════════════════

const BASE_URL = 'https://mindcare-production-3b8f.up.railway.app';
```

Click **Commit changes** → **Commit directly to main**.

Then test it's working by visiting this URL in your browser:
```
//https://mindcare-production-3b8f.up.railway.app/health//const BASE_URL = 'http://localhost:5000'; // 🔁 Change to your Railway URL when deployed

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('mc_token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + getToken(),
  };
}

// Show toast message (non-blocking)
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── AUTH ─────────────────────────────────────────────────────────────────────

// Register a new user
// Usage: await mcRegister("sera", "password123", "student")
// role: "student" | "counsellor"
async function mcRegister(username, password, role) {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    const data = await res.json();
    if (data.token) _saveSession(data);
    return data;
  } catch {
    return { error: 'Could not connect to server.' };
  }
}

// Login
// Usage: await mcLogin("sera", "password123")
async function mcLogin(username, password) {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.token) _saveSession(data);
    return data;
  } catch {
    return { error: 'Could not connect to server.' };
  }
}

function _saveSession(data) {
  localStorage.setItem('mc_token',    data.token);
  localStorage.setItem('mc_username', data.user.username);
  localStorage.setItem('mc_role',     data.user.role);
  localStorage.setItem('mc_loggedIn', 'true');
}

// Logout — clears session and redirects
function mcLogout() {
  ['mc_token','mc_username','mc_role','mc_loggedIn','mc_last_submission']
    .forEach(k => localStorage.removeItem(k));
  window.location.href = 'login.html';
}

// Guard — redirect to login if not authenticated
function requireAuth(role) {
  if (!localStorage.getItem('mc_loggedIn')) {
    window.location.href = 'login.html';
    return false;
  }
  if (role && localStorage.getItem('mc_role') !== role) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// ── STUDENT ───────────────────────────────────────────────────────────────────

// Submit the 16-question wellbeing questionnaire
//
// payload shape:
// {
//   answers:          [1,4,6,2,...],   // 16 integers 1–6
//   risk_level:       "high",          // "low"|"moderate"|"high"
//   normalized_score: 72,              // 0–100
//   consent:          "full",          // "full"|"resources"|"none"
//   partial_info: {                    // only when consent==="full"
//     year: "2nd Year",
//     block: "Block C",
//     dept: "Computer Science"
//   }
// }
async function mcSubmitQuestionnaire(payload) {
  try {
    if (!Array.isArray(payload.answers) || payload.answers.length !== 16) {
      return { error: 'Expected 16 answers.' };
    }

    // Map to backend shape
    const LABELS = [
      'Do you wake up feeling rested?',
      'Do you feel motivated to start your day?',
      'Do you feel pressure to perform well academically?',
      'Do you feel lonely even when surrounded by others?',
      'Do you participate in social or hostel activities?',
      'Do you experience sudden changes in appetite?',
      'Do deadlines make you feel anxious or panicked?',
      'Do you feel mentally exhausted after studying?',
      'Does social media make you feel insecure or stressed?',
      'Do you use your phone to escape from problems?',
      'Do you talk to someone when you feel stressed?',
      'Do you feel emotionally disconnected from home?',
      'Would you be willing to seek professional help if needed?',
      'Do you get irritated easily over small issues?',
      'Do you feel a lack of interest in activities you once enjoyed?',
      'Do you feel confident in handling your problems?',
    ];

    const body = {
      answers: payload.answers.map((v, i) => ({
        question_text: LABELS[i],
        answer_value: Number(v),
      })),
      risk_level:       payload.risk_level,
      normalized_score: payload.normalized_score,
      consent:          payload.consent,
      partial_info:     payload.consent === 'full' ? (payload.partial_info || {}) : undefined,
    };

    const res = await fetch(`${BASE_URL}/api/student/submit`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || `Server error ${res.status}` };
    }

    const data = await res.json();

    // Cache for other pages
    try {
      localStorage.setItem('mc_last_submission', JSON.stringify({
        sessionId:       data.sessionId,
        risk_level:      payload.risk_level,
        normalized_score: payload.normalized_score,
        consent:         payload.consent,
        submittedAt:     new Date().toISOString(),
      }));
    } catch (_) {}

    return data;
  } catch {
    return { error: 'Network error — please check your connection.' };
  }
}

// Get student's own session history
async function mcGetMySessions() {
  try {
    const res = await fetch(`${BASE_URL}/api/student/my-sessions`, { headers: authHeaders() });
    return await res.json();
  } catch {
    return { error: 'Could not fetch sessions.' };
  }
}

// Get full detail of one session
async function mcGetSessionDetail(sessionId) {
  try {
    const res = await fetch(`${BASE_URL}/api/student/session/${sessionId}`, { headers: authHeaders() });
    return await res.json();
  } catch {
    return { error: 'Could not fetch session.' };
  }
}

// Reply to a counsellor follow-up question
async function mcAnswerFollowup(sessionId, messageId, reply) {
  try {
    const res = await fetch(`${BASE_URL}/api/student/answer-followup`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ session_id: sessionId, message_id: messageId, reply }),
    });
    return await res.json();
  } catch {
    return { error: 'Could not submit reply.' };
  }
}

// ── COUNSELLOR ────────────────────────────────────────────────────────────────

// Get dashboard summary stats
async function mcGetDashboard() {
  try {
    const res = await fetch(`${BASE_URL}/api/counsellor/dashboard`, { headers: authHeaders() });
    return await res.json();
  } catch {
    return { error: 'Could not load dashboard.' };
  }
}

// Get all sessions with optional filters
// Usage: await mcGetSessions({ risk: "high", status: "open" })
async function mcGetSessions(filters = {}) {
  try {
    const params = new URLSearchParams(filters).toString();
    const res = await fetch(`${BASE_URL}/api/counsellor/sessions?${params}`, { headers: authHeaders() });
    return await res.json();
  } catch {
    return { error: 'Could not fetch sessions.' };
  }
}

// Get full counsellor session detail
async function mcGetCounsellorSession(sessionId) {
  try {
    const res = await fetch(`${BASE_URL}/api/counsellor/session/${sessionId}`, { headers: authHeaders() });
    return await res.json();
  } catch {
    return { error: 'Could not fetch session.' };
  }
}

// Claim a session
async function mcClaimSession(sessionId) {
  try {
    const res = await fetch(`${BASE_URL}/api/counsellor/claim/${sessionId}`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return await res.json();
  } catch {
    return { error: 'Could not claim session.' };
  }
}

// Send a message (follow-up question or advice)
// type: "followup" | "advice"
async function mcSendMessage(sessionId, type, content) {
  try {
    const res = await fetch(`${BASE_URL}/api/counsellor/message/${sessionId}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ type, content }),
    });
    return await res.json();
  } catch {
    return { error: 'Could not send message.' };
  }
}

// Close a session
async function mcCloseSession(sessionId) {
  try {
    const res = await fetch(`${BASE_URL}/api/counsellor/close/${sessionId}`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    return await res.json();
  } catch {
    return { error: 'Could not close session.' };
  }
}
