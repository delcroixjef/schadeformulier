import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const TO = "schadeformulier@welzeker.be";
// Zonder eigen geverifieerd domein is dit het Resend-testadres
const FROM = "WelZeker Schade <onboarding@resend.dev>";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export const Route = createFileRoute("/api/public/send-schade")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      POST: async ({ request }) => {
        const lovableKey = process.env.LOVABLE_API_KEY;
        const resendKey = process.env.RESEND_API_KEY;
        if (!lovableKey || !resendKey) {
          return new Response(
            JSON.stringify({ error: "E-mailconfiguratie ontbreekt" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } },
          );
        }

        let payload: Record<string, unknown>;
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response(JSON.stringify({ error: "Ongeldige JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders() },
          });
        }

        const codeRaw = typeof payload.code === "string" ? payload.code.trim() : "";
        const subject = codeRaw
          ? `SCHADEFORMULIER ${codeRaw}`
          : "SCHADEFORMULIER zonder code";

        // Body = EXACT het JSON-object als platte tekst
        const bodyText = JSON.stringify(payload, null, 2);

        const res = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
          },
          body: JSON.stringify({
            from: FROM,
            to: [TO],
            subject,
            text: bodyText,
          }),
        });

        const respText = await res.text();
        if (!res.ok) {
          console.error("Resend fout", res.status, respText);
          return new Response(
            JSON.stringify({ error: "E-mail versturen mislukt", status: res.status, detail: respText }),
            { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders() } },
          );
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      },
    },
  },
});
