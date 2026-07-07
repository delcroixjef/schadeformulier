import { createFileRoute } from "@tanstack/react-router";
import { generateAttestPdf, bytesToBase64, type AttestPayload } from "@/lib/generate-attest";




const TO = "schadeformulier@welzeker.be";
const FROM_MAILBOX = "schadeformulier@welzeker.be";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function getGraphToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token fout ${res.status}: ${text}`);
  }
  const json = JSON.parse(text) as { access_token?: string };
  if (!json.access_token) throw new Error("Geen access_token ontvangen");
  return json.access_token;
}

export const Route = createFileRoute("/api/public/send-schade")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      POST: async ({ request }) => {
        const tenantId = process.env.MS_TENANT_ID;
        const clientId = process.env.MS_CLIENT_ID;
        const clientSecret = process.env.MS_CLIENT_SECRET;
        if (!tenantId || !clientId || !clientSecret) {
          return new Response(
            JSON.stringify({ error: "E-mailconfiguratie ontbreekt (Microsoft 365)" }),
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

        let token: string;
        try {
          token = await getGraphToken(tenantId, clientId, clientSecret);
        } catch (err) {
          console.error("MS Graph token fout", err);
          return new Response(
            JSON.stringify({ error: "Authenticatie bij Microsoft mislukt", detail: String(err) }),
            { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders() } },
          );
        }

        // Bouw attest.pdf op basis van de payload
        let pdfBase64: string;
        let pdfSize = 0;
        try {
          const pdfBytes = await generateAttestPdf(payload as unknown as AttestPayload);

          pdfSize = pdfBytes.length;
          pdfBase64 = bytesToBase64(pdfBytes);
          console.log(
            `[send-schade] PDF ok: ${pdfSize} bytes, base64 ${pdfBase64.length} chars`,
          );
        } catch (err) {
          console.error("[send-schade] PDF genereren mislukt", err);
          return new Response(
            JSON.stringify({ error: "PDF genereren mislukt", detail: String(err) }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } },
          );
        }
        if (!pdfBase64 || pdfSize < 500) {
          console.error("[send-schade] PDF leeg of te klein, verzending afgebroken");
          return new Response(
            JSON.stringify({ error: "PDF leeg" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } },
          );
        }

        const graphRes = await fetch(
          `${GRAPH_BASE}/users/${encodeURIComponent(FROM_MAILBOX)}/sendMail`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              message: {
                subject,
                body: { contentType: "Text", content: bodyText },
                toRecipients: [{ emailAddress: { address: TO } }],
                attachments: [
                  {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    name: "attest.pdf",
                    contentType: "application/pdf",
                    contentBytes: pdfBase64,
                  },
                ],
              },
              saveToSentItems: true,
            }),
          },
        );

        if (!graphRes.ok) {
          const detail = await graphRes.text();
          console.error("MS Graph sendMail fout", graphRes.status, detail);
          return new Response(
            JSON.stringify({ error: "E-mail versturen mislukt", status: graphRes.status, detail }),
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
