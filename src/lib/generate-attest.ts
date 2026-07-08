import { PDFDocument, StandardFonts, rgb } from "pdf-lib/dist/pdf-lib.esm.js";
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
  const match = /^data:(image\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error("Ongeldige handtekening data URL");
  return { bytes: base64ToBytes(match[2]), mime: match[1].toLowerCase() };
}

export async function generateAttestPdf(p: AttestPayload): Promise<Uint8Array> {
  const templateBytes = base64ToBytes(BTW_TEMPLATE_PDF_BASE64);
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.getPages()[0];
  const { height } = page.getSize(); // A4 ~ 595 x 842

  const black = rgb(0, 0, 0);
  const draw = (text: string, x: number, yFromTop: number, size = 11) => {
    page.drawText(text, {
      x,
      y: height - yFromTop,
      size,
      font,
      color: black,
    });
  };

  // Filled square inside a checkbox. bx/by = top-left of the box in pt from top.
  const check = (bx: number, byFromTop: number) => {
    const s = 6;
    page.drawRectangle({
      x: bx + 2,
      y: height - byFromTop - 2 - s,
      width: s,
      height: s,
      color: rgb(0.05, 0.35, 0.15),
    });
  };

  // Schadedatum (label at y≈180)
  draw(p.datumSchade || "", 160, 190);

  // 1. Naam
  draw(p.naam || "", 140, 247);


  // 2. Onderworpen aan de BTW  (JA box x≈283, NEEN box x≈310, y≈258)
  if (p.btwPlichtig === "ja") check(283, 258);
  if (p.btwPlichtig === "nee") check(310, 258);

  // 3. BTW aftrek
  if (p.btwPlichtig === "ja" && (p.btwRecuperatie === "volledig" || p.btwRecuperatie === "gedeeltelijk")) {
    check(107, 306); // Afgetrokken worden
    if (p.btwRecuperatie === "volledig") {
      check(283, 306); // Volledig
    } else {
      check(283, 323); // Gedeeltelijk
      if (p.btwPercentage != null) draw(String(p.btwPercentage), 370, 333);
    }
  } else if (p.btwPlichtig === "nee" || p.btwRecuperatie === "niet") {
    check(107, 340); // Niet afgetrokken worden
  }

  // 4. Betaalwijze
  const bw = p.betaalwijze;
  if (bw === "Op IBAN nr") {
    check(107, 386); // Overschrijving op eigen IBAN
    draw(p.iban || "", 275, 397);
  } else if (bw === "Via erkend hersteller") {
    check(107, 403); // Rechtstreekse betaling aan hersteller
  } else if (bw === "Op IBAN WelZeker") {
    check(107, 420); // Overschrijving op rekening WelZeker
  } else if (bw === "Via naturaherstelling") {
    check(107, 436); // Via naturaherstelling
  }

  // 5. Bestuurder naam
  if (p.bestuurderNaam) draw(p.bestuurderNaam, 400, 487);
  // 6. Geboortedatum bestuurder
  if (p.bestuurderGeboortedatum) draw(p.bestuurderGeboortedatum, 400, 517);


  // Handtekening — box rect: x=299.4, top=570.4, w=165.1, h=84.1
  if (!p.handtekening || !/^data:image\//i.test(p.handtekening)) {
    throw new Error("Handtekening ontbreekt of ongeldig formaat");
  }
  const { bytes: sigBytes, mime: sigMime } = dataUrlToBytes(p.handtekening);
  let sigImg;
  try {
    sigImg = sigMime.includes("jpeg") || sigMime.includes("jpg")
      ? await pdf.embedJpg(sigBytes)
      : await pdf.embedPng(sigBytes);
  } catch {
    try {
      sigImg = await pdf.embedPng(sigBytes);
    } catch {
      sigImg = await pdf.embedJpg(sigBytes);
    }
  }

  const boxX = 299.4;
  const boxTop = 570.4;
  const boxW = 165.1;
  const boxH = 84.1;
  const scaled = sigImg.scaleToFit(boxW - 4, boxH - 4);
  page.drawImage(sigImg, {
    x: boxX + (boxW - scaled.width) / 2,
    y: height - boxTop - boxH + (boxH - scaled.height) / 2,
    width: scaled.width,
    height: scaled.height,
  });

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
