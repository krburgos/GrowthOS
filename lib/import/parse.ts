import Papa from "papaparse";
import ExcelJS from "exceljs";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * One cell's text. Excel marks a number typed as text ('+1 603…) with a
 * leading apostrophe, and some exports keep it in the file; it is never
 * part of the value, so it's dropped (bug fix, 2026-10-22: company phones
 * were importing as "'+1 603-598-4526").
 */
function cellText(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/^'(?=\S)/, "");
}

/**
 * Backend Schema §10 — POST /api/import/validate parses CSV via papaparse
 * and XLSX via ExcelJS (Tech Stack Lockfile §3.7).
 */
export async function parseImportFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      transform: (value) => cellText(value),
    });
    const headers = result.meta.fields ?? [];
    return { headers, rows: result.data };
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return { headers: [], rows: [] };

    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.text.trim();
    });

    const rows: Record<string, string>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        // cell.text, not cell.value: a hyperlink or rich-text cell's value is
        // an object, which imported as "[object Object]" (bug fix, 2026-10-30:
        // every Top7 / ProTech contact landed on one company that way).
        const cell = row.getCell(index + 1);
        record[header] = cell.value != null ? cellText(cell.text) : "";
      });
      if (Object.values(record).some((v) => v !== "")) {
        rows.push(record);
      }
    });

    return { headers, rows };
  }

  throw new Error("Unsupported file type — upload a .csv or .xlsx file.");
}
