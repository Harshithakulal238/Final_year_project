import { createFileRoute } from "@tanstack/react-router";

const API_URL = (
  process.env.API_URL
  ?? process.env.VITE_RECOMMENDATION_API_URL
  ?? "http://localhost:5001"
).replace(/\/$/, "");

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ message: "Invalid JSON" }, { status: 400 });
        }

        try {
          const response = await fetch(`${API_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const responseBody = await response.text();
          return new Response(responseBody, {
            status: response.status,
            headers: {
              "Content-Type": response.headers.get("Content-Type") ?? "application/json",
            },
          });
        } catch (error) {
          console.error("Unable to reach chatbot backend:", error);
          return Response.json(
            { message: "Unable to reach the chatbot backend" },
            { status: 502 },
          );
        }
      },
    },
  },
});