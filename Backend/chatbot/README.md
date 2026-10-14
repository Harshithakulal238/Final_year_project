# Scheme chatbot

The chatbot is called by `POST /api/chat` in the backend. It retrieves relevant
scheme text from the existing MongoDB schemes collection, sends that context
and the recent conversation to OpenRouter, and returns `{ "reply": "..." }`.
The Python worker uses only the Python standard library; it does not need the
Colab notebook, a separate MongoDB client, or embedding-model downloads.

Configure these variables in the backend environment (for local development,
the existing `Backend/.env` file is loaded):

- `TEXT_API_KEY` — required OpenRouter-compatible text provider key.
- `CHATBOT_MODEL` — optional OpenRouter model; defaults to
  `openai/gpt-4o-mini`.
- `PYTHON_BIN` — optional Python executable; defaults to `python`.

The frontend's `/api/chat` route forwards to the scheme backend at
`http://localhost:5001` by default. This matches `Backend/.env` and the
recommendation API. Set `API_URL` in the frontend server environment when the
backend is hosted elsewhere.

Start the backend and frontend as usual. The chat UI sends up to the latest ten
messages; the backend loads scheme records for retrieval and returns the reply.

`GROQ_API_KEY` is not used by the current text-only chat UI. It was used only
for the Colab notebook's optional voice transcription feature.
