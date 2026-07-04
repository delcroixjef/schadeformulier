import { createFileRoute } from "@tanstack/react-router";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  component: IntakeForm,
});

type TypeSchade = "auto" | "brand" | "woning" | "andere" | "";
type BtwRecup = "volledig" | "gedeeltelijk" | "niet" | "";

interface FormState {
  naam: string;
  email: string;
  telefoon: string;
  typeSchade: TypeSchade;
  typeSchadeAndere: string;
  datumSchade: string; // yyyy-mm-dd from input
  btwPlichtig: "ja" | "nee" | "";
  btwRecuperatie: BtwRecup;
  btwPercentage: string;
  iban: string;
  betaalwijze: string;
  bestuurderNaam: string;
  bestuurderGeboortedatum: string; // yyyy-mm-dd
  akkoordJuistheid: boolean;
  akkoordGdpr: boolean;
}

const initial: FormState = {
  naam: "",
  email: "",
  telefoon: "",
  typeSchade: "",
  typeSchadeAndere: "",
  datumSchade: "",
  btwPlichtig: "",
  btwRecuperatie: "",
  btwPercentage: "",
  iban: "",
  betaalwijze: "",
  bestuurderNaam: "",
  bestuurderGeboortedatum: "",
  akkoordJuistheid: false,
  akkoordGdpr: false,
};

const BETAALWIJZE_OPTIES = [
  "Op IBAN nr",
  "Op IBAN WelZeker",
  "Via erkend hersteller",
  "Via naturaherstelling",
] as const;

// IBAN validation using mod-97 checksum
function isValidIBAN(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const converted = rearranged
    .split("")
    .map((c) => (/[A-Z]/.test(c) ? (c.charCodeAt(0) - 55).toString() : c))
    .join("");
  // mod-97 on long numeric string
  let remainder = 0;
  for (let i = 0; i < converted.length; i += 7) {
    remainder = Number(String(remainder) + converted.substring(i, i + 7)) % 97;
  }
  return remainder === 1;
}

function toDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}-${m}-${y}`;
}

function IntakeForm() {
  const [code, setCode] = useState<string>("");
  const [codeMissing, setCodeMissing] = useState(false);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<any | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code")?.trim() ?? "";
    if (c) setCode(c);
    else setCodeMissing(true);
  }, []);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const sigRef = useRef<SignaturePadHandle>(null);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.naam.trim()) e.naam = "Verplicht";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Ongeldig e-mailadres";
    if (!form.telefoon.trim()) e.telefoon = "Verplicht";
    if (!form.typeSchade) e.typeSchade = "Verplicht";
    if (form.typeSchade === "andere" && !form.typeSchadeAndere.trim())
      e.typeSchadeAndere = "Verplicht — geef een omschrijving";
    if (!form.datumSchade) e.datumSchade = "Verplicht";
    if (!form.btwPlichtig) e.btwPlichtig = "Verplicht";
    if (form.btwPlichtig === "ja" && !form.btwRecuperatie)
      e.btwRecuperatie = "Verplicht";
    if (form.btwPlichtig === "ja" && form.btwRecuperatie === "gedeeltelijk") {
      const n = Number(form.btwPercentage);
      if (!form.btwPercentage || Number.isNaN(n) || n < 0 || n > 100)
        e.btwPercentage = "Geef een percentage tussen 0 en 100";
    }
    if (!form.iban.trim()) e.iban = "Verplicht";
    else if (!isValidIBAN(form.iban)) e.iban = "Ongeldig IBAN-nummer";
    if (!form.betaalwijze) e.betaalwijze = "Verplicht";
    if (form.typeSchade === "auto") {
      if (!form.bestuurderNaam.trim()) e.bestuurderNaam = "Verplicht";
      if (!form.bestuurderGeboortedatum) e.bestuurderGeboortedatum = "Verplicht";
    }
    if (!form.akkoordJuistheid) e.akkoordJuistheid = "Vereist";
    if (!form.akkoordGdpr) e.akkoordGdpr = "Vereist";
    if (!sigRef.current || sigRef.current.isEmpty())
      e.handtekening = "Handtekening vereist";
    return e;
  };

  const onSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      const first = document.querySelector<HTMLElement>("[data-error='true']");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const payload = {
      code,
      naam: form.naam.trim(),
      email: form.email.trim(),
      telefoon: form.telefoon.trim(),
      typeSchade: form.typeSchade,
      typeSchadeAndere:
        form.typeSchade === "andere" ? form.typeSchadeAndere.trim() : null,
      datumSchade: toDDMMYYYY(form.datumSchade),
      btwPlichtig: form.btwPlichtig,
      btwRecuperatie: form.btwPlichtig === "ja" ? form.btwRecuperatie : null,
      btwPercentage:
        form.btwPlichtig === "ja" && form.btwRecuperatie === "gedeeltelijk"
          ? Number(form.btwPercentage)
          : null,
      iban: form.iban.replace(/\s+/g, "").toUpperCase(),
      betaalwijze: form.betaalwijze,
      bestuurderNaam: form.typeSchade === "auto" ? form.bestuurderNaam.trim() : null,
      bestuurderGeboortedatum:
        form.typeSchade === "auto" ? toDDMMYYYY(form.bestuurderGeboortedatum) : null,
      akkoordJuistheid: form.akkoordJuistheid,
      akkoordGdpr: form.akkoordGdpr,
      handtekening: sigRef.current!.toDataURL(),
    };
    console.log("[WelZeker schade-intake]", payload);
    setSubmitted(payload);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <Header />
          <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-structure">Bedankt, uw melding is verzonden</h1>
            <p className="mt-2 text-muted-foreground">
              We nemen zo snel mogelijk contact met u op om uw dossier te behandelen.
            </p>
            {!code && (
              <p className="mt-3 text-sm text-muted-foreground">
                (Uw melding werd verzonden zonder dossiercode.)
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setSubmitted(null);
                setForm(initial);
                setErrors({});
                sigRef.current?.clear();
              }}
              className="mt-6 inline-flex items-center justify-center rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition hover:brightness-95"
            >
              Nieuwe melding
            </button>
          </div>

          <DebugPanel
            open={debugOpen}
            onToggle={() => setDebugOpen((v) => !v)}
            payload={submitted}
            copyOk={copyOk}
            onCopy={async () => {
              await navigator.clipboard.writeText(JSON.stringify(submitted, null, 2));
              setCopyOk(true);
              setTimeout(() => setCopyOk(false), 1500);
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl">
        <Header />

        {codeMissing && (
          <div className="mt-6 rounded-md border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
            Geen dossiercode gevonden in de link. U kan het formulier toch verzenden.
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
          <input type="hidden" name="code" value={code} />

          <Section title="Uw gegevens">
            <Field label="Naam" error={errors.naam}>
              <input
                type="text"
                autoComplete="name"
                value={form.naam}
                onChange={(e) => update("naam", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="E-mail" error={errors.email}>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Telefoon" error={errors.telefoon}>
              <input
                type="tel"
                autoComplete="tel"
                value={form.telefoon}
                onChange={(e) => update("telefoon", e.target.value)}
                className={inputCls}
              />
            </Field>
          </Section>

          <Section title="Schade">
            <Field label="Type schade" error={errors.typeSchade}>
              <select
                value={form.typeSchade}
                onChange={(e) => update("typeSchade", e.target.value as TypeSchade)}
                className={inputCls}
              >
                <option value="">Kies…</option>
                <option value="auto">Auto</option>
                <option value="brand">Brand</option>
                <option value="woning">Woning</option>
                <option value="andere">Andere</option>
              </select>
            </Field>
            {form.typeSchade === "andere" && (
              <Field label="Omschrijving schade" error={errors.typeSchadeAndere}>
                <textarea
                  value={form.typeSchadeAndere}
                  onChange={(e) => update("typeSchadeAndere", e.target.value)}
                  rows={3}
                  placeholder="Beschrijf uw schade"
                  className={inputCls}
                />
              </Field>
            )}
            <Field label="Datum schade" error={errors.datumSchade}>
              <input
                type="date"
                value={form.datumSchade}
                onChange={(e) => update("datumSchade", e.target.value)}
                className={inputCls}
              />
            </Field>

            {form.typeSchade === "auto" && (
              <>
                <Field label="Naam bestuurder" error={errors.bestuurderNaam}>
                  <input
                    type="text"
                    value={form.bestuurderNaam}
                    onChange={(e) => update("bestuurderNaam", e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Geboortedatum bestuurder" error={errors.bestuurderGeboortedatum}>
                  <input
                    type="date"
                    value={form.bestuurderGeboortedatum}
                    onChange={(e) => update("bestuurderGeboortedatum", e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </>
            )}
          </Section>

          <Section title="BTW & betaling">
            <Field label="BTW-plichtig" error={errors.btwPlichtig}>
              <div className="flex gap-4 pt-1">
                {(["ja", "nee"] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="btwPlichtig"
                      checked={form.btwPlichtig === v}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          btwPlichtig: v,
                          ...(v === "nee" ? { btwRecuperatie: "" as const, btwPercentage: "" } : {}),
                        }))
                      }
                      className="h-4 w-4 accent-[color:var(--brand)]"
                    />
                    <span className="capitalize">{v}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="BTW recupereren" error={errors.btwRecuperatie}>
              <select
                value={form.btwPlichtig === "ja" ? form.btwRecuperatie : ""}
                onChange={(e) => update("btwRecuperatie", e.target.value as BtwRecup)}
                disabled={form.btwPlichtig !== "ja"}
                className={`${inputCls} disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-70`}
              >
                <option value="">Kies…</option>
                <option value="volledig">Volledig</option>
                <option value="gedeeltelijk">Gedeeltelijk</option>
                
              </select>
              {form.btwPlichtig === "nee" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Niet van toepassing (niet BTW-plichtig).
                </p>
              )}
            </Field>
            {form.btwPlichtig === "ja" && form.btwRecuperatie === "gedeeltelijk" && (
              <Field label="BTW-percentage" error={errors.btwPercentage}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.btwPercentage}
                  onChange={(e) => update("btwPercentage", e.target.value)}
                  className={inputCls}
                />
              </Field>
            )}
            <Field label="IBAN" error={errors.iban}>
              <input
                type="text"
                value={form.iban}
                onChange={(e) => update("iban", e.target.value.toUpperCase())}
                placeholder="BE00 0000 0000 0000"
                className={inputCls}
              />
            </Field>
            <Field label="Betaalwijze" error={errors.betaalwijze}>
              <select
                value={form.betaalwijze}
                onChange={(e) => update("betaalwijze", e.target.value)}
                className={inputCls}
              >
                <option value="">Kies…</option>
                {BETAALWIJZE_OPTIES.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="Verklaringen">
            <div data-error={!!errors.akkoordJuistheid} className="space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.akkoordJuistheid}
                  onChange={(e) => update("akkoordJuistheid", e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[color:var(--brand)]"
                />
                <span>Ik verklaar de gegevens naar waarheid te hebben ingevuld.</span>
              </label>
              {errors.akkoordJuistheid && (
                <p className="text-xs text-destructive">{errors.akkoordJuistheid}</p>
              )}
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.akkoordGdpr}
                  onChange={(e) => update("akkoordGdpr", e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[color:var(--brand)]"
                />
                <span>Ik ga akkoord met de verwerking van mijn gegevens (GDPR).</span>
              </label>
              {errors.akkoordGdpr && (
                <p className="text-xs text-destructive">{errors.akkoordGdpr}</p>
              )}
            </div>
          </Section>

          <Section title="Handtekening">
            <div data-error={!!errors.handtekening}>
              <SignaturePad ref={sigRef} />
              {errors.handtekening && (
                <p className="mt-2 text-xs text-destructive">{errors.handtekening}</p>
              )}
            </div>
          </Section>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full rounded-md bg-brand px-6 py-3 text-base font-semibold text-brand-foreground shadow-sm transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              Verzenden
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40";

function Header() {
  return (
    <header className="border-b border-border pb-4">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold tracking-tight text-structure">WelZeker</span>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Schade-intake</span>
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-structure md:text-3xl">
        Meld uw schadegeval
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vul de gegevens hieronder in. Alle velden zijn verplicht.
      </p>
    </header>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-structure">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-error={!!error}>
      <label className="mb-1.5 block text-sm font-medium text-structure">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/* ---------------- Signature Pad ---------------- */

interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

const SignaturePad = forwardRef<SignaturePadHandle>((_props, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const emptyRef = useRef(true);
    const lastRef = useRef<{ x: number; y: number } | null>(null);
    const [, force] = useState(0);

    useEffect(() => {
      const canvas = canvasRef.current!;
      const resize = () => {
        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#2b2724";
      };
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, []);

    const pos = (e: PointerEvent | React.PointerEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: React.PointerEvent) => {
      e.preventDefault();
      canvasRef.current!.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastRef.current = pos(e);
    };
    const onMove = (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      const ctx = canvasRef.current!.getContext("2d")!;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(lastRef.current!.x, lastRef.current!.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastRef.current = p;
      if (emptyRef.current) {
        emptyRef.current = false;
        force((n) => n + 1);
      }
    };
    const onUp = () => {
      drawingRef.current = false;
      lastRef.current = null;
    };

    const clear = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      emptyRef.current = true;
      force((n) => n + 1);
    };

    useImperativeHandle(ref, () => ({
      clear,
      isEmpty: () => emptyRef.current,
      toDataURL: () => canvasRef.current!.toDataURL("image/png"),
    }));

    return (
      <div>
        <div className="rounded-md border border-input bg-background">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            style={{ width: "100%", height: 180, touchAction: "none", display: "block" }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Teken hier met muis of vinger.</span>
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-structure hover:bg-secondary"
          >
            Wissen
          </button>
        </div>
      </div>
    );
});
SignaturePad.displayName = "SignaturePad";

/* ---------------- Debug panel ---------------- */

function DebugPanel({
  open,
  onToggle,
  payload,
  onCopy,
  copyOk,
}: {
  open: boolean;
  onToggle: () => void;
  payload: any;
  onCopy: () => void;
  copyOk: boolean;
}) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-structure">Debug (JSON payload)</span>
        <span className="text-xs text-muted-foreground">{open ? "Verbergen" : "Tonen"}</span>
      </button>
      {open && (
        <div className="border-t border-border p-4">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={onCopy}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-structure hover:bg-secondary"
            >
              {copyOk ? "Gekopieerd!" : "Kopieer JSON"}
            </button>
          </div>
          <pre className="max-h-96 overflow-auto rounded-md bg-secondary p-3 text-xs text-foreground">
{JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
