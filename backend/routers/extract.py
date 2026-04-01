from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Annotated
import csv
import io
import json
import storage
from services.extractor import extract_from_transcript, extract_from_multiple

router = APIRouter()


class ExtractRequest(BaseModel):
    transcript_ids: list[str]


class ExportFormat(str):
    pass


@router.post("/", summary="Extract decisions and action items from one or more transcripts")
def extract(body: ExtractRequest):
    """
    Accepts a list of transcript IDs.
    Calls the Anthropic API to extract decisions and action items.
    Caches the result and returns it.
    """
    if not body.transcript_ids:
        raise HTTPException(status_code=400, detail="No transcript IDs provided.")

    transcripts_data = []
    for tid in body.transcript_ids:
        meta = storage.get_transcript(tid)
        if not meta:
            raise HTTPException(status_code=404, detail=f"Transcript '{tid}' not found.")
        text = storage.get_transcript_text(tid)
        if not text:
            raise HTTPException(status_code=404, detail=f"Transcript text for '{tid}' not found.")
        transcripts_data.append({"id": tid, "filename": meta["filename"], "text": text})

    if len(transcripts_data) == 1:
        t = transcripts_data[0]
        result = extract_from_transcript(t["text"], t["filename"])
        result["source_transcript_id"] = t["id"]
        speakers = list({
            name
            for d in result.get("decisions", [])
            for name in d.get("participants", [])
        } | {
            a["who"]
            for a in result.get("action_items", [])
            if a.get("who")
        })

        storage.update_transcript_metadata(t["id"], {"speakers": speakers})
    else:
        result = extract_from_multiple(transcripts_data)

    result["transcript_ids"] = body.transcript_ids
    storage.save_extraction_result(body.transcript_ids[0], result)

    return result


@router.get("/{transcript_id}", summary="Get cached extraction result for a transcript")
def get_result(transcript_id: str):
    result = storage.get_extraction_result(transcript_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail="No extraction result found. Run POST /api/extract first.",
        )
    return result


@router.get("/{transcript_id}/export/csv", summary="Export action items as CSV")
def export_csv(transcript_id: str):
    result = storage.get_extraction_result(transcript_id)
    if not result:
        raise HTTPException(status_code=404, detail="No extraction result found.")

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Type", "ID", "Description / Task", "Who", "By When", "Priority", "Status", "Source"])

    for d in result.get("decisions", []):
        writer.writerow([
            "Decision",
            d.get("id", ""),
            d.get("description", ""),
            ", ".join(d.get("participants", [])),
            "",
            "",
            "",
            d.get("source_filename", ""),
        ])

    for a in result.get("action_items", []):
        writer.writerow([
            "Action Item",
            a.get("id", ""),
            a.get("what", ""),
            a.get("who", ""),
            a.get("by_when", ""),
            a.get("priority", ""),
            a.get("status", "open"),
            a.get("source_filename", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=extraction_{transcript_id}.csv"},
    )


@router.get("/{transcript_id}/export/json", summary="Export full result as JSON")
def export_json(transcript_id: str):
    result = storage.get_extraction_result(transcript_id)
    if not result:
        raise HTTPException(status_code=404, detail="No extraction result found.")

    return StreamingResponse(
        iter([json.dumps(result, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=extraction_{transcript_id}.json"},
    )
