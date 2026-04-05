# Meeting Intelligence Hub

## Project Title

Meeting Intelligence Hub

## The Problem

Meetings generate a large volume of spoken information, but extracting actionable outcomes — decisions made, tasks assigned, and deadlines set — requires manual review that is time-consuming and error-prone. Teams often lose track of commitments made in meetings, leading to missed follow-ups and miscommunication. There is no easy way to query or search across multiple meeting transcripts to find specific information quickly.

## The Solution

Meeting Intelligence Hub automatically processes meeting transcripts using AI to extract structured decisions and action items, assign ownership and deadlines, and generate exportable reports. Users can upload one or more transcript files, run AI-powered extraction in one click, and receive a clean breakdown of every decision and task from the meeting. An AI chat assistant allows users to ask natural language questions directly about the transcript content. Results can be exported as PDF, CSV, or JSON for sharing with teams.

Key features:
- AI extraction of decisions, action items, owners, deadlines, and priorities
- Multi-transcript support with cross-meeting synthesis
- Chat interface for querying transcript content
- Export to PDF, CSV, and JSON
- JWT-based authentication with protected routes

## Tech Stack

**Programming Languages**
- Python 3.10
- JavaScript (React)

**Frameworks**
- FastAPI — backend API
- React — frontend UI
- Tailwind CSS — styling

**Databases**
- MongoDB Atlas — transcript storage, extraction results, chat sessions
- Motor — async MongoDB driver for Python

**APIs and Third-Party Tools**
- Cerebras AI — LLM inference (Llama 3.1 8B / qwen-3-235b)
- ReportLab — PDF generation
- JSON Web Tokens (JWT) — authentication

## Setup Instructions

### Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB Atlas account (free tier works)
- Cerebras API key — get one at [cloud.cerebras.ai](https://cloud.cerebras.ai)

### 1. Clone the repository

```bash
git clone https://github.com/ElenaM05/MeetingIntelligence.git
cd MeetingIntelligence
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```
CEREBRAS_API_KEY=your_cerebras_api_key
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=any_random_secret_string
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000).

The backend API runs at [http://localhost:8000](http://localhost:8000).

### 4. Usage

1. Register an account and log in
2. Upload a meeting transcript (.txt or .vtt file)
3. Click **Extract** to run AI extraction
4. View decisions and action items, export as PDF/CSV/JSON
5. Click **Chat** to ask questions about the meeting