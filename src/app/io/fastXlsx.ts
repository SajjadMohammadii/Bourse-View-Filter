import { CFB } from 'xlsx';

/**
 * Fast reader for the first worksheet of an .xlsx file: values only (numbers, strings, booleans).
 * SheetJS's general XML parser is ~5× slower on the 18 MB sheet of a daily screener export,
 * so we unzip with SheetJS (CFB) and scan the two XML parts we need ourselves.
 * Returns null when the file is not a plain xlsx; the caller then falls back to SheetJS.
 * Columns are aligned to their absolute position (column A = index 0).
 */
export function readFirstSheetFast(buffer: ArrayBuffer): unknown[][] | null {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return null; // not a zip ("PK")
  const zip = CFB.read(bytes, { type: 'array' });
  const text = (path: string): string | null => {
    const entry = CFB.find(zip, `/${path}`); // CFB paths are rooted: "/xl/workbook.xml"
    const content = entry?.content as Uint8Array | number[] | undefined;
    if (!content) return null;
    return new TextDecoder().decode(content instanceof Uint8Array ? content : Uint8Array.from(content));
  };
  const sheetPath = firstSheetPath(text('xl/workbook.xml'), text('xl/_rels/workbook.xml.rels'));
  const sheet = text(sheetPath);
  if (!sheet) return null;
  return parseSheet(sheet, parseSharedStrings(text('xl/sharedStrings.xml')));
}

function firstSheetPath(workbook: string | null, rels: string | null): string {
  const fallback = 'xl/worksheets/sheet1.xml';
  const rid = workbook ? /<(?:\w+:)?sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1] : undefined;
  if (!rid || !rels) return fallback;
  const target =
    new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*\\bTarget="([^"]+)"`).exec(rels)?.[1] ??
    new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${rid}"`).exec(rels)?.[1];
  if (!target) return fallback;
  return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e: string) => {
    if (e[0] === '#')
      return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITY[e] ?? m;
  });
}

/** Concatenated text of all <t> runs inside an XML fragment (rich text included, phonetic runs skipped). */
function textRuns(fragment: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const open = fragment.indexOf('<t', i);
    if (open < 0) break;
    const after = fragment[open + 2];
    if (after !== '>' && after !== ' ') {
      i = open + 2;
      continue;
    }
    const start = fragment.indexOf('>', open) + 1;
    if (fragment[start - 2] === '/') {
      i = start;
      continue;
    }
    const end = fragment.indexOf('</t>', start);
    out += fragment.slice(start, end);
    i = end + 4;
  }
  return decodeXml(out.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''));
}

export function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const out: string[] = [];
  let i = 0;
  for (;;) {
    const open = xml.indexOf('<si', i);
    if (open < 0) break;
    const gt = xml.indexOf('>', open);
    if (xml[gt - 1] === '/') {
      out.push(''); // <si/>
      i = gt + 1;
      continue;
    }
    const end = xml.indexOf('</si>', gt);
    out.push(textRuns(xml.slice(gt + 1, end)));
    i = end + 5;
  }
  return out;
}

function columnIndex(ref: string): number {
  let n = 0;
  for (let k = 0; k < ref.length; k++) {
    const c = ref.charCodeAt(k);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

const attr = (tag: string, name: string): string | undefined => {
  const k = tag.indexOf(` ${name}="`);
  if (k < 0) return undefined;
  const start = k + name.length + 3;
  return tag.slice(start, tag.indexOf('"', start));
};

export function parseSheet(xml: string, shared: string[]): unknown[][] {
  const rows: unknown[][] = [];
  const dataStart = xml.indexOf('<sheetData');
  if (dataStart < 0) return rows;
  let i = dataStart;
  let rowIndex = -1;
  let row: unknown[] = [];
  for (;;) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) break;
    if (xml.startsWith('<row', lt) && (xml[lt + 4] === ' ' || xml[lt + 4] === '>')) {
      const gt = xml.indexOf('>', lt);
      const r = attr(xml.slice(lt, gt), 'r');
      rowIndex = r ? Number(r) - 1 : rowIndex + 1;
      row = [];
      rows[rowIndex] = row;
      i = gt + 1;
    } else if (xml.startsWith('<c', lt) && (xml[lt + 2] === ' ' || xml[lt + 2] === '>')) {
      i = readCell(xml, lt, row, shared);
    } else if (xml.startsWith('</sheetData', lt)) {
      break;
    } else {
      i = lt + 1;
    }
  }
  // Fill skipped (missing) rows so indices stay meaningful.
  for (let k = 0; k < rows.length; k++) rows[k] ??= [];
  return rows;
}

function readCell(xml: string, lt: number, row: unknown[], shared: string[]): number {
  const gt = xml.indexOf('>', lt);
  const tag = xml.slice(lt, gt);
  const ref = attr(tag, 'r');
  const col = ref ? columnIndex(ref) : row.length;
  if (xml[gt - 1] === '/') return gt + 1; // <c ... /> empty cell
  const end = xml.indexOf('</c>', gt);
  const inner = xml.slice(gt + 1, end);
  const type = attr(tag, 't') ?? 'n';
  let value: unknown = null;
  if (type === 'inlineStr') value = textRuns(inner);
  else {
    const vs = inner.indexOf('<v>');
    const raw = vs >= 0 ? inner.slice(vs + 3, inner.indexOf('</v>', vs)) : null;
    if (raw !== null) {
      if (type === 's') value = shared[Number(raw)] ?? null;
      else if (type === 'str') value = decodeXml(raw);
      else if (type === 'b') value = raw === '1';
      else if (type === 'e') value = null;
      else value = Number(raw);
    }
  }
  row[col] = value;
  return end + 4;
}
