# 🌿 MindCare — Anonymous Student Wellbeing Platform

A full-stack web application where students anonymously check in on their mental health via a 16-question weighted questionnaire, get risk-classified (low / moderate / high), and optionally consent to counsellor outreach — all without revealing their identity.

---

## 📁 Project Structure

```
mindcare/
├── frontend/                  # Pure HTML + CSS + JS (no framework)
│   ├── index.html             # Landing page
│   ├── login.html             # Login & Register (tabbed)
│   ├── student.html           # 16-question questionnaire + results + consent
│   ├── counsellor.html        # Counsellor dashboard with stats
│   ├── students.html          # Student list with risk filters
│   ├── student-detail.html    # Individual session detail + messaging
│   ├── style.css              # Shared warm wellness design system
│   └── api.js                 # All API calls in one place
│
└── backend/                   # Node.js + Express + MongoDB
    ├── src/
    │   ├── server.js          # Entry point
    │   ├── config/db.js       # MongoDB connection
    │   ├── models/
    │   │   ├── User.js        # Students & counsellors
    │   │   └── Session.js     # Questionnaire responses, risk, consent
    │   ├── routes/
    │   │   ├── auth.js        # POST /register, POST /login
    │   │   ├── student.js     # Submit, view sessions, answer follow-ups
    │   │   └── counsellor.js  # Dashboard, claim, message, close
    │   └── middleware/
    │       └── auth.js        # JWT protect + requireRole guards
    ├── package.json
    └── .env.example
```

---

## 🚀 Backend Setup

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Create your `.env` file
```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/mindcare
JWT_SECRET=pick_a_long_random_secret_string_here
JWT_EXPIRES_IN=7d
```

> **MongoDB**: Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas). Add your IP to the allowlist and paste the connection string above.

### 3. Run locally
```bash
npm run dev       # with nodemon (auto-restart)
npm start         # production
```

The API will be running at `http://localhost:5000`.

### 4. Deploy to Railway
1. Push the `backend/` folder to a GitHub repo (or the whole monorepo)
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables: `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`
4. Railway auto-detects Node.js and runs `npm start`
5. Copy your Railway URL (e.g. `https://mindcare-backend.up.railway.app`)

---

## 🌐 Frontend Setup

### 1. Point to your backend
Open `frontend/api.js` and update line 6:
```js
const BASE_URL = 'https://your-railway-url.up.railway.app';
```

### 2. Run locally
Just open `frontend/index.html` in a browser — no build step needed.

> **Note**: Because the frontend uses `fetch()` to call the backend, you'll need a local server to avoid CORS issues. The easiest way:
> ```bash
> cd frontend
> npx serve .
> # or
> python3 -m http.server 3000
> ```

### 3. Deploy frontend
Upload the `frontend/` folder to any static host:
- **Vercel**: `vercel --cwd frontend`
- **Netlify**: Drag & drop the `frontend/` folder
- **GitHub Pages**: Push to a `gh-pages` branch

---

## 🔑 API Reference

### Auth
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | `{username, password, role}` | role: `student` or `counsellor` |
| POST | `/api/auth/login` | `{username, password}` | Returns JWT token |

### Student (requires Bearer token + student role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/student/submit` | Submit 16-question questionnaire |
| GET | `/api/student/my-sessions` | View own session history |
| GET | `/api/student/session/:id` | Full detail of one session |
| POST | `/api/student/answer-followup` | Reply to counsellor follow-up |

### Counsellor (requires Bearer token + counsellor role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/counsellor/dashboard` | Summary stats |
| GET | `/api/counsellor/sessions` | All sessions (filter by `?risk=high&status=open`) |
| GET | `/api/counsellor/session/:id` | Full session detail (student ID never exposed) |
| POST | `/api/counsellor/claim/:id` | Claim a session |
| POST | `/api/counsellor/message/:id` | Send follow-up question or advice |
| PATCH | `/api/counsellor/close/:id` | Mark session resolved |

---

## 🧠 Scoring Logic

Each of the 16 questions has a weight (1, 2, or 3) based on how strongly it indicates distress.
Some questions are **reverse-scored** (e.g. "Do you feel motivated?" — a 6 is good, not bad).

```
Effective score per question = reverse ? (7 - answer) : answer
Raw score = Σ (effective × weight)
Normalized = (raw / max_possible) × 100
```

| Normalized Score | Risk Level | Action |
|-----------------|------------|--------|
| 0 – 39 | 🟢 Low | Resources shared, optional follow-up |
| 40 – 64 | 🟡 Moderate | Counsellor monitors |
| 65 – 100 | 🔴 High | Counsellor must contact within 24 hrs |

---

## 🔒 Anonymity & Consent

- Students log in with a **display name only** — no email, no student ID
- The backend stores student responses linked to an **opaque MongoDB ObjectId**
- Counsellors **never see** the student's username or ObjectId
- When a session is fetched by a counsellor, the `student` field is excluded from the response
- Students choose one of three consent options after seeing their result:
  - **Full** → counsellor can contact; student optionally shares year / block / department
  - **Resources** → stays anonymous, gets self-help content
  - **None** → score recorded for aggregate data only, no contact

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Fonts | Fraunces (display) + Plus Jakarta Sans (body) |
| Backend | Node.js + Express |
| Database | MongoDB via Mongoose |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Hosting | Railway (backend) + Vercel/Netlify (frontend) |
