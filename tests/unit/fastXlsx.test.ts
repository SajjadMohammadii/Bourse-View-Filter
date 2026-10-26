import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { utils, write } from 'xlsx';
import { readFirstSheetFast, parseSharedStrings, parseSheet, decodeXml } from '../../src/app/io/fastXlsx';
import { readWithSheetJs, readWorkbook } from '../../src/app/io/readWorkbook';
import { SAMPLE_PATH } from '../helpers/sample';

const toAb = (b: Buffer | Uint8Array) =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe('fast xlsx reader', () => {
  it('matches SheetJS cell-for-cell on the sample (column A is the empty first column)', () => {
    const ab = toAb(readFileSync(SAMPLE_PATH));
    const fast = readFirstSheetFast(ab)!;
    const slow = readWithSheetJs(ab);
    if (!slow.ok) throw new Error(slow.error.message);
    expect(fast.length).toBe(slow.value.length);
    let compared = 0;
    slow.value.forEach((row, r) => {
      (row as unknown[]).forEach((v, c) => {
        const f = fast[r]?.[c + 1] ?? null;
        expect(f, `r${r} c${c}`).toEqual(v ?? null);
        compared++;
      });
    });
    expect(compared).toBeGreaterThan(400_000);
  });

  // Coverage instrumentation slows our code but not node_modules, so timing is meaningless there.
  it.skipIf(process.env['BVF_COVERAGE'])('is much faster than SheetJS on the sample', () => {
    const ab = toAb(readFileSync(SAMPLE_PATH));
    readFirstSheetFast(ab);
    let t = performance.now();
    readFirstSheetFast(ab);
    const fast = performance.now() - t;
    t = performance.now();
    readWithSheetJs(ab);
    const slow = performance.now() - t;
    console.log(`fast ${Math.round(fast)} ms vs SheetJS ${Math.round(slow)} ms`);
    expect(fast).toBeLessThan(slow / 2);
  });

  it('handles entities, rich text, inline strings, booleans, errors and gaps', () => {
    expect(decodeXml('a &amp; b &lt;c&gt; &#1601; &#x6A9;')).toBe('a & b <c> ف ک');
    expect(
      parseSharedStrings(
        '<sst><si><t>ساده</t></si><si/><si><r><t>غنی</t></r><r><t xml:space="preserve"> متن</t></r></si></sst>',
      ),
    ).toEqual(['ساده', '', 'غنی متن']);
    const sheet = parseSheet(
      '<worksheet><sheetData><row r="2"><c r="B2" t="s"><v>0</v></c><c r="D2"><v>1.5</v></c><c r="E2" t="b"><v>1</v></c>' +
        '<c r="F2" t="e"><v>#DIV/0!</v></c><c r="G2" t="inlineStr"><is><t>درون</t></is></c><c r="H2" t="str"><v>a&amp;b</v></c><c r="I2"/></row></sheetData></worksheet>',
      ['متن'],
    );
    expect(sheet[0]).toEqual([]);
    expect(sheet[1]).toEqual([undefined, 'متن', undefined, 1.5, true, null, 'درون', 'a&b']);
  });

  it('falls back to SheetJS for CSV and returns the same shape', () => {
    const book = utils.book_new();
    utils.book_append_sheet(
      book,
      utils.aoa_to_sheet([
        ['Symbol', 'Price'],
        ['الف', 10],
      ]),
      'S',
    );
    const csv = write(book, { type: 'buffer', bookType: 'csv' }) as Buffer;
    expect(readFirstSheetFast(toAb(csv))).toBeNull();
    const r = readWorkbook(toAb(csv));
    expect(r.ok && r.value[1]).toEqual(['الف', 10]);
  });

  it('reads an xlsx written by SheetJS (generic workbook structure)', () => {
    const book = utils.book_new();
    utils.book_append_sheet(
      book,
      utils.aoa_to_sheet([
        ['Symbol', 'Price', 'Note'],
        ['ب', 12.5, '-'],
      ]),
      'Data',
    );
    const xlsx = write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    expect(readFirstSheetFast(toAb(xlsx))).toEqual([
      ['Symbol', 'Price', 'Note'],
      ['ب', 12.5, '-'],
    ]);
  });
});
