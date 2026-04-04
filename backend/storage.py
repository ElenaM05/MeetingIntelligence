import os
import json
import uuid
import re
from datetime import datetime
from pathlib import Path

STORAGE_ROOT = Path(os.getenv("STORAGE_ROOT", "./data"))
TRANSCRIPTS_DIR = STORAGE_ROOT / "transcripts"
METADATA_DIR = STORAGE_ROOT / "metadata"
RESULTS_DIR = STORAGE_ROOT / "results"
SESSIONS_DIR = STORAGE_ROOT / "sessions"

ALLOWED_EXTENSIONS = {".txt", ".vtt"}


def init_storage():
    for d in [TRANSCRIPTS_DIR, METADATA_DIR, RESULTS_DIR, SESSIONS_DIR]:
        d.mkdir(parents=True, exist_ok=True)


# ── Transcript helpers ─────────────────────────────────────────────────────────

def save_transcript(project: str, filename: str, content: bytes) -> dict:
    """
    Persist a transcript file and its metadata.
    Returns the metadata dict.
    """
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    transcript_id = str(uuid.uuid4())
    text = content.decode("utf-8", errors="replace")

    safe_project = re.sub(r"[^a-zA-Z0-9_\- ]", "", project).strip() or "default"
    project_dir = TRANSCRIPTS_DIR / safe_project
    project_dir.mkdir(parents=True, exist_ok=True)

    file_path = project_dir / f"{transcript_id}{ext}"
    file_path.write_bytes(content)

    metadata = {
        "id": transcript_id,
        "project": safe_project,
        "filename": filename,
        "extension": ext,
        "file_path": str(file_path),
        "uploaded_at": datetime.utcnow().isoformat(),
        "word_count": _count_words(text),
        "speakers": _detect_speakers(text),
        "detected_date": _detect_date(filename, text),
    }

    meta_path = METADATA_DIR / f"{transcript_id}.json"
    meta_path.write_text(json.dumps(metadata, indent=2))

    return metadata


def get_transcript(transcript_id: str) -> dict | None:
    meta_path = METADATA_DIR / f"{transcript_id}.json"
    if not meta_path.exists():
        return None
    return json.loads(meta_path.read_text())


def get_transcript_text(transcript_id: str) -> str | None:
    meta = get_transcript(transcript_id)
    if not meta:
        return None
    path = Path(meta["file_path"])
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8", errors="replace")


def list_transcripts(project: str | None = None) -> list[dict]:
    results = []
    for f in METADATA_DIR.glob("*.json"):
        try:
            meta = json.loads(f.read_text())
            if project is None or meta.get("project") == project:
                results.append(meta)
        except Exception:
            continue
    return sorted(results, key=lambda m: m["uploaded_at"], reverse=True)


def delete_transcript(transcript_id: str) -> bool:
    meta = get_transcript(transcript_id)
    if not meta:
        return False
    Path(meta["file_path"]).unlink(missing_ok=True)
    (METADATA_DIR / f"{transcript_id}.json").unlink(missing_ok=True)
    (RESULTS_DIR / f"{transcript_id}.json").unlink(missing_ok=True)
    return True


def list_projects() -> list[str]:
    return [d.name for d in TRANSCRIPTS_DIR.iterdir() if d.is_dir()]


# ── Extraction result helpers ──────────────────────────────────────────────────

def save_extraction_result(transcript_id: str, result: dict):
    path = RESULTS_DIR / f"{transcript_id}.json"
    path.write_text(json.dumps(result, indent=2))


def get_extraction_result(transcript_id: str) -> dict | None:
    path = RESULTS_DIR / f"{transcript_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


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

    # Existing: "Speaker Name: dialogue"
    for match in re.finditer(r"^([A-Z][A-Za-z\s\-\.]{1,40}):", text, re.MULTILINE):
        name = match.group(1).strip()
        if name.lower() not in exclude_patterns:
            names.add(name)

    # Add: "[00:00] Name" format
    for match in re.finditer(r"^\[\d{2}:\d{2}\]\s+([A-Z][A-Za-z\s\-\.]{1,40})$", text, re.MULTILINE):
        name = match.group(1).strip()
        if name.lower() not in exclude_patterns:
            names.add(name)

    # Existing: WebVTT
    for match in re.finditer(r"<v\s+([^>]+)>", text):
        name = match.group(1).strip()
        if name.lower() not in exclude_patterns:
            names.add(name)

    return sorted(names)

def _detect_date(filename: str, text: str) -> str | None:
    """Try to extract a meeting date from filename or transcript content."""
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
def update_transcript_metadata(transcript_id: str, updates: dict):
    meta = get_transcript(transcript_id)
    if not meta:
        return
    meta.update(updates)
    meta_path = METADATA_DIR / f"{transcript_id}.json"
    meta_path.write_text(json.dumps(meta, indent=2))

# ── Session helpers ────────────────────────────────────────────────────────────

def create_session(transcript_ids: list[str]) -> dict:
    session_id = str(uuid.uuid4())
    session = {
        "id": session_id,
        "transcript_ids": transcript_ids,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "history": [],
    }
    path = SESSIONS_DIR / f"{session_id}.json"
    path.write_text(json.dumps(session, indent=2))
    return session


def get_session(session_id: str) -> dict | None:
    path = SESSIONS_DIR / f"{session_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def append_to_session(session_id: str, question: str, answer: str) -> dict | None:
    session = get_session(session_id)
    if not session:
        return None
    session["history"].append({"role": "user", "content": question})
    session["history"].append({"role": "assistant", "content": answer})
    session["updated_at"] = datetime.utcnow().isoformat()
    path = SESSIONS_DIR / f"{session_id}.json"
    path.write_text(json.dumps(session, indent=2))
    return session


def delete_session(session_id: str) -> bool:
    path = SESSIONS_DIR / f"{session_id}.json"
    if not path.exists():
        return False
    path.unlink()
    return True


def list_sessions() -> list[dict]:
    results = []
    for f in SESSIONS_DIR.glob("*.json"):
        try:
            session = json.loads(f.read_text())
            results.append({
                "id": session["id"],
                "transcript_ids": session["transcript_ids"],
                "created_at": session["created_at"],
                "updated_at": session["updated_at"],
                "message_count": len(session["history"]),
            })
        except Exception:
            continue
    return sorted(results, key=lambda s: s["updated_at"], reverse=True)