from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import storage
from services.chatbot import chat
from auth_utils import get_current_user

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
async def start_session(
    body: StartSessionRequest,
    current_user: dict = Depends(get_current_user)
):
    if not body.transcript_ids:
        raise HTTPException(status_code=400, detail="No transcript IDs provided.")

    user_id = current_user["id"]
    for tid in body.transcript_ids:
        if not await storage.get_transcript(tid, user_id):
            raise HTTPException(status_code=404, detail=f"Transcript '{tid}' not found.")

    session = await storage.create_session(user_id, body.transcript_ids)
    return {
        "session_id": session["id"],
        "transcript_ids": session["transcript_ids"],
        "created_at": session["created_at"],
    }


@router.post("/session/{session_id}/ask", summary="Ask a question in an existing session")
async def ask(
    session_id: str,
    body: AskRequest,
    current_user: dict = Depends(get_current_user)
) -> ChatResponse:
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    user_id = current_user["id"]
    session = await storage.get_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    transcripts = []
    for tid in session["transcript_ids"]:
        meta = await storage.get_transcript(tid, user_id)
        text = await storage.get_transcript_text(tid, user_id)
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

    updated_session = await storage.append_to_session(session_id, user_id, body.question, result["answer"])

    return ChatResponse(
        session_id=session_id,
        answer=result["answer"],
        history=updated_session["history"],
    )


@router.get("/session/{session_id}", summary="Get session history")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    session = await storage.get_session(session_id, current_user["id"])
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


@router.delete("/session/{session_id}", summary="Delete a session")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    deleted = await storage.delete_session(session_id, current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"deleted": True, "session_id": session_id}


@router.get("/sessions", summary="List all sessions")
async def list_sessions(current_user: dict = Depends(get_current_user)):
    return await storage.list_sessions(current_user["id"])