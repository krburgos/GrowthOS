/**
 * GrowthOS import field catalog (PRD §6.1 + App Flow §4.4 D3's field
 * list, folded together since there's no separate Companies screen).
 * `synonyms` drive the best-guess auto-mapping (App Flow §4.4, D4).
 *
 * Client-confirmed field split: full_name → first_name/last_name (CSV
 * files usually carry these separately). Score, Temp, and a contact-
 * level LinkedIn link are new fields with no prior PRD/Backend Schema
 * mention; Company Phone/Address 1 are new company-level fields.
 */
export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  synonyms: string[];
}

export const IMPORT_FIELDS: ImportField[] = [
  { key: "first_name", label: "First Name", required: true, synonyms: ["first name", "firstname", "given name"] },
  { key: "last_name", label: "Last Name", required: false, synonyms: ["last name", "lastname", "surname", "family name"] },
  { key: "email", label: "Email", required: true, synonyms: ["email", "email address"] },
  { key: "title", label: "Title", required: false, synonyms: ["title", "job title"] },
  { key: "phone", label: "Mobile Phone", required: false, synonyms: ["phone", "phone number", "mobile phone", "mobile", "cell"] },
  { key: "status", label: "Status", required: false, synonyms: ["status"] },
  { key: "score", label: "Score", required: false, synonyms: ["score"] },
  { key: "temperature", label: "Temp", required: false, synonyms: ["temp", "temperature"] },
  { key: "linkedin_url", label: "LinkedIn", required: false, synonyms: ["linkedin", "linkedin url", "linkedin link"] },
  { key: "company_name", label: "Company Name", required: false, synonyms: ["company", "company name", "account"] },
  { key: "company_website", label: "Company Website", required: false, synonyms: ["website", "company website", "domain"] },
  { key: "company_linkedin_url", label: "Company LinkedIn", required: false, synonyms: ["company linkedin", "company linkedin url", "company linkedin link"] },
  { key: "company_industry", label: "Company Industry", required: false, synonyms: ["industry"] },
  { key: "company_size", label: "Employee Size", required: false, synonyms: ["employee size", "company size", "employees"] },
  { key: "company_phone", label: "Company Phone", required: false, synonyms: ["company phone", "company phone number"] },
  { key: "company_address_line1", label: "Company Address", required: false, synonyms: ["company address", "company address 1", "address", "address 1"] },
  { key: "company_city", label: "Company City", required: false, synonyms: ["city", "company city"] },
  { key: "company_state", label: "Company State", required: false, synonyms: ["state", "company state"] },
  { key: "notes", label: "Notes", required: false, synonyms: ["notes"] },
];

export type ImportMapping = Record<string, string | null>;

/** Underscores/hyphens collapse to spaces so a literal header like
 * "first_name" matches the "first name" synonym — a real mismatch
 * found in testing (a "full_name" header didn't match "full name"). */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const normalizedHeaders = headers.map(normalize);

  for (const field of IMPORT_FIELDS) {
    const synonyms = field.synonyms.map(normalize);
    const matchIndex = normalizedHeaders.findIndex((h) => synonyms.includes(h));
    mapping[field.key] = matchIndex >= 0 ? headers[matchIndex] : null;
  }

  return mapping;
}
