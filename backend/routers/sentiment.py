from fastapi import APIRouter, HTTPException, Depends
import storage
from services.sentiment_analyzer import analyze_sentiment
from auth_utils import get_current_user

router = APIRouter()


@router.get("/{transcript_id}", summary="Get sentiment analysis for a transcript")
async def get_sentiment(
    transcript_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]

    # Return cached result if available
    cached = await storage.get_sentiment_result(transcript_id, user_id)
    if cached:
        return cached

    # Load transcript
    meta = await storage.get_transcript(transcript_id, user_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Transcript not found.")

    text = await storage.get_transcript_text(transcript_id, user_id)
    if not text:
        raise HTTPException(status_code=404, detail="Transcript text not found.")

    try:
        result = analyze_sentiment(text, meta.get("filename", transcript_id))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    result["transcript_id"] = transcript_id
    result["source_filename"] = meta.get("filename", transcript_id)

    await storage.save_sentiment_result(transcript_id, user_id, result)
    return result


@router.delete("/{transcript_id}", summary="Clear cached sentiment result")
async def clear_sentiment(
    transcript_id: str,
    current_user: dict = Depends(get_current_user),
):
    await storage.delete_sentiment_result(transcript_id, current_user["id"])
    return {"success": True}