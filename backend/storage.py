import os
import uuid
import re
from datetime import datetime
from pathlib import Path
from database import get_collection

ALLOWED_EXTENSIONS = {".txt", ".vtt"}


def init_storage():
    """No-op — all storage is in MongoDB."""
    pass


# ── Transcript helpers ─────────────────────────────────────────────────────────

async def save_transcript(user_id: str, project: str, filename: str, content: bytes) -> dict:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    text = content.decode("utf-8", errors="replace")
    transcript_id = str(uuid.uuid4())
    safe_project = re.sub(r"[^a-zA-Z0-9_\- ]", "", project).strip() or "default"

    metadata = {
        "_id": transcript_id,
        "user_id": user_id,
        "project": safe_project,
        "filename": filename,
        "extension": ext,
        "text": text,
        "uploaded_at": datetime.utcnow().isoformat(),
        "word_count": _count_words(text),
        "speakers": _detect_speakers(text),
        "detected_date": _detect_date(filename, text),
    }

    col = await get_collection("transcripts")
    await col.insert_one(metadata)

    # Return without text to keep response lean
    result = {k: v for k, v in metadata.items() if k != "text"}
    result["id"] = transcript_id
    del result["_id"]
    return result


async def get_transcript(transcript_id: str, user_id: str = None) -> dict | None:
    col = await get_collection("transcripts")
    query = {"_id": transcript_id}
    if user_id:
        query["user_id"] = user_id
    doc = await col.find_one(query, {"text": 0})  # exclude text from metadata fetches
    if not doc:
        return None
    doc["id"] = doc["_id"]
    del doc["_id"]
    return doc


async def get_transcript_text(transcript_id: str, user_id: str = None) -> str | None:
    col = await get_collection("transcripts")
    query = {"_id": transcript_id}
    if user_id:
        query["user_id"] = user_id
    doc = await col.find_one(query, {"text": 1})
    if not doc:
        return None
    return doc.get("text")


async def update_transcript_metadata(transcript_id: str, updates: dict, user_id: str = None):
    col = await get_collection("transcripts")
    query = {"_id": transcript_id}
    if user_id:
        query["user_id"] = user_id
    await col.update_one(query, {"$set": updates})


async def list_transcripts(user_id: str, project: str = None) -> list[dict]:
    col = await get_collection("transcripts")
    query = {"user_id": user_id}
    if project:
        query["project"] = project
    cursor = col.find(query, {"text": 0}).sort("uploaded_at", -1)  # exclude text
    results = []
    async for doc in cursor:
        doc["id"] = doc["_id"]
        del doc["_id"]
        results.append(doc)
    return results


async def delete_transcript(transcript_id: str, user_id: str) -> bool:
    col = await get_collection("transcripts")
    result = await col.delete_one({"_id": transcript_id, "user_id": user_id})
    if result.deleted_count == 0:
        return False
    results_col = await get_collection("extraction_results")
    await results_col.delete_many({"transcript_id": transcript_id})
    sessions_col = await get_collection("sessions")
    await sessions_col.delete_many({"transcript_ids": transcript_id})
    return True


async def list_projects(user_id: str) -> list[str]:
    col = await get_collection("transcripts")
    return await col.distinct("project", {"user_id": user_id})


# ── Extraction result helpers ──────────────────────────────────────────────────

async def save_extraction_result(transcript_id: str, user_id: str, result: dict):
    col = await get_collection("extraction_results")
    await col.replace_one(
        {"transcript_id": transcript_id, "user_id": user_id},
        {"transcript_id": transcript_id, "user_id": user_id, **result},
        upsert=True,
    )


async def get_extraction_result(transcript_id: str, user_id: str) -> dict | None:
    col = await get_collection("extraction_results")
    doc = await col.find_one({"transcript_id": transcript_id, "user_id": user_id})
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


# ── Session helpers ────────────────────────────────────────────────────────────

async def create_session(user_id: str, transcript_ids: list[str]) -> dict:
    session_id = str(uuid.uuid4())
    session = {
        "_id": session_id,
        "user_id": user_id,
        "transcript_ids": transcript_ids,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "history": [],
    }
    col = await get_collection("sessions")
    await col.insert_one(session)
    session["id"] = session_id
    del session["_id"]
    return session


async def get_session(session_id: str, user_id: str = None) -> dict | None:
    col = await get_collection("sessions")
    query = {"_id": session_id}
    if user_id:
        query["user_id"] = user_id
    doc = await col.find_one(query)
    if not doc:
        return None
    doc["id"] = doc["_id"]
    del doc["_id"]
    return doc


async def append_to_session(session_id: str, user_id: str, question: str, answer: str) -> dict | None:
    col = await get_collection("sessions")
    await col.update_one(
        {"_id": session_id, "user_id": user_id},
        {
            "$push": {
                "history": {"$each": [
                    {"role": "user", "content": question},
                    {"role": "assistant", "content": answer},
                ]}
            },
            "$set": {"updated_at": datetime.utcnow().isoformat()},
        },
    )
    return await get_session(session_id, user_id)


async def delete_session(session_id: str, user_id: str) -> bool:
    col = await get_collection("sessions")
    result = await col.delete_one({"_id": session_id, "user_id": user_id})
    return result.deleted_count > 0


async def list_sessions(user_id: str) -> list[dict]:
    col = await get_collection("sessions")
    cursor = col.find({"user_id": user_id}).sort("updated_at", -1)
    results = []
    async for doc in cursor:
        results.append({
            "id": doc["_id"],
            "transcript_ids": doc["transcript_ids"],
            "created_at": doc["created_at"],
            "updated_at": doc["updated_at"],
            "message_count": len(doc.get("history", [])),
        })
    return results


# ── Text analysis utilities ────────────────────────────────────────────────────

def _count_words(text: str) -> int:
    return len(text.split())


def _detect_speakers(text: str) -> list[str]:
    exclude_patterns = {
        "attendees", "date", "location", "meeting title", "time",
        "participant", "duration", "organizer", "facilitator",
        "agenda", "notes", "summary", "action items", "decisions",
        "project", "meeting", "call", "standup", "sync"
    }
    names = set()
    for match in re.finditer(r"^([A-Z][A-Za-z\s\-\.]{1,40}):", text, re.MULTILINE):
        name = match.group(1).strip()
        if name.lower() not in exclude_patterns:
            names.add(name)
    for match in re.finditer(r"^\[\d{2}:\d{2}\]\s+([A-Z][A-Za-z\s\-\.]{1,40})$", text, re.MULTILINE):
        name = match.group(1).strip()
        if name.lower() not in exclude_patterns:
            names.add(name)
    for match in re.finditer(r"<v\s+([^>]+)>", text):
        name = match.group(1).strip()
        if name.lower() not in exclude_patterns:
            names.add(name)
    return sorted(names)


def _detect_date(filename: str, text: str) -> str | None:
    patterns = [
        r"\b(\d{4}[-/_]\d{2}[-/_]\d{2})\b",
        r"\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b",
    ]
    for pattern in patterns:
        m = re.search(pattern, filename)
        if m:
            return m.group(1)
    for pattern in patterns:
        m = re.search(pattern, text[:2000])
        if m:
            return m.group(1)
    return None