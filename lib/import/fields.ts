/**
 * GrowthOS import field catalog (PRD §6.1 + App Flow §4.4 D3's field
 * list, folded together since there's no separate Companies screen).
 * `synonyms` drive the best-guess auto-mapping (App Flow §4.4, D4).
 */
export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  synonyms: string[];
}

export const IMPORT_FIELDS: ImportField[] = [
  { key: "full_name", label: "Full Name", required: true, synonyms: ["name", "full name", "contact name"] },
  { key: "email", label: "Email", required: true, synonyms: ["email", "email address"] },
  { key: "title", label: "Title", required: false, synonyms: ["title", "job title"] },
  { key: "phone", label: "Phone", required: false, synonyms: ["phone", "phone number"] },
  { key: "status", label: "Status", required: false, synonyms: ["status"] },
  { key: "company_name", label: "Company Name", required: false, synonyms: ["company", "company name", "account"] },
  { key: "company_website", label: "Company Website", required: false, synonyms: ["website", "company website", "domain"] },
  { key: "company_industry", label: "Company Industry", required: false, synonyms: ["industry"] },
  { key: "company_size", label: "Employee Size", required: false, synonyms: ["employee size", "company size", "employees"] },
  { key: "company_city", label: "Company City", required: false, synonyms: ["city", "company city"] },
  { key: "company_state", label: "Company State", required: false, synonyms: ["state", "company state"] },
  { key: "notes", label: "Notes", required: false, synonyms: ["notes"] },
];

export type ImportMapping = Record<string, string | null>;

export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

  for (const field of IMPORT_FIELDS) {
    const matchIndex = normalizedHeaders.findIndex((h) => field.synonyms.includes(h));
    mapping[field.key] = matchIndex >= 0 ? headers[matchIndex] : null;
  }

  return mapping;
}
