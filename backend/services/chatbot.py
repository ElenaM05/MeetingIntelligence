import os
import json
import re
from groq import Groq

client = Groq(api_key=os.environ["GROQ_API_KEY"])

CHAT_SYSTEM_PROMPT = """
You are a Meeting Intelligence Assistant. Your job is to answer questions about meeting transcripts accurately and helpfully.

You will be given one or more meeting transcripts, and a conversation history. Answer the user's latest question using only the transcript content provided.

RULES:
- Always cite your answer with the source: mention the meeting filename and quote or reference the specific part of the transcript.
- If the answer involves a specific speaker, name them explicitly.
- If the answer cannot be found in the transcripts, say so clearly — do not make things up.
- For speaker-specific questions (e.g. "What did Alice say about X?"), search carefully for that speaker's lines.
- Keep answers concise but complete.
- Always end your answer with a citation block in this format:

  📎 Source: [filename], [timestamp or speaker line if available]

JSON is NOT required — respond in plain, readable text.
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
        model="llama-3.3-70b-versatile",
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