import os
import json
import re
from cerebras.cloud.sdk import Cerebras

# Singleton client — Cerebras recommends not reconstructing on every call
client = Cerebras(api_key=os.environ["CEREBRAS_API_KEY"])

EXTRACTION_SYSTEM_PROMPT = """
You are a meeting analyst. Your job is to carefully read meeting transcripts and extract structured information.

You MUST respond with valid JSON only — no preamble, no markdown, no explanation.

Return this exact structure:
{
  "decisions": [
    {
      "id": "d1",
      "description": "Clear description of what was decided",
      "context": "Brief reasoning or discussion that led to this decision",
      "participants": ["Name1", "Name2"]
    }
  ],
  "action_items": [
    {
      "id": "a1",
      "what": "Clear description of the task",
      "who": "Full name of the person responsible",
      "by_when": "Deadline or 'Not specified'",
      "priority": "high | medium | low",
      "status": "open"
    }
  ],
  "summary": "2-3 sentence overall meeting summary"
}

Rules:
- Decisions: things the group agreed on, resolved, or confirmed.
- Action items: specific tasks assigned to a named individual.
- If no deadline is mentioned for an action item, use "Not specified".
- Priority is your best inference from context (urgency, importance of the topic).
- Extract ALL decisions and action items — do not skip any.
- If there are none, return empty arrays.
- JSON only. No extra text.
""".strip()


def extract_from_transcript(text: str, filename: str) -> dict:
    """
    Call the Cerebras API to extract decisions and action items from a transcript.
    Returns the parsed extraction result.
    """
    user_message = f"Transcript filename: {filename}\n\n---\n\n{text[:40000]}"

    message = client.chat.completions.create(
        model="gpt-oss-120b",
        max_tokens=4096,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )

    raw = message.choices[0].message.content.strip()

    clean = re.sub(r"^```(?:json)?\s*", "", raw)
    clean = re.sub(r"\s*```$", "", clean).strip()

    result = json.loads(clean)

    result.setdefault("decisions", [])
    result.setdefault("action_items", [])
    result.setdefault("summary", "")

    return result


def extract_from_multiple(transcripts: list[dict]) -> dict:
    """
    Extract decisions and action items across multiple transcripts.
    Each item in `transcripts` should have: id, filename, text.
    Returns merged result with source references.
    """
    all_decisions = []
    all_action_items = []
    summaries = []

    for t in transcripts:
        result = extract_from_transcript(t["text"], t["filename"])

        for d in result.get("decisions", []):
            d["source_transcript_id"] = t["id"]
            d["source_filename"] = t["filename"]
            all_decisions.append(d)

        for a in result.get("action_items", []):
            a["source_transcript_id"] = t["id"]
            a["source_filename"] = t["filename"]
            all_action_items.append(a)

        if result.get("summary"):
            summaries.append(f"[{t['filename']}] {result['summary']}")

    return {
        "decisions": all_decisions,
        "action_items": all_action_items,
        "summary": " | ".join(summaries),
        "stats": {
            "transcripts_processed": len(transcripts),
            "total_decisions": len(all_decisions),
            "total_action_items": len(all_action_items),
        },
    }