import { createFileRoute } from "@tanstack/react-router";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

const SYSTEM_PROMPT = `You are Sahayak Assistant, a friendly AI helper inside a web app that matches Indian citizens (focus: Karnataka) with central & state government welfare schemes.

Answer user questions about:
- Government schemes (eligibility, benefits, required documents, application process, deadlines)
- How to use the Sahayak app (Profile, My Schemes / recommendations, editing details, logging out)
- Categories such as SC/ST/OBC/Minority, ration cards (APL/BPL/AAY), and special conditions (pregnant, widow, disabled)

Keep answers concise, use short bullet lists when helpful, and prefer plain language. Mention official sources like pmjay.gov.in, pmkisan.gov.in, scholarships.gov.in, nsap.nic.in when relevant.

If a question is outside government schemes or app navigation, or you are unsure of a fact (like exact current deadlines or amounts), politely say you are not certain and suggest the user check the official scheme website or the Scheme Details page inside the app.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        let body: { messages?: ChatMsg[] };
        try {
          body = (await request.json()) as { messages?: ChatMsg[] };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const msgs = Array.isArray(body.messages) ? body.messages : [];
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
          },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...msgs],
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          return new Response(text || "Upstream error", { status: res.status });
        }
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const reply = data.choices?.[0]?.message?.content ?? "";
        return Response.json({ reply });
      },
    },
  },
});