import { arrayAnswer } from "@/lib/questionnaire/questions";

/**
 * The Ideal Customer Profile as the Vision Board reads it. It is sourced
 * from the account's GrowthMission Solution Questionnaire rather than
 * captured again (client-confirmed, 2026-09-16), so it is a view of someone
 * else's answers, not a field.
 *
 * The first three were all the questionnaire had until the SniperLeads ICP
 * Worksheet joined it (client-confirmed, 2026-10-14, "ICP Questionnaire
 * Steps"); the rest come from those five new steps. The same profile feeds
 * the wizard's read-only card, the Vision Page's "Who we serve" band and
 * the matching PDF page, so the three can never disagree.
 */
export interface IcpAnswers {
  targetMarket: string | null;
  focusesOnVerticals: boolean | null;
  hvcDefined: boolean | null;
  /** In rank order, 1 first. */
  industries: string[];
  industriesOther: string | null;
  companySize: string[];
  coverage: string | null;
  decisionMakers: string[];
  leadTypes: string[];
  competitors: string[];
  challenges: string[];
  /**
   * The rest of the ICP Worksheet, read for the ICP Mission Card's profile
   * (client-confirmed, 2026-10-23, approved mockup "ICP & List Building
   * Cards"). The Vision Board doesn't show these.
   */
  itEnvironment: string[];
  softwareStack: string | null;
  painPoints: string | null;
  compliance: string | null;
  growthStage: string | null;
  budget: string | null;
  valueProp: string | null;
  keyMessages: string | null;
  dosDonts: string | null;
  intentTopics: string[];
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const yesNo = (v: unknown) => (v === "yes" ? true : v === "no" ? false : null);

export function icpFromQuestionnaire(answers: Record<string, unknown>): IcpAnswers {
  // "Other" is replaced by what was typed for it, so the summary names the role.
  const otherRole = text(answers.icp_decision_makers_other);
  const decisionMakers = arrayAnswer(answers.icp_decision_makers).flatMap((d) =>
    d === "Other" ? (otherRole ? [otherRole] : []) : [d]
  );
  const challengesOther = text(answers.icp_challenges_other);
  const itOther = text(answers.icp_it_environment_other);

  return {
    targetMarket: text(answers.overview_target_market),
    focusesOnVerticals: yesNo(answers.overview_verticals),
    hvcDefined: yesNo(answers.overview_hvc_defined),
    industries: arrayAnswer(answers.icp_industries),
    industriesOther: text(answers.icp_industries_other),
    companySize: arrayAnswer(answers.icp_company_size),
    coverage: text(answers.icp_locations),
    decisionMakers,
    leadTypes: arrayAnswer(answers.icp_lead_types),
    competitors: arrayAnswer(answers.icp_competitors),
    challenges: [...arrayAnswer(answers.icp_challenges), ...(challengesOther ? [challengesOther] : [])],
    itEnvironment: [...arrayAnswer(answers.icp_it_environment), ...(itOther ? [itOther] : [])],
    softwareStack: text(answers.icp_software_stack),
    painPoints: text(answers.icp_pain_points),
    compliance: text(answers.icp_compliance),
    growthStage: text(answers.icp_growth_stage),
    budget: text(answers.icp_budget),
    valueProp: text(answers.icp_value_prop),
    keyMessages: text(answers.icp_key_messages),
    dosDonts: text(answers.icp_dos_donts),
    intentTopics: arrayAnswer(answers.icp_intent_topics),
  };
}

/** The label/value facts shown under the ranked industries, unanswered ones left out. */
export function icpFacts(icp: IcpAnswers): { label: string; value: string }[] {
  return [
    { label: "Company size", value: icp.companySize.length ? `${icp.companySize.join(", ")} employees` : "" },
    { label: "Coverage area", value: icp.coverage ?? "" },
    { label: "Decision makers", value: icp.decisionMakers.join(", ") },
    { label: "Leads we want", value: icp.leadTypes.join(", ") },
    { label: "Who we compete with", value: icp.competitors.join(", ") },
    { label: "Their challenges", value: icp.challenges.join("; ") },
  ].filter((f) => f.value);
}

/** Whether there is enough of the ICP to give it a band or a page of its own. */
export function hasIcpProfile(icp: IcpAnswers): boolean {
  return icp.industries.length > 0 || icpFacts(icp).length > 0;
}
