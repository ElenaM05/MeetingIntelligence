# Cymonic — Meeting Intelligence App

Extract decisions, action items, and insights from meeting transcripts using AI.

---

## Stack

- **Backend** — FastAPI, Python 3.10+, MongoDB
- **Frontend** — React, Tailwind CSS
- **AI** — Cerebras (llama3.1-8b / qwen-3-235b-a22b-instruct-2507)

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB (local or Atlas)
- A Cerebras API key — get one at [cloud.cerebras.ai](https://cloud.cerebras.ai)

---

## Setup

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd cymonic
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```
CEREBRAS_API_KEY=your_cerebras_api_key
MONGODB_URI=mongodb://localhost:27017
JWT_SECRET=your_secret_key_here
```

### 3. Frontend

```bash
cd frontend
npm install
```

---

## Running

### Start the backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

### Start the frontend

```bash
cd frontend
npm start
```

App runs at [http://localhost:3000](http://localhost:3000)  
API runs at [http://localhost:8000](http://localhost:8000)

---

## Usage

1. Register an account and log in
2. Upload one or more meeting transcript files (.txt, .vtt)
3. Click **Extract** to extract decisions and action items
4. Export results as PDF, CSV, or JSON
5. Click **Chat** to ask questions about the meeting

---

## Available Models

Set the model in `backend/services/extractor.py` and `backend/services/chatbot.py`:

| Model ID | Notes |
|---|---|
| `llama3.1-8b` | Fast, free tier, lower accuracy |
| `qwen-3-235b-a22b-instruct-2507` | Better reasoning, preview model |
| `gpt-oss-120b` | Best quality, requires separate access at cerebras.ai/openai |

---

## Environment Variables

| Variable | Description |
|---|---|
| `CEREBRAS_API_KEY` | Cerebras API key |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign auth tokens |

---

## Project Structure

```
cymonic/
├── backend/
│   ├── main.py
│   ├── auth_utils.py
│   ├── storage.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── transcripts.py
│   │   ├── extract.py
│   │   └── chat.py
│   └── services/
│       ├── extractor.py
│       └── chatbot.py
└── frontend/
    └── src/
        ├── App.jsx
        ├── api/
        │   └── client.js
        └── pages/
            ├── Auth.jsx
            ├── Home.jsx
            ├── Results.jsx
            └── Chat.jsx
```
