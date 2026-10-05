/**
 * The two worked examples behind the buttons at the top of the AdvocateDash
 * workstream page (client-confirmed, 2026-10-05): "Sample Dropby Report"
 * and "Sample Victory Visit Report".
 *
 * Both are transcribed from the client's own documents — "AdvocateDash
 * Dropby letter.docx" and "Victory Visit Report.pdf" — and both are static
 * and identical for every account. They are the model an MSP looks at to
 * see what the service produces, so they are built into the app rather than
 * uploaded per tenant: there is nothing account-specific to vary, and an
 * upload would let one tenant's sample drift from another's.
 *
 * The visit report sample is stored as ReportAnswers so the same form
 * component renders it read-only. That keeps the sample honest — it cannot
 * show a field the real form does not have, or miss one it does.
 */

import type { ReportAnswers } from "@/lib/advocate-dash/report-form";

/**
 * The drop-by letter, verbatim from the client's template. The bracketed
 * placeholders are the client's own and are left in: this is the sample, so
 * it shows an MSP exactly what they would be filling in.
 */
export const SAMPLE_LETTER = {
  greeting: "Hello!",
  intro: "Just a quick introduction.",
  paragraphs: [
    "We’re Sample MSP Company, and we help local businesses with their IT and cybersecurity needs.",
    "Rather than sending you another email or making another cold call, we thought we’d do something a little different and actually stop by to say hello.",
    "There’s no big sales pitch attached to this note. We simply wanted to introduce our company and let you know that if you ever need IT support, have a technology question, or want a second opinion on your current setup, we’d be happy to help.",
    "Hopefully, we’ll have a chance to meet you soon.",
  ],
  signOff: "All the best,",
  signature: ["[Name]", "[Title]", "Sample MSP Company", "[Contact Information]"],
} as const;

/** The account the client's sample report was filed for. */
export const SAMPLE_REPORT_HEADER = {
  accountName: "ABTech - Boston",
  targetName: "Dr. Spock Plastic Surgery",
  advocate: "Barbara E.",
  visitDate: "5 July 2026",
} as const;

/**
 * The completed VictoryVisit report from the client's PDF, answer for
 * answer. Checklist values must match the option labels in
 * report-form.ts exactly, or the sample renders with nothing ticked.
 */
export const SAMPLE_REPORT_ANSWERS: ReportAnswers = {
  // Pre-visit checklist — the client's sample leaves these unmarked, which
  // is worth preserving: it shows the advocate fills the checklist before
  // setting out, not when writing the report up afterwards.
  preparation: [],
  personal_presentation: [],

  advocate_name: "Barbara E.",
  visit_date: "2026-07-05",
  target_account: "Dr. Spock Plastic Surgery",
  contact_name_title: "CEO",
  account_address: "123 Main Street, Newton MA",
  time_of_arrival: "08:00",
  time_of_departure: "08:25",

  visit_objective: ["VictoryVisit Package – Personal Note, Brochure, Gift, & Treat(s)"],

  location_status: ["Confirmed Active Business"],

  office_description: "Healthcare building with approximately 20 practices, Dr Spock on 2nd Floor",

  contact_outcome: ["Primary Contact Met", "Target Reached"],

  package_delivered: ["VictoryVisit Package Delivered"],
  snack_drop_count: 8,
  summary_notes:
    "The manager came out to greet me, and I personally handed over your note. During our brief conversation, I asked whether they were happy with their current IT provider. The manager replied, “Mostly.”\n\nI responded by saying, “That’s great. Please keep us in mind if you’d ever like a second opinion or need assistance during an emergency.” The manager said they would.\n\nSince this was an unannounced visit, I noted that I didn’t want to take up any more of their time. Before leaving, I dropped off treats for the team as a small thank-you for their attention and consideration. Outcome: Positive interaction. Message delivered directly to the decision-maker. Future discussions were welcomed if circumstances change or an additional IT resource is needed.",

  engagement_level: "Very Receptive",
  engagement_notes:
    "As I was departing, several team members expressed appreciation for the treats that were left for the office. I also observed the decision-maker reviewing the trifold brochure, indicating that the materials were receiving immediate attention. Overall, the interaction was positive, and the visit helped create a friendly and memorable impression.",

  size_estimate: "11-25 Employees",

  it_relationship: "Existing MSP",
  msp_identified:
    "While the office manager was locating the doctor, I asked who currently handled their IT services. The office manager explained that a friend of the doctor provides their IT support, but they are beginning to outgrow that individual’s capabilities.\n\nI replied that we often work alongside existing IT contacts and can provide the additional expertise, resources, and support that growing organizations need, allowing the doctor to maintain that trusted relationship while ensuring their technology needs are fully covered. The office manager responded positively to the idea and appeared receptive to the conversation.",

  technology_observed: ["Desk Tops", "Laptops", "Multiple Monitors", "WiFi"],
  technology_notes: "I saw all of the above and what appeared to be tablets.",

  verification: [
    "Building Photo Attached",
    "Business Sign Verified",
    "GPS Location Verified",
    "Building Directory",
  ],

  contact_made: true,
  decision_maker_identified: true,
  competitor_intel_gathered: true,
  buying_signals_found: true,
  meeting_opportunity_identified: true,
  one_sentence_summary:
    "I also mentioned that you would be available for a discovery call at their convenience and that you would be sending a brief introductory email. They were receptive to that approach and understood that the purpose of the outreach was simply to establish a connection and be available as a resource should the need arise in the future.",

  materials_used: ["Personalized VictoryVisit Package", "Treats"],

  follow_up_2_days: [
    "Personal Email – Leverage VictoryVisit Report",
    "SDR Follow-Up Call",
    "Executive Outreach (introduce yourself call)",
    "LinkedIn Connection Request",
    "Future VictoryVisit™ Recommended",
  ],
  follow_up_comments:
    "It appears we successfully got them thinking about their IT strategy and whether their current support model can continue to meet their needs as the practice grows.\n\nI would recommend sending the introductory email we discussed, followed by a brief phone call to establish a personal connection and gauge interest. If the opportunity has not progressed within three to four weeks, a follow-up Victory Visit would be worthwhile to reinforce the relationship, maintain visibility, and continue building familiarity with your organization.\n\nBased on the conversations during the visit, there may be an opportunity to position your services as a complementary resource that can support their existing IT provider as their technology requirements expand.",
  follow_up_14_days: [
    "Executive Outreach",
    "Additional SDR Attempt",
    "Add to Nurture Campaign",
    "Schedule Follow-Up Victory Visit™",
    "Request Introduction to Decision Maker",
  ],

  meeting_requested: "Potential Future Meeting",

  summation:
    "This was a very successful and compelling Victory Visit. I received significantly more attention and engagement from the staff and decision-makers than is typical during an unannounced visit.\n\nMy sense is that they do not receive many in-person, unscheduled business visits, which worked to our advantage. Rather than appearing annoyed by the surprise visit, the team seemed receptive to the interaction and appreciative of the personal approach.\n\nThe visit generated meaningful conversations about their current IT situation, introduced your organization in a professional and memorable way, and created a level of awareness that did not previously exist.",
  summation_recommendation:
    "I recommend another Victory Visit within the next three to four weeks while the interaction is still fresh in their minds. This follow-up visit will help maintain the visibility and attention we have established. After that, a visit every other month would be appropriate to continue building familiarity and trust until they are ready to engage or until we determine that further outreach is unlikely to produce additional opportunities.\n\nAt this stage, I believe the account remains very much in play, and consistent, professional follow-up will give us the best chance of converting today’s positive impression into a future business relationship.",
  advocate_signature: "Barbara E.",
  submission_date: "2026-07-05",
};
