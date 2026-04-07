from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Depends
from typing import Annotated
from pydantic import BaseModel
import storage
from auth_utils import get_current_user
from services.extractor import extract_from_transcript

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB per file

class RenameProjectRequest(BaseModel):
    old_name: str
    new_name: str
 
 
@router.patch("/project/rename", summary="Rename a project")
async def rename_project(
    body: RenameProjectRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]
    old_name = body.old_name.strip()
    new_name = body.new_name.strip()
 
    if not new_name:
        raise HTTPException(status_code=400, detail="New project name cannot be empty.")
    if old_name == new_name:
        return {"updated": 0}
 
    col = await storage.get_collection("transcripts")
    result = await col.update_many(
        {"user_id": user_id, "project": old_name},
        {"$set": {"project": new_name}},
    )
    return {"updated": result.modified_count}
 
 
@router.delete("/project/{project_name}", summary="Delete a project and all its transcripts")
async def delete_project(
    project_name: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]
 
    # Find all transcript IDs in this project
    col = await storage.get_collection("transcripts")
    cursor = col.find({"user_id": user_id, "project": project_name}, {"_id": 1})
    transcript_ids = [doc["_id"] async for doc in cursor]
 
    if not transcript_ids:
        raise HTTPException(status_code=404, detail="Project not found.")
 
    # Delete transcripts
    await col.delete_many({"_id": {"$in": transcript_ids}, "user_id": user_id})
 
    # Delete associated extraction results, sentiment results, sessions
    ex_col   = await storage.get_collection("extraction_results")
    sent_col = await storage.get_collection("sentiment_results")
    await ex_col.delete_many({"transcript_id": {"$in": transcript_ids}})
    await sent_col.delete_many({"transcript_id": {"$in": transcript_ids}})
 
    return {"deleted": len(transcript_ids)}
 

@router.post("/upload", summary="Upload and auto-extract transcript files")
async def upload_transcripts(
    files: Annotated[list[UploadFile], File(description="One or more .txt or .vtt transcript files")],
    project: Annotated[str, Form(description="Project or meeting group name")] = "default",
    current_user: dict = Depends(get_current_user),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    user_id = current_user["id"]
    results = []
    errors = []

    for file in files:
        try:
            content = await file.read()

            if len(content) > MAX_FILE_SIZE:
                errors.append({"filename": file.filename, "error": "File exceeds 10 MB limit."})
                continue

            # Save transcript to MongoDB
            metadata = await storage.save_transcript(
                user_id=user_id,
                project=project,
                filename=file.filename,
                content=content,
            )
            transcript_id = metadata["id"]

            # Auto-extract immediately
            try:
                text = content.decode("utf-8", errors="replace")
                extraction = extract_from_transcript(text, file.filename)
                extraction["source_transcript_id"] = transcript_id
                extraction["source_filename"] = file.filename
                extraction["transcript_ids"] = [transcript_id]

                # Update speakers from extraction
                speakers = list({
                    name
                    for d in extraction.get("decisions", [])
                    for name in d.get("participants", [])
                } | {
                    a["who"]
                    for a in extraction.get("action_items", [])
                    if a.get("who")
                })
                if speakers:
                    await storage.update_transcript_metadata(transcript_id, {"speakers": speakers}, user_id)
                    metadata["speakers"] = speakers

                await storage.save_extraction_result(transcript_id, user_id, extraction)
                metadata["extraction"] = extraction

            except Exception as e:
                # Upload succeeded but extraction failed — not fatal
                metadata["extraction_error"] = str(e)

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
async def list_transcripts(
    project: Annotated[str | None, Query(description="Filter by project name")] = None,
    current_user: dict = Depends(get_current_user),
):
    transcripts = await storage.list_transcripts(user_id=current_user["id"], project=project)
    return {"transcripts": transcripts, "total": len(transcripts)}


@router.get("/projects", summary="List all project names")
async def list_projects(current_user: dict = Depends(get_current_user)):
    return {"projects": await storage.list_projects(current_user["id"])}


@router.get("/{transcript_id}", summary="Get metadata for a single transcript")
async def get_transcript(
    transcript_id: str,
    current_user: dict = Depends(get_current_user),
):
    meta = await storage.get_transcript(transcript_id, current_user["id"])
    if not meta:
        raise HTTPException(status_code=404, detail="Transcript not found.")
    return meta


@router.get("/{transcript_id}/text", summary="Get the raw text of a transcript")
async def get_transcript_text(
    transcript_id: str,
    current_user: dict = Depends(get_current_user),
):
    text = await storage.get_transcript_text(transcript_id, current_user["id"])
    if text is None:
        raise HTTPException(status_code=404, detail="Transcript not found.")
    return {"transcript_id": transcript_id, "text": text}


@router.delete("/{transcript_id}", summary="Delete a transcript and its results")
async def delete_transcript(
    transcript_id: str,
    current_user: dict = Depends(get_current_user),
):
    deleted = await storage.delete_transcript(transcript_id, current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Transcript not found.")
    return {"deleted": True, "transcript_id": transcript_id}