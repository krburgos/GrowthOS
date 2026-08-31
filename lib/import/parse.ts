import Papa from "papaparse";
import ExcelJS from "exceljs";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
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
      headers[colNumber - 1] = String(cell.value ?? "").trim();
    });

    const rows: Record<string, string>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        const cell = row.getCell(index + 1);
        record[header] = cell.value != null ? String(cell.value).trim() : "";
      });
      if (Object.values(record).some((v) => v !== "")) {
        rows.push(record);
      }
    });

    return { headers, rows };
  }

  throw new Error("Unsupported file type — upload a .csv or .xlsx file.");
}
