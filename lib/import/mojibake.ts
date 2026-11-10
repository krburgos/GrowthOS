/**
 * Repairs "mojibake": text that was saved as UTF-8, read back as
 * Windows-1252 and saved again, often several times over by spreadsheets and
 * data vendors, so "®" arrives as "Â®", "Ã‚Â®" or worse (bug fix,
 * 2026-11-10: "PC FriendlyÃ‚Â®", "StÃƒÆ’Ã‚Â¤rken" in CRO Leader imports).
 *
 * Each round turns the text back into the Windows-1252 bytes it was misread
 * from and decodes them as UTF-8. It stops as soon as that isn't valid
 * UTF-8, so ordinary accented text ("Café", "São Paulo") is never touched.
 */

/** Windows-1252's 0x80–0x9F block, by the character it stands for. */
const CP1252_HIGH: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88,
  "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93,
  "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b,
  "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};
const CP1252_BY_BYTE = Object.fromEntries(Object.entries(CP1252_HIGH).map(([ch, b]) => [b, ch]));

/** A UTF-8 lead byte misread as Windows-1252, followed by a misread continuation byte. */
const LOOKS_GARBLED = /[ÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïð][\u0080-¿€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/;

const utf8 = new TextDecoder("utf-8", { fatal: true });

function toCp1252Bytes(text: string): Uint8Array | null {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0xff) bytes[i] = code;
    else if (CP1252_HIGH[text[i]] !== undefined) bytes[i] = CP1252_HIGH[text[i]];
    else return null; // a character Windows-1252 can't hold: not mojibake
  }
  return bytes;
}

export function fixMojibake(text: string): string {
  if (!text) return text;
  let out = text;
  for (let round = 0; round < 4 && LOOKS_GARBLED.test(out); round++) {
    const bytes = toCp1252Bytes(out);
    if (!bytes) break;
    let decoded: string;
    try {
      decoded = utf8.decode(bytes);
    } catch {
      break;
    }
    if (decoded === out) break;
    out = decoded;
  }
  // A Windows-1252 punctuation byte that ended up as an invisible control
  // character ("G6 \u0096 Military") becomes the dash or quote it was.
  return out.replace(/[\u0080-\u009f]/g, (c) => CP1252_BY_BYTE[c.charCodeAt(0)] ?? "");
}
