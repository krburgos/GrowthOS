/**
 * The VictoryVisit After-Action Report (client-confirmed, 2026-10-05).
 *
 * This is a transcription of the client's own "Victory Visit Report.pdf" —
 * all seventeen sections, in the document's order, with its wording kept
 * rather than tidied. "Desk Tops" is two words on the form, the trademark
 * signs are where the client puts them, and the Within-2-Business-Days list
 * carries the two verdict lines that sit inside it on the page. Anything
 * reworded here would quietly stop matching the paper the advocates carry.
 *
 * Structure lives in code and answers live in one jsonb column, the same
 * split as lib/questionnaire/questions.ts and lib/vision-board/sections.ts
 * (Backend Schema §6.6a). The reasoning recorded on the questionnaire table
 * applies here too and more strongly: the document has ~55 checkboxes and
 * ~15 free-text fields, so a column each would be seventy columns and a
 * migration every time the client revises the form.
 *
 * Field keys are the jsonb keys and are therefore permanent. Renaming one
 * orphans every answer already stored under it.
 */

export type FieldKind =
  | "text"
  | "textarea"
  | "date"
  | "time"
  | "number"
  /** Independent checkboxes; the answer is an array of the ticked labels. */
  | "checklist"
  /** One of several; the answer is the chosen label. */
  | "choice"
  /** The form's Yes/No pairs; the answer is a boolean. */
  | "yesno";

export interface ReportField {
  key: string;
  label: string;
  kind: FieldKind;
  /** For checklist and choice. The stored answer is the label itself, so
   *  these strings are as permanent as the keys. */
  options?: readonly string[];
  placeholder?: string;
  /** The document's own inline label, e.g. "Snack Drop Count". */
  suffix?: string;
  /** A checklist whose "Other" box has a write-in line beside it. */
  otherKey?: string;
}

export interface ReportSection {
  key: string;
  title: string;
  /** The sub-heading the document prints under the section title. */
  intro?: string;
  fields: readonly ReportField[];
}

/** The strapline under every page header on the client's form. */
export const REPORT_STRAPLINE = "Because conversations create opportunities, but eye contact accelerates trust.";
export const REPORT_BRAND_LINE = "AdvocateDash™ | Victory Happens Face-to-Face™";
export const REPORT_DOC_TITLE = "AdvocateDash™ · VictoryVisit™ · After-Action Report";

export const REPORT_SECTIONS: readonly ReportSection[] = [
  {
    key: "pre_visit",
    title: "Advocate pre-visit checklist",
    fields: [
      {
        key: "preparation",
        label: "Preparation",
        kind: "checklist",
        options: [
          "Packet received",
          "Reviewed Map Plan",
          "Reviewed account information",
          "Printed/delivered materials prepared",
          "Business cards available",
          "Company brochure available",
          "Invitation materials available",
          "GPS route planned",
          "Visit objective understood",
        ],
      },
      {
        key: "personal_presentation",
        label: "Personal presentation",
        kind: "checklist",
        options: [
          "Professional attire",
          "Name badge (if required)",
          "Materials organized",
          "Mobile device charged",
        ],
      },
    ],
  },
  {
    key: "visit_details",
    title: "VictoryVisit report",
    fields: [
      { key: "advocate_name", label: "Advocate", kind: "text", placeholder: "Who made the visit" },
      { key: "visit_date", label: "Date", kind: "date" },
      { key: "target_account", label: "Target account", kind: "text" },
      { key: "contact_name_title", label: "Contact name/title", kind: "text", placeholder: "e.g. CEO" },
      { key: "account_address", label: "Account address", kind: "text" },
      { key: "time_of_arrival", label: "Time of arrival", kind: "time" },
      { key: "time_of_departure", label: "Time of departure", kind: "time" },
    ],
  },
  {
    key: "objective",
    title: "Visit objective – special instructions",
    fields: [
      {
        key: "visit_objective",
        label: "Objective",
        kind: "checklist",
        options: [
          "VictoryVisit Package – Personal Note, Brochure, Gift, & Treat(s)",
          "Follow up Visit Package",
          "Event Promotion",
          "On Going General Awareness Visit",
          "Market Intelligence Gathering",
          "Competitive Intelligence",
          "Other",
        ],
        otherKey: "visit_objective_other",
      },
    ],
  },
  {
    key: "location_status",
    title: "Location status",
    fields: [
      {
        key: "location_status",
        label: "Status",
        kind: "checklist",
        options: [
          "Confirmed Active Business",
          "Confirmed Exterior Documented - Picture Taken",
          "Multi-Tenant Building – Directory Picture Documented",
          "Address Incorrect – Documented – Picture Taken",
          "Unable to Access – Secured Entry",
        ],
      },
    ],
  },
  {
    key: "office_description",
    title: "Office description",
    fields: [
      {
        key: "office_description",
        label: "Office description",
        kind: "textarea",
        placeholder: "The building, the floor, how many other practices or tenants",
      },
    ],
  },
  {
    key: "contact_information",
    title: "Contact information",
    fields: [
      {
        key: "contact_outcome",
        label: "Who was reached",
        kind: "checklist",
        options: ["Primary Contact Met", "Target Reached", "Gate Keeper"],
      },
      { key: "gatekeeper_name", label: "Gate keeper name", kind: "text" },
      { key: "gatekeeper_title", label: "Gate keeper title", kind: "text" },
      {
        key: "additional_contacts",
        label: "Additional contacts identified",
        kind: "textarea",
      },
    ],
  },
  {
    key: "visit_summary",
    title: "VictoryVisit™ summary",
    intro: "What happened during the visit?",
    fields: [
      {
        key: "package_delivered",
        label: "Delivery",
        kind: "checklist",
        options: ["VictoryVisit Package Delivered"],
      },
      { key: "snack_drop_count", label: "Snack drop count", kind: "number" },
      {
        key: "summary_notes",
        label: "Notes",
        kind: "textarea",
        placeholder: "Who you spoke to, what was said, how it was left",
      },
    ],
  },
  {
    key: "engagement",
    title: "Engagement level",
    fields: [
      {
        key: "engagement_level",
        label: "Level",
        kind: "choice",
        options: ["Very Receptive", "Receptive", "Neutral", "Not Interested", "Unable to Engage"],
      },
      { key: "engagement_notes", label: "Notes", kind: "textarea" },
    ],
  },
  {
    key: "business_intelligence",
    title: "Business intelligence",
    intro: "Observed company office personal (users) size estimate",
    fields: [
      {
        key: "size_estimate",
        label: "Size estimate",
        kind: "choice",
        options: ["1-10 Employees", "11-25 Employees", "26-50 Employees", "51+ Employees"],
      },
    ],
  },
  {
    key: "technology_intelligence",
    title: "Technology intelligence",
    intro: "Existing IT relationship",
    fields: [
      {
        key: "it_relationship",
        label: "Relationship",
        kind: "choice",
        options: ["Existing MSP", "Internal IT", "Hybrid Environment", "Unknown"],
      },
      {
        key: "msp_identified",
        label: "MSP identified (if known)",
        kind: "textarea",
        placeholder: "Who handles their IT today, and how that came up",
      },
    ],
  },
  {
    key: "technology_observed",
    title: "Technology observed",
    fields: [
      {
        key: "technology_observed",
        label: "Observed",
        kind: "checklist",
        options: ["Desk Tops", "Laptops", "Multiple Monitors", "WiFi"],
      },
      { key: "technology_notes", label: "Notes", kind: "textarea" },
    ],
  },
  {
    key: "photo_verification",
    title: "Photo & verification",
    fields: [
      {
        key: "verification",
        label: "Verified",
        kind: "checklist",
        options: [
          "Building Photo Attached",
          "Business Sign Verified",
          "GPS Location Verified",
          "Building Directory",
        ],
      },
    ],
  },
  {
    key: "executive_summary",
    title: "Executive summary",
    fields: [
      { key: "contact_made", label: "Contact made", kind: "yesno" },
      { key: "decision_maker_identified", label: "Decision maker identified", kind: "yesno" },
      { key: "competitor_intel_gathered", label: "Competitor intelligence gathered", kind: "yesno" },
      { key: "buying_signals_found", label: "Buying signals found", kind: "yesno" },
      { key: "meeting_opportunity_identified", label: "Meeting opportunity identified", kind: "yesno" },
      { key: "one_sentence_summary", label: "One-sentence summary", kind: "textarea" },
    ],
  },
  {
    key: "materials",
    title: "Materials & assets utilized",
    intro: "Materials used during this Victory Visit™",
    fields: [
      {
        key: "materials_used",
        label: "Materials",
        kind: "checklist",
        options: ["Personalized VictoryVisit Package", "Treats", "Business Card", "Other"],
        otherKey: "materials_used_other",
      },
    ],
  },
  {
    key: "follow_up",
    title: "Follow-up recommendation",
    intro: "Recommended follow-up sequence",
    fields: [
      {
        key: "follow_up_2_days",
        label: "Within 2 business days",
        kind: "checklist",
        options: [
          "Personal Email – Leverage VictoryVisit Report",
          "SDR Follow-Up Call",
          "Executive Outreach (introduce yourself call)",
          "LinkedIn Connection Request",
          "Ask for Discovery Meeting or Onsite Meeting",
          "Future VictoryVisit™ Recommended",
          "No Further Action Recommended (Not a Fit)",
        ],
      },
      { key: "follow_up_comments", label: "Additional comments", kind: "textarea" },
      {
        key: "follow_up_14_days",
        label: "Within 14 days",
        kind: "checklist",
        options: [
          "Executive Outreach",
          "Additional SDR Attempt",
          "Add to Nurture Campaign",
          "Schedule Follow-Up Victory Visit™",
          "Request Introduction to Decision Maker",
        ],
      },
    ],
  },
  {
    key: "meeting_opportunity",
    title: "Meeting opportunity",
    intro: "Was a meeting requested or discussed?",
    fields: [
      {
        key: "meeting_requested",
        label: "Requested or discussed",
        kind: "choice",
        options: ["Yes", "No", "Potential Future Meeting"],
      },
      { key: "meeting_date_discussed", label: "Date discussed", kind: "text" },
      { key: "meeting_decision_maker", label: "Decision maker", kind: "text" },
      { key: "meeting_attendees", label: "Recommended attendees", kind: "text" },
      { key: "meeting_notes", label: "Notes", kind: "textarea" },
    ],
  },
  {
    key: "summation",
    title: "Advocate's summation",
    fields: [
      {
        key: "summation",
        label: "Summation",
        kind: "textarea",
        placeholder: "How the visit went overall, and what it tells us about the account",
      },
      {
        key: "summation_recommendation",
        label: "Recommendation",
        kind: "textarea",
        placeholder: "What should happen next, and when",
      },
      { key: "advocate_signature", label: "Advocate signature", kind: "text" },
      { key: "submission_date", label: "Report submission date", kind: "date" },
    ],
  },
] as const;

/** Every answer in one object, keyed by field key. Shapes vary by kind. */
export type ReportAnswers = Record<string, string | number | boolean | string[] | null | undefined>;

/** True when the reader has put something in this field. */
export function fieldAnswered(field: ReportField, answers: ReportAnswers): boolean {
  const value = answers[field.key];
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return true;
  return value.trim().length > 0;
}

/** A section counts as done once any of its fields carries an answer — the
 *  form is a record of one visit, and plenty of its boxes legitimately stay
 *  empty (no gatekeeper, no meeting discussed). Requiring every field would
 *  mean no report was ever complete. */
export function sectionAnswered(section: ReportSection, answers: ReportAnswers): boolean {
  return section.fields.some((f) => fieldAnswered(f, answers));
}

/** "5 of 17 sections" for the progress line above the form. */
export function reportProgress(answers: ReportAnswers): { done: number; total: number } {
  return {
    done: REPORT_SECTIONS.filter((s) => sectionAnswered(s, answers)).length,
    total: REPORT_SECTIONS.length,
  };
}

/** The checklist labels a reader ticked, in the order the form lists them. */
export function tickedOptions(field: ReportField, answers: ReportAnswers): string[] {
  const value = answers[field.key];
  if (!Array.isArray(value)) return [];
  return (field.options ?? []).filter((o) => value.includes(o));
}
