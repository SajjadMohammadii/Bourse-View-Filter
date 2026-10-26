const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

/** Converts Persian/Arabic digits and separators to their Latin equivalents. */
export function toLatinDigits(s: string): string {
  let out = '';
  for (const ch of s) {
    const p = PERSIAN.indexOf(ch);
    const a = ARABIC.indexOf(ch);
    if (p >= 0) out += String(p);
    else if (a >= 0) out += String(a);
    else if (ch === '٫') out += '.';
    else if (ch === '٬' || ch === '،') out += ',';
    else if (ch === '٪') out += '%';
    else out += ch;
  }
  return out;
}
