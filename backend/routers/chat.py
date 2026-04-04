from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import storage
from services.chatbot import chat

router = APIRouter()


class StartSessionRequest(BaseModel):
    transcript_ids: list[str]


class AskRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    history: list[dict]


@router.post("/session", summary="Start a new chat session for given transcripts")
def start_session(body: StartSessionRequest):
    """
    Creates a new chat session tied to one or more transcripts.
    Returns a session_id to use for all subsequent questions.
    """
    if not body.transcript_ids:
        raise HTTPException(status_code=400, detail="No transcript IDs provided.")

    for tid in body.transcript_ids:
        if not storage.get_transcript(tid):
            raise HTTPException(status_code=404, detail=f"Transcript '{tid}' not found.")

    session = storage.create_session(body.transcript_ids)
    return {
        "session_id": session["id"],
        "transcript_ids": session["transcript_ids"],
        "created_at": session["created_at"],
    }


@router.post("/session/{session_id}/ask", summary="Ask a question in an existing session")
def ask(session_id: str, body: AskRequest) -> ChatResponse:
    """
    Ask a question within an existing session.
    History is maintained server-side — just send your question.
    """
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    session = storage.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Start a new session first.")

    transcripts = []
    for tid in session["transcript_ids"]:
        meta = storage.get_transcript(tid)
        text = storage.get_transcript_text(tid)
        if not meta or not text:
            raise HTTPException(status_code=404, detail=f"Transcript '{tid}' not found.")
        transcripts.append({"filename": meta["filename"], "text": text})

    try:
        result = chat(
            transcripts=transcripts,
            history=session["history"],
            question=body.question,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    updated_session = storage.append_to_session(session_id, body.question, result["answer"])

    return ChatResponse(
        session_id=session_id,
        answer=result["answer"],
        history=updated_session["history"],
    )


@router.get("/session/{session_id}", summary="Get session history")
def get_session(session_id: str):
    session = storage.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


@router.delete("/session/{session_id}", summary="Delete a session")
def delete_session(session_id: str):
    deleted = storage.delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"deleted": True, "session_id": session_id}


@router.get("/sessions", summary="List all sessions")
def list_sessions():
    return storage.list_sessions()