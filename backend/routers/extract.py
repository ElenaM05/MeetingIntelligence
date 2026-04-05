from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import csv
import io
import json
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
import storage
from services.extractor import extract_from_transcript, extract_from_multiple
from services.email_drafter import draft_followup_email
from auth_utils import get_current_user

router = APIRouter()


class ExtractRequest(BaseModel):
    transcript_ids: list[str]


@router.post("/", summary="Extract decisions and action items from one or more transcripts")
async def extract(
    body: ExtractRequest,
    current_user: dict = Depends(get_current_user),
):
    if not body.transcript_ids:
        raise HTTPException(status_code=400, detail="No transcript IDs provided.")

    user_id = current_user["id"]
    transcripts_data = []
    for tid in body.transcript_ids:
        meta = await storage.get_transcript(tid, user_id)
        if not meta:
            raise HTTPException(status_code=404, detail=f"Transcript '{tid}' not found.")
        text = await storage.get_transcript_text(tid, user_id)
        if not text:
            raise HTTPException(status_code=404, detail=f"Transcript text for '{tid}' not found.")
        transcripts_data.append({"id": tid, "filename": meta["filename"], "text": text})

    try:
        if len(transcripts_data) == 1:
            t = transcripts_data[0]
            result = extract_from_transcript(t["text"], t["filename"])
            result["source_transcript_id"] = t["id"]
            result["source_filename"] = t["filename"]
            speakers = list({
                name
                for d in result.get("decisions", [])
                for name in d.get("participants", [])
            } | {
                a["who"]
                for a in result.get("action_items", [])
                if a.get("who")
            })
            await storage.update_transcript_metadata(t["id"], {"speakers": speakers}, user_id)
        else:
            result = extract_from_multiple(transcripts_data)
            speakers = list({
                name
                for d in result.get("decisions", [])
                for name in d.get("participants", [])
            } | {
                a["who"]
                for a in result.get("action_items", [])
                if a.get("who")
            })
            for tid in body.transcript_ids:
                await storage.update_transcript_metadata(tid, {"speakers": speakers}, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    result["transcript_ids"] = body.transcript_ids
    for tid in body.transcript_ids:
        await storage.save_extraction_result(tid, user_id, result)

    return result


@router.get("/{transcript_id}", summary="Get cached extraction result for a transcript")
async def get_result(
    transcript_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = await storage.get_extraction_result(transcript_id, current_user["id"])
    if not result:
        raise HTTPException(
            status_code=404,
            detail="No extraction result found. Run POST /api/extract first.",
        )
    return result


@router.get("/{transcript_id}/draft-email", summary="Generate a follow-up email draft")
async def get_email_draft(
    transcript_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = await storage.get_extraction_result(transcript_id, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="No extraction result found. Run extraction first.")

    try:
        email = draft_followup_email(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"subject": email["subject"], "body": email["body"]}


@router.get("/{transcript_id}/export/csv", summary="Export action items as CSV")
async def export_csv(
    transcript_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = await storage.get_extraction_result(transcript_id, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="No extraction result found.")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Type", "ID", "Description / Task", "Who", "By When", "Priority", "Status", "Source"])

    for d in result.get("decisions", []):
        writer.writerow([
            "Decision", d.get("id", ""), d.get("description", ""),
            ", ".join(d.get("participants", [])), "", "", "", d.get("source_filename", ""),
        ])

    for a in result.get("action_items", []):
        writer.writerow([
            "Action Item", a.get("id", ""), a.get("what", ""),
            a.get("who", "Not assigned"), a.get("by_when", "Not specified"),
            a.get("priority", ""), a.get("status", "open"), a.get("source_filename", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=extraction_{transcript_id}.csv"},
    )


@router.get("/{transcript_id}/export/json", summary="Export full result as JSON")
async def export_json(
    transcript_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = await storage.get_extraction_result(transcript_id, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="No extraction result found.")

    return StreamingResponse(
        iter([json.dumps(result, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=extraction_{transcript_id}.json"},
    )


@router.get("/{transcript_id}/export/pdf", summary="Export results as PDF")
async def export_pdf(
    transcript_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = await storage.get_extraction_result(transcript_id, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="No extraction result found.")

    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buffer, pagesize=letter,
        rightMargin=0.75 * inch, leftMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=22,
                                  textColor=colors.HexColor('#1f4788'), spaceAfter=20, alignment=1)
    heading2_style = ParagraphStyle('CustomHeading2', parent=styles['Heading2'], fontSize=13,
                                     textColor=colors.HexColor('#1f4788'), spaceBefore=16, spaceAfter=8)
    meta_style = ParagraphStyle('Meta', parent=styles['Normal'], fontSize=9, textColor=colors.grey, spaceAfter=4)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, spaceAfter=6, leading=14)
    cell_style = ParagraphStyle('Cell', parent=styles['Normal'], fontSize=9, leading=12)
    header_cell_style = ParagraphStyle('HeaderCell', parent=styles['Normal'], fontSize=10,
                                        textColor=colors.whitesmoke, fontName='Helvetica-Bold')

    elements = []
    elements.append(Paragraph("Meeting Intelligence Report", title_style))
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M')}", meta_style))
    source = result.get("source_filename") or ", ".join(result.get("transcript_ids", []))
    elements.append(Paragraph(f"<b>Source:</b> {source}", meta_style))
    elements.append(Spacer(1, 0.2 * inch))
    elements.append(Table([['']], colWidths=[7 * inch],
                           style=TableStyle([('LINEBELOW', (0, 0), (-1, -1), 1, colors.HexColor('#1f4788'))])))
    elements.append(Spacer(1, 0.15 * inch))

    if result.get('summary'):
        elements.append(Paragraph("Summary", heading2_style))
        elements.append(Paragraph(result['summary'], body_style))
        elements.append(Spacer(1, 0.1 * inch))

    decisions = result.get('decisions', [])
    if decisions:
        elements.append(Paragraph(f"Decisions ({len(decisions)})", heading2_style))
        for i, decision in enumerate(decisions, 1):
            elements.append(Paragraph(
                f"<b>{decision.get('id', f'D{i}')}:</b> {decision.get('description', '')}", body_style))
            if decision.get('participants'):
                elements.append(Paragraph(
                    f"<i>Participants:</i> {', '.join(decision.get('participants', []))}", cell_style))
            if decision.get('context'):
                elements.append(Paragraph(f"<i>Context:</i> {decision.get('context', '')}", cell_style))
            elements.append(Spacer(1, 0.08 * inch))
        elements.append(Spacer(1, 0.1 * inch))

    action_items = result.get('action_items', [])
    if action_items:
        elements.append(Paragraph(f"Action Items ({len(action_items)})", heading2_style))
        col_widths = [3.2 * inch, 1.2 * inch, 1.1 * inch, 0.8 * inch, 0.7 * inch]
        table_data = [[
            Paragraph('Task', header_cell_style), Paragraph('Owner', header_cell_style),
            Paragraph('Deadline', header_cell_style), Paragraph('Priority', header_cell_style),
            Paragraph('Status', header_cell_style),
        ]]
        for item in action_items:
            priority = item.get('priority', 'medium').upper()
            priority_colors = {'HIGH': '#c0392b', 'MEDIUM': '#e67e22', 'LOW': '#27ae60'}
            priority_color = priority_colors.get(priority, '#333333')
            table_data.append([
                Paragraph(item.get('what', ''), cell_style),
                Paragraph(item.get('who', 'Not assigned'), cell_style),
                Paragraph(item.get('by_when', 'Not specified'), cell_style),
                Paragraph(f'<font color="{priority_color}"><b>{priority}</b></font>', cell_style),
                Paragraph(item.get('status', 'open').upper(), cell_style),
            ])
        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1f4788')),
            ('TOPPADDING', (0, 0), (-1, 0), 10), ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 7), ('BOTTOMPADDING', (0, 1), (-1, -1), 7),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f7fa')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#1f4788')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(table)

    doc.build(elements)
    pdf_buffer.seek(0)

    return StreamingResponse(
        iter([pdf_buffer.getvalue()]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=extraction_{transcript_id}.pdf"},
    )


class UpdateActionItemRequest(BaseModel):
    status: str


@router.patch("/{transcript_id}/action-items/{item_id}", summary="Update action item status")
async def update_action_item_status(
    transcript_id: str,
    item_id: str,
    body: UpdateActionItemRequest,
    current_user: dict = Depends(get_current_user),
):
    result = await storage.get_extraction_result(transcript_id, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="No extraction result found.")

    updated = False
    for item in result.get("action_items", []):
        if item["id"] == item_id:
            item["status"] = body.status
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Action item not found.")

    await storage.save_extraction_result(transcript_id, current_user["id"], result)
    return {"success": True, "item_id": item_id, "status": body.status}