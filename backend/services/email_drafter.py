import os
import json
import re
from cerebras.cloud.sdk import Cerebras

client = Cerebras(api_key=os.environ["CEREBRAS_API_KEY"])

EMAIL_SYSTEM_PROMPT = """
You are an executive assistant. Given a meeting's decisions and action items, write a professional follow-up email.

You MUST respond with valid JSON only — no preamble, no markdown, no explanation.

Return this exact structure:
{
  "subject": "Follow-up: [meeting topic]",
  "body": "Full email body text"
}

Rules:
- Subject should be concise and specific to the meeting topic.
- Email should open with a brief summary of what was discussed.
- List all decisions clearly.
- List all action items with owner and deadline.
- Close professionally.
- Use plain text — no HTML, no markdown.
- Keep it concise and professional.
- JSON only. No extra text.
""".strip()


def draft_followup_email(extraction_result: dict) -> dict:
    summary = extraction_result.get("summary", "")
    decisions = extraction_result.get("decisions", [])
    action_items = extraction_result.get("action_items", [])
    source = extraction_result.get("source_filename", "the meeting")

    decisions_text = "\n".join(
        f"- {d.get('description', '')}" for d in decisions
    ) or "None"

    action_items_text = "\n".join(
        f"- {a.get('what', '')} | Owner: {a.get('who', 'Unassigned')} | Due: {a.get('by_when', 'Not specified')} | Priority: {a.get('priority', 'medium')}"
        for a in action_items
    ) or "None"

    user_message = f"""Meeting: {source}

Summary:
{summary}

Decisions:
{decisions_text}

Action Items:
{action_items_text}

Draft a follow-up email for this meeting."""

    message = client.chat.completions.create(
        model="qwen-3-235b-a22b-instruct-2507",
        max_tokens=1024,
        messages=[
            {"role": "system", "content": EMAIL_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )

    raw = message.choices[0].message.content.strip()
    raw = message.choices[0].message.content.strip()

    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        raise ValueError(f"LLM did not return valid JSON. Got: {raw[:300]}")

    return json.loads(match.group(0))

