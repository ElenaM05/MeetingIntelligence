from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import Annotated
import storage

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB per file


@router.post("/upload", summary="Upload one or more transcript files")
async def upload_transcripts(
    files: Annotated[list[UploadFile], File(description="One or more .txt or .vtt transcript files")],
    project: Annotated[str, Form(description="Project or meeting group name")] = "default",
):
    """
    Upload transcript files (.txt or .vtt).
    Returns metadata for each uploaded file including detected speakers,
    word count, and meeting date.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    results = []
    errors = []

    for file in files:
        try:
            content = await file.read()

            if len(content) > MAX_FILE_SIZE:
                errors.append({"filename": file.filename, "error": "File exceeds 10 MB limit."})
                continue

            metadata = storage.save_transcript(
                project=project,
                filename=file.filename,
                content=content,
            )
            results.append(metadata)

        except ValueError as e:
            errors.append({"filename": file.filename, "error": str(e)})
        except Exception as e:
            errors.append({"filename": file.filename, "error": f"Unexpected error: {str(e)}"})

    return {
        "uploaded": results,
        "errors": errors,
        "summary": {
            "total_uploaded": len(results),
            "total_failed": len(errors),
            "project": project,
        },
    }


@router.get("/", summary="List transcripts, optionally filtered by project")
def list_transcripts(
    project: Annotated[str | None, Query(description="Filter by project name")] = None,
):
    transcripts = storage.list_transcripts(project=project)
    return {"transcripts": transcripts, "total": len(transcripts)}


@router.get("/projects", summary="List all project names")
def list_projects():
    return {"projects": storage.list_projects()}


@router.get("/{transcript_id}", summary="Get metadata for a single transcript")
def get_transcript(transcript_id: str):
    meta = storage.get_transcript(transcript_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Transcript not found.")
    return meta


@router.get("/{transcript_id}/text", summary="Get the raw text of a transcript")
def get_transcript_text(transcript_id: str):
    text = storage.get_transcript_text(transcript_id)
    if text is None:
        raise HTTPException(status_code=404, detail="Transcript not found.")
    return {"transcript_id": transcript_id, "text": text}


@router.delete("/{transcript_id}", summary="Delete a transcript and its results")
def delete_transcript(transcript_id: str):
    deleted = storage.delete_transcript(transcript_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Transcript not found.")
    return {"deleted": True, "transcript_id": transcript_id}
