import os
import json
import re
from cerebras.cloud.sdk import Cerebras
client = Cerebras(api_key=os.environ["CEREBRAS_API_KEY"])
CHAT_SYSTEM_PROMPT = """
You are a Meeting Intelligence Assistant. Your job is to answer questions about meeting transcripts accurately and helpfully.

You will be given one or more meeting transcripts, and a conversation history. Answer the user's latest question using only the transcript content provided.

RULES:
- Always cite your answer with the source: mention the meeting filename and reference the specific part of the transcript.
- If the answer involves a specific speaker, name them explicitly.
- If the answer cannot be found in the transcripts, say so clearly — do not make things up.
- For speaker-specific questions (e.g. "What did Alice say about X?"), search carefully for that speaker's lines.
- Keep answers concise but complete.
- Always end your answer with a citation in this format:

  Source: [filename], [timestamp or speaker line if available]

COUNTING AND REASONING RULES — FOLLOW THESE STRICTLY:
- Before answering any question that involves counting, listing, or comparing (e.g. "who has the most", "how many", "list all"), first enumerate every single relevant item explicitly.
- Never state a count or conclusion before you have listed all the items.
- After listing, count the items per person/category carefully.
- Then and only then, state your final answer.
- Do not guess or infer items that are not explicitly stated in the transcript — only count what is directly written.
- If you catch yourself about to say "implied" or "suggested" for an item, do not count it.
- Never self-correct or revise a count mid-answer. If you are not certain, recount silently before writing anything.
- Never output phrases like "actually", "wait", "let me revise", "correction", or "upon reflection".

FORMATTING RULES:
- Do not use emojis anywhere in your response.
- Do not use bold text (**word**) for emphasis — use plain text only.
- Use plain dashes (-) for bullet points.
- Keep responses clean and minimal — no decorative punctuation or symbols.
- For citations, write "Source:" not "📎 Source:" or "📌 Note:".
""".strip()
def build_transcript_context(transcripts: list[dict]) -> str:
    """
    Build a single context string from multiple transcripts.
    Each transcript is labelled with its filename.
    """
    parts = []
    for t in transcripts:
        parts.append(f"=== TRANSCRIPT: {t['filename']} ===\n{t['text']}\n")
    return "\n".join(parts)


def chat(
    transcripts: list[dict],
    history: list[dict],
    question: str,
) -> dict:
    """
    Send a question to the chatbot with full transcript context and conversation history.

    Args:
        transcripts: list of dicts with 'filename' and 'text'
        history: list of prior messages [{"role": "user"|"assistant", "content": "..."}]
        question: the user's latest question

    Returns:
        dict with 'answer' and updated 'history'
    """
    transcript_context = build_transcript_context(transcripts)
    system_message = f"{CHAT_SYSTEM_PROMPT}\n\n--- TRANSCRIPTS ---\n{transcript_context}"

    messages = [
        *history,
        {"role": "user", "content": question},
    ]

    response = client.chat.completions.create(
        model="qwen-3-235b-a22b-instruct-2507",
        max_tokens=1024,
        messages=[
            {"role": "system", "content": system_message},
            *messages,
        ],
    )

    answer = response.choices[0].message.content.strip()

    updated_history = [
        *history,
        {"role": "user", "content": question},
        {"role": "assistant", "content": answer},
    ]

    return {
        "answer": answer,
        "history": updated_history,
    }