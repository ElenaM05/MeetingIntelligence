from fastapi import APIRouter, HTTPException, BackgroundTasks
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

router = APIRouter()


class ExtractRequest(BaseModel):
    transcript_ids: list[str]


@router.post("/", summary="Extract decisions and action items from one or more transcripts")
def extract(body: ExtractRequest):
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
            storage.update_transcript_metadata(t["id"], {"speakers": speakers})
        else:
            result = extract_from_multiple(transcripts_data)
            for tid in body.transcript_ids:
                speakers = list({
                    name
                    for d in result.get("decisions", [])
                    for name in d.get("participants", [])
                } | {
                    a["who"]
                    for a in result.get("action_items", [])
                    if a.get("who")
                })
                storage.update_transcript_metadata(tid, {"speakers": speakers})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    result["transcript_ids"] = body.transcript_ids
    for tid in body.transcript_ids:
        storage.save_extraction_result(tid, result)

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
            a.get("who", "Not assigned"),
            a.get("by_when", "Not specified"),
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


@router.get("/{transcript_id}/export/pdf", summary="Export results as PDF")
def export_pdf(transcript_id: str):
    result = storage.get_extraction_result(transcript_id)
    if not result:
        raise HTTPException(status_code=404, detail="No extraction result found.")

    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buffer,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=22,
        textColor=colors.HexColor('#1f4788'),
        spaceAfter=20,
        alignment=1,
    )
    heading2_style = ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=13,
        textColor=colors.HexColor('#1f4788'),
        spaceBefore=16,
        spaceAfter=8,
    )
    meta_style = ParagraphStyle(
        'Meta',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.grey,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        leading=14,
    )
    cell_style = ParagraphStyle(
        'Cell',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
    )
    header_cell_style = ParagraphStyle(
        'HeaderCell',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.whitesmoke,
        fontName='Helvetica-Bold',
    )

    elements = []

    # Title
    elements.append(Paragraph("Meeting Intelligence Report", title_style))
    elements.append(Spacer(1, 0.1 * inch))

    # Metadata
    elements.append(Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M')}", meta_style))
    source = result.get("source_filename") or ", ".join(result.get("transcript_ids", []))
    elements.append(Paragraph(f"<b>Source:</b> {source}", meta_style))
    elements.append(Spacer(1, 0.2 * inch))

    # Divider
    elements.append(Table([['']], colWidths=[7 * inch],
                          style=TableStyle([('LINEBELOW', (0, 0), (-1, -1), 1, colors.HexColor('#1f4788'))])))
    elements.append(Spacer(1, 0.15 * inch))

    # Summary
    if result.get('summary'):
        elements.append(Paragraph("Summary", heading2_style))
        elements.append(Paragraph(result['summary'], body_style))
        elements.append(Spacer(1, 0.1 * inch))

    # Decisions
    decisions = result.get('decisions', [])
    if decisions:
        elements.append(Paragraph(f"Decisions ({len(decisions)})", heading2_style))

        for i, decision in enumerate(decisions, 1):
            elements.append(Paragraph(
                f"<b>{decision.get('id', f'D{i}')}:</b> {decision.get('description', '')}",
                body_style
            ))
            if decision.get('participants'):
                elements.append(Paragraph(
                    f"<i>Participants:</i> {', '.join(decision.get('participants', []))}",
                    cell_style
                ))
            if decision.get('context'):
                elements.append(Paragraph(
                    f"<i>Context:</i> {decision.get('context', '')}",
                    cell_style
                ))
            elements.append(Spacer(1, 0.08 * inch))

        elements.append(Spacer(1, 0.1 * inch))

    # Action Items
    action_items = result.get('action_items', [])
    if action_items:
        elements.append(Paragraph(f"Action Items ({len(action_items)})", heading2_style))

        # Table column widths: Task=3.2in, Owner=1.2in, Deadline=1.1in, Priority=0.8in, Status=0.7in
        col_widths = [3.2 * inch, 1.2 * inch, 1.1 * inch, 0.8 * inch, 0.7 * inch]

        table_data = [[
            Paragraph('Task', header_cell_style),
            Paragraph('Owner', header_cell_style),
            Paragraph('Deadline', header_cell_style),
            Paragraph('Priority', header_cell_style),
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
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1f4788')),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            # Data rows
            ('TOPPADDING', (0, 1), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 7),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f7fa')]),
            # Borders
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#1f4788')),
            # Alignment
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