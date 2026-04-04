from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

from database import init_db
from storage import init_storage
from routers import transcripts, extract, chat
from routers import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_storage()
    await init_db()
    yield


app = FastAPI(
    title="Meeting Intelligence Hub API",
    description="Backend for transcript ingestion, storage, and AI-powered extraction.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(transcripts.router, prefix="/api/transcripts", tags=["Transcripts"])
app.include_router(extract.router, prefix="/api/extract", tags=["Extraction"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])


@app.get("/health")
def health():
    return {"status": "ok"}
