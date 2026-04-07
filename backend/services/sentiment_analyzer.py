import os, json, re
from cerebras.cloud.sdk import Cerebras

client = Cerebras(api_key=os.environ["CEREBRAS_API_KEY"])

SENTIMENT_PROMPT = """
You are an expert meeting analyst. Analyze the transcript and return a detailed sentiment analysis.

You MUST respond with valid JSON only — no preamble, no markdown, no explanation.

Return this exact structure:
{
  "overall_vibe": "positive" | "negative" | "neutral" | "mixed",
  "overall_score": <float -1.0 to 1.0>,
  "summary": "<2-3 sentence vibe summary>",
  "highlights": {
    "most_positive_moment": "<brief description>",
    "most_tense_moment": "<brief description or null>",
    "turning_point": "<brief description or null>"
  },
  "segments": [
    {
      "id": "<seg_1, seg_2, ...>",
      "label": "<e.g. '0:00–5:00' or 'Opening' etc>",
      "sentiment": "enthusiasm" | "agreement" | "conflict" | "frustration" | "uncertainty" | "neutral",
      "score": <float -1.0 to 1.0>,
      "intensity": <float 0.0 to 1.0>,
      "summary": "<one sentence>",
      "transcript_excerpt": "<verbatim 1-3 sentence excerpt from transcript>"
    }
  ],
  "speakers": [
    {
      "name": "<speaker name>",
      "overall_sentiment": "enthusiasm" | "agreement" | "conflict" | "frustration" | "uncertainty" | "neutral",
      "score": <float -1.0 to 1.0>,
      "dominance": <float 0.0 to 1.0>,
      "key_trait": "<e.g. 'Consistently supportive'>",
      "moments": [
        {
          "sentiment": "enthusiasm" | "agreement" | "conflict" | "frustration" | "uncertainty" | "neutral",
          "quote": "<short verbatim quote>"
        }
      ]
    }
  ],
  "emotion_arc": [
    { "position": <0.0 to 1.0>, "score": <float -1.0 to 1.0>, "label": "<short label>" }
  ]
}
Rules:
- Divide transcript into 4-8 meaningful segments based on topic shifts
- Identify all named speakers
- emotion_arc should have 8-12 points
- transcript_excerpt must be verbatim text
- JSON only, no extra text
""".strip()


def extract_json(s: str) -> str | None:
    """Extract the outermost balanced JSON object."""
    depth, start = 0, None
    for i, ch in enumerate(s):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                return s[start:i + 1]
    return None


def analyze_sentiment(transcript_text: str, filename: str = "transcript") -> dict:
    max_chars = 12000
    text = transcript_text[:max_chars]
    if len(transcript_text) > max_chars:
        text += "\n\n[Transcript truncated for analysis]"

    message = client.chat.completions.create(
        model="qwen-3-235b-a22b-instruct-2507",
        max_tokens=4000,
        messages=[
            {"role": "system", "content": SENTIMENT_PROMPT},
            {"role": "user", "content": f"Analyze this transcript:\n\n{text}"},  # Bug 1 fixed
        ],
    )

    raw = message.choices[0].message.content.strip()

    # Bug 3: strip Qwen-3 thinking blocks before parsing
    raw = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL).strip()

    # Bug 2: use balanced-brace extractor, not greedy regex
    json_str = extract_json(raw)
    if not json_str:
        raise ValueError(f"No JSON object found in response: {raw[:300]}")

    return json.loads(json_str)