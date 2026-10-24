"""Retrieve Karnataka scheme information and answer a single chat request."""

import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
TEXT_MODEL = os.environ.get("CHATBOT_MODEL", "openai/gpt-4o-mini")
TOKEN_PATTERN = re.compile(r"[^\W_]+", re.UNICODE)
STOP_WORDS = {
    "a", "an", "and", "are", "about", "can", "do", "for", "from", "how",
    "i", "in", "is", "it", "me", "my", "of", "on", "or", "the", "to",
    "what", "when", "where", "which", "who", "with", "you", "your",
}
SYSTEM_PROMPT = """You are a Karnataka government schemes assistant.
- Answer scheme questions only from the supplied scheme context; never guess.
- If the context does not answer the question, say so and direct the user to
  sevasindhu.karnataka.gov.in or the relevant official scheme source.
- Reply in the user's language and script (English, Kannada, or Kanglish).
- Name schemes and cite their source links when available.
- Be concise. Do not invent amounts, deadlines, eligibility rules, or helpline numbers.
- Say "you may qualify; confirm at the official portal" rather than deciding eligibility.
- Never request Aadhaar, bank, or income-proof details. Do not fill or submit forms.
- Give offline options such as CSC/Grama One or a taluk office when relevant.
- Make clear that information is not an official decision. Refuse fraud requests.
- For unrelated questions, politely explain that you can help with government schemes.
"""


def as_text(value):
    if value is None:
        return ""
    if isinstance(value, (list, tuple, set)):
        return "; ".join(filter(None, (as_text(item) for item in value)))
    if isinstance(value, dict):
        return "; ".join(
            f"{key}: {as_text(item)}" for key, item in value.items() if as_text(item)
        )
    return str(value).strip()


def first_value(scheme, *keys):
    for key in keys:
        value = as_text(scheme.get(key))
        if value:
            return value
    return ""


def scheme_chunks(schemes):
    chunks = []
    for scheme in schemes:
        if not isinstance(scheme, dict):
            continue
        name = first_value(
            scheme, "scheme_name", "schemeName", "title", "scheme_title",
            "name_en", "name",
        ) or "Unknown Scheme"
        source_url = first_value(
            scheme, "source_url", "scheme_url", "schemeUrl", "url",
        )
        fields = (
            ("summary", ("summary", "objective", "benefits", "description", "overview")),
            ("eligibility", ("eligibility", "eligibility_criteria", "eligibilityCriteria")),
            ("documents required", ("documents", "documents_required", "required_documents")),
            ("how to apply", ("how_to_apply", "application_process", "process")),
            ("category", ("category", "categories", "scheme_category", "scheme_type")),
        )
        for label, keys in fields:
            text = first_value(scheme, *keys)
            if text:
                chunks.append({
                    "name": name,
                    "source_url": source_url,
                    "field": label,
                    "text": text,
                })
    return chunks


def retrieve(query, chunks, limit=4):
    query_terms = {
        token for token in TOKEN_PATTERN.findall(query.casefold())
        if token not in STOP_WORDS and len(token) > 1
    }
    if not query_terms:
        return chunks[:limit]

    ranked = []
    for index, chunk in enumerate(chunks):
        name_terms = set(TOKEN_PATTERN.findall(chunk["name"].casefold()))
        text_terms = set(TOKEN_PATTERN.findall(chunk["text"].casefold()))
        matches = query_terms & (name_terms | text_terms)
        if not matches:
            continue
        score = len(matches) / len(query_terms)
        score += 0.5 * len(query_terms & name_terms)
        if query.casefold() in chunk["name"].casefold():
            score += 2
        ranked.append((score, index, chunk))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [chunk for _, _, chunk in ranked[:limit]]


def call_model(messages):
    api_key = os.environ.get("TEXT_API_KEY")
    if not api_key:
        raise RuntimeError("TEXT_API_KEY is not configured")

    request = Request(
        OPENROUTER_URL,
        data=json.dumps({
            "model": TEXT_MODEL,
            "max_tokens": 400,
            "messages": messages,
        }).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=45) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise RuntimeError(f"Chat provider returned HTTP {error.code}") from error
    except (URLError, TimeoutError) as error:
        raise RuntimeError("Unable to reach the chat provider") from error

    reply = data.get("choices", [{}])[0].get("message", {}).get("content")
    if not isinstance(reply, str) or not reply.strip():
        raise RuntimeError("Chat provider returned an empty response")
    return reply.strip()


def answer(payload):
    messages = payload.get("messages", [])
    user_messages = [
        message for message in messages 
        if isinstance(message, dict) 
        and message.get("role") == "user" 
        and isinstance(message.get("content"), str) 
        and message["content"].strip()
    ]
    if not user_messages:
        raise ValueError("A user message is required")

    query = user_messages[-1]["content"].strip()
    chunks = scheme_chunks(payload.get("schemes", []))
    relevant_chunks = retrieve(query, chunks)
    
    context = "\n\n".join(
        f"[{chunk['name']} — {chunk['field']}] {chunk['text']} "
        f"(source: {chunk['source_url'] or 'not provided'})"
        for chunk in relevant_chunks
    ) or "No matching scheme information was found in the database."

    # 1. Safely gather past history (up to 9 messages)
    history = [
        {"role": message["role"], "content": message["content"].strip()}
        for message in messages[-9:]  
        if isinstance(message, dict)
        and message.get("role") in {"user", "assistant"}
        and isinstance(message.get("content"), str)
        and message["content"].strip()
    ]

    # 2. Always append a clean, explicitly formatted user message at the end
    final_user_content = f"Scheme context:\n{context}\n\nUser question: {query}"
    history.append({"role": "user", "content": final_user_content})

    return call_model([{"role": "system", "content": SYSTEM_PROMPT}, *history])

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError("The request must be a JSON object")
        print(json.dumps({"reply": answer(payload)}, ensure_ascii=False))
    except (ValueError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
