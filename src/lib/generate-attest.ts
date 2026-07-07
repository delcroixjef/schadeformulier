import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BTW_TEMPLATE_PDF_BASE64 } from "./btw-template";

export interface AttestPayload {
  code?: string;
  naam: string;
  email: string;
  telefoon: string;
  typeSchade: string;
  typeSchadeAndere: string | null;
  datumSchade: string;
  btwPlichtig: "ja" | "nee" | "";
  btwRecuperatie: "volledig" | "gedeeltelijk" | "niet" | "" | null;
  btwPercentage: number | null;
  iban: string;
  betaalwijze: string;
  bestuurderNaam: string | null;
  bestuurderGeboortedatum: string | null;
  akkoordJuistheid: boolean;
  akkoordGdpr: boolean;
  handtekening: string; // data URL
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:(image\/(png|jpeg|jpg));base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Ongeldige handtekening data URL");
  return { bytes: base64ToBytes(match[3]), mime: match[1].toLowerCase() };
}

const LABEL: Record<string, string> = {
  auto: "Auto",
  brand: "Brand",
  woning: "Woning",
  andere: "Andere",
};

export async function generateAttestPdf(p: AttestPayload): Promise<Uint8Array> {
  const templateBytes = base64ToBytes(BTW_TEMPLATE_PDF_BASE64);
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.getPages()[0];
  const { width, height } = page.getSize(); // A4 ~ 595 x 842

  const black = rgb(0, 0, 0);
  const draw = (
    text: string,
    x: number,
    y: number,
    size = 11,
    bold = false,
  ) => {
    page.drawText(text, {
      x,
      y: height - y,
      size,
      font: bold ? fontBold : font,
      color: black,
    });
  };

  // Filled square inside a checkbox. bx/by = top-left of the box (pt from top).
  const check = (bx: number, by: number) => {
    const s = 6;
    page.drawRectangle({
      x: bx + 2,
      y: height - by - 2 - s,
      width: s,
      height: s,
      color: rgb(0.05, 0.35, 0.15),
    });
  };

  // Values (y ≈ text baseline = yMax from template bbox).
  draw(p.code ?? "", 150, 192);   // Uw referte
  draw(p.code ?? "", 150, 215);   // Onze referte
  draw(p.datumSchade, 150, 238);  // Schadedatum

  // 1. Naam
  draw(p.naam, 200, 346);
  // 2. Beroep — niet in formulier

  // 3. Onderworpen BTW
  if (p.btwPlichtig === "ja") check(283, 397);
  if (p.btwPlichtig === "nee") check(310, 397);

  // 4. Aftrek
  if (p.btwPlichtig === "ja" && p.btwRecuperatie) {
    if (p.btwRecuperatie === "volledig" || p.btwRecuperatie === "gedeeltelijk") {
      check(107, 444); // "Afgetrokken worden"
      if (p.btwRecuperatie === "volledig") {
        check(283, 444); // Volledig
      } else {
        check(283, 461); // Gedeeltelijk
        draw(String(p.btwPercentage ?? ""), 355, 473);
      }
    } else if (p.btwRecuperatie === "niet") {
      check(107, 478); // Niet afgetrokken
    }
  }

  // 5. Betaalwijze
  const bw = p.betaalwijze;
  if (bw === "Op IBAN nr") {
    check(107, 525);
    const ibanRest = p.iban.replace(/^BE/i, "").trim();
    draw(ibanRest, 315, 536);
  } else if (bw === "Via erkend hersteller") {
    check(107, 542);
  } else if (bw === "Op IBAN WelZeker") {
    check(107, 559);
  } else if (bw === "Via naturaherstelling") {
    check(107, 575);
    draw("Naturaherstelling — IBAN: " + p.iban, 165, 586);
  } else {
    check(107, 575);
    draw(`${bw} — IBAN: ${p.iban}`, 165, 586);
  }

  // 6. Bestuurder — labels lopen tot ~x=393
  if (p.bestuurderNaam) draw(p.bestuurderNaam, 400, 619);
  // 7. Geboortedatum bestuurder — label loopt tot ~x=373
  if (p.bestuurderGeboortedatum) draw(p.bestuurderGeboortedatum, 380, 649);

  // Handtekening — box in template ~x=378 y_top=705 w=142 h=58
  try {
    const { bytes, mime } = dataUrlToBytes(p.handtekening);
    const img = mime.includes("png")
      ? await pdf.embedPng(bytes)
      : await pdf.embedJpg(bytes);
    const boxX = 378;
    const boxYFromTop = 705;
    const boxW = 142;
    const boxH = 58;
    const scaled = img.scaleToFit(boxW - 8, boxH - 8);
    page.drawImage(img, {
      x: boxX + (boxW - scaled.width) / 2,
      y: height - boxYFromTop - boxH + (boxH - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height,
    });
  } catch (err) {
    console.warn("Handtekening niet toegevoegd:", err);
  }

  // ---- Extra pagina: overige gegevens netjes onder titels ----
  const page2 = pdf.addPage([width, height]);
  let y = height - 60;

  const heading = (t: string) => {
    y -= 6;
    page2.drawText(t, {
      x: 50,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.15, 0.2, 0.25),
    });
    y -= 6;
    page2.drawLine({
      start: { x: 50, y: y },
      end: { x: width - 50, y: y },
      thickness: 0.7,
      color: rgb(0.6, 0.7, 0.35),
    });
    y -= 20;
  };
  const row = (label: string, value: string) => {
    if (y < 60) {
      const np = pdf.addPage([width, height]);
      // Bump reference (simple: don't overflow expected)
      y = height - 60;
      np.drawText(label + ":", { x: 50, y, size: 10, font: fontBold, color: black });
      np.drawText(value || "—", { x: 200, y, size: 10, font, color: black });
      y -= 18;
      return;
    }
    page2.drawText(label + ":", { x: 50, y, size: 10, font: fontBold, color: black });
    page2.drawText(value || "—", { x: 200, y, size: 10, font, color: black });
    y -= 18;
  };

  page2.drawText("SCHADEMELDING — bijkomende gegevens", {
    x: 50,
    y: y,
    size: 16,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.25),
  });
  y -= 30;
  if (p.code) {
    page2.drawText(`Dossiercode: ${p.code}`, {
      x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.4),
    });
    y -= 20;
  }

  heading("Uw gegevens");
  row("Naam", p.naam);
  row("E-mail", p.email);
  row("Telefoon", p.telefoon);

  heading("Schade");
  const ts = LABEL[p.typeSchade] ?? p.typeSchade;
  row("Type schade", ts);
  if (p.typeSchadeAndere) row("Omschrijving", p.typeSchadeAndere);
  row("Datum schade", p.datumSchade);
  if (p.bestuurderNaam) row("Bestuurder", p.bestuurderNaam);
  if (p.bestuurderGeboortedatum)
    row("Geboortedatum bestuurder", p.bestuurderGeboortedatum);

  heading("BTW & betaling");
  row("BTW-plichtig", p.btwPlichtig || "—");
  row(
    "BTW recuperatie",
    p.btwRecuperatie
      ? p.btwRecuperatie +
        (p.btwPercentage != null ? ` (${p.btwPercentage}%)` : "")
      : "—",
  );
  row("IBAN", p.iban);
  row("Betaalwijze", p.betaalwijze);

  heading("Verklaringen");
  row("Gegevens naar waarheid", p.akkoordJuistheid ? "Akkoord" : "Niet akkoord");
  row("Verwerking gegevens (GDPR)", p.akkoordGdpr ? "Akkoord" : "Niet akkoord");

  return await pdf.save();
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}
