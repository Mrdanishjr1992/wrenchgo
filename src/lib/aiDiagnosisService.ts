export const AI_DIAGNOSIS_ENABLED = true;

export type TriageLevel = "low" | "medium" | "high";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface ClarifyingQuestion {
  text: string;
  why: string;
  send_channel: "message";
  answered?: boolean;
}

export interface LikelyCause {
  label: string;
  confidence: ConfidenceLevel;
  reason: string;
}

export interface NextStep {
  action: string;
  reason: string;
  requires_inspection: boolean;
}

export interface QuoteGuidance {
  recommend_diagnostic_first: boolean;
  disclaimer: string;
  labor_range_hint: string;
}

export interface DocumentationTemplate {
  complaint: string;
  checks: string[];
  findings: string;
  recommendation: string;
  customer_approval: string;
}

export interface DiagnosisResult {
  triage_level: TriageLevel;
  clarifying_questions: ClarifyingQuestion[];
  likely_causes: LikelyCause[];
  next_steps: NextStep[];
  quote_guidance: QuoteGuidance;
  documentation_template: DocumentationTemplate;
}

export interface DiagnosisInput {
  leadId: string;
  title: string;
  description: string;
  category?: string;
  vehicleInfo?: {
    year?: number;
    make?: string;
    model?: string;
    mileage?: string;
  };
  images?: string[];
  mechanicLocation?: string;
  priorMessages?: string[];
}

const VAGUE_KEYWORDS = [
  "won't start",
  "wont start",
  "noise",
  "leak",
  "overheating",
  "not working",
  "problem",
  "issue",
  "weird",
  "strange",
  "help",
  "broken",
];

export function isDescriptionVague(description: string): boolean {
  const lower = description.toLowerCase();
  return VAGUE_KEYWORDS.some((kw) => lower.includes(kw)) || description.length < 50;
}

const MOCK_RESPONSES: Record<string, DiagnosisResult> = {
  wont_start: {
    triage_level: "low",
    clarifying_questions: [
      { text: "When you turn the key, do you hear any clicking sounds?", why: "Helps distinguish between battery, starter, and ignition issues", send_channel: "message" },
      { text: "Are your dashboard lights dim or flickering when you try to start?", why: "Indicates battery or alternator condition", send_channel: "message" },
      { text: "Did the car run fine before this happened, or were there warning signs?", why: "Helps identify if this is sudden failure or gradual decline", send_channel: "message" },
      { text: "Have you tried jump-starting the vehicle?", why: "Quick test to rule out dead battery", send_channel: "message" },
      { text: "How old is your current battery?", why: "Batteries typically last 3-5 years", send_channel: "message" },
      { text: "Is there any smell (burning, gas, etc.) when you try to start?", why: "Could indicate fuel or electrical issues", send_channel: "message" },
    ],
    likely_causes: [
      { label: "Dead or weak battery", confidence: "high", reason: "Most common cause of no-start conditions" },
      { label: "Faulty starter motor", confidence: "medium", reason: "If clicking is heard but engine doesn't turn" },
      { label: "Corroded battery terminals", confidence: "medium", reason: "Can prevent proper electrical connection" },
      { label: "Alternator failure", confidence: "low", reason: "Would have shown warning signs before complete failure" },
    ],
    next_steps: [
      { action: "Ask for photo/video of dashboard when starting", reason: "Visual confirmation of symptoms", requires_inspection: false },
      { action: "Battery/charging system test", reason: "Verify battery voltage and alternator output", requires_inspection: true },
      { action: "Inspect battery terminals", reason: "Check for corrosion or loose connections", requires_inspection: true },
      { action: "Starter circuit test", reason: "If battery tests good, check starter system", requires_inspection: true },
    ],
    quote_guidance: {
      recommend_diagnostic_first: false,
      disclaimer: "Final diagnosis requires on-site inspection. Additional issues may be discovered.",
      labor_range_hint: "30-60 minutes for diagnosis, additional time for repair",
    },
    documentation_template: {
      complaint: "Vehicle will not start",
      checks: ["Battery voltage test", "Terminal inspection", "Starter engagement test", "Alternator output test"],
      findings: "",
      recommendation: "",
      customer_approval: "",
    },
  },
  strange_noise: {
    triage_level: "medium",
    clarifying_questions: [
      { text: "Where does the noise seem to come from? (front, rear, engine, wheels)", why: "Location helps narrow down the source", send_channel: "message" },
      { text: "When does the noise occur? (starting, accelerating, braking, turning)", why: "Timing indicates which system is affected", send_channel: "message" },
      { text: "Can you describe the noise? (squealing, grinding, clicking, knocking)", why: "Sound type suggests specific components", send_channel: "message" },
      { text: "Does the noise change with speed or engine RPM?", why: "Helps distinguish between engine and drivetrain issues", send_channel: "message" },
      { text: "Is the noise constant or intermittent?", why: "Intermittent issues may need extended testing", send_channel: "message" },
      { text: "Can you send a video with the sound?", why: "Audio/visual helps accurate remote assessment", send_channel: "message" },
    ],
    likely_causes: [
      { label: "Worn brake pads/rotors", confidence: "medium", reason: "Common cause of squealing or grinding during braking" },
      { label: "Serpentine belt wear", confidence: "medium", reason: "Causes squealing, especially on startup" },
      { label: "Wheel bearing failure", confidence: "medium", reason: "Humming/grinding that changes with speed" },
      { label: "Suspension component wear", confidence: "low", reason: "Clunking over bumps or when turning" },
    ],
    next_steps: [
      { action: "Request video with sound", reason: "Audio helps identify noise type remotely", requires_inspection: false },
      { action: "Road test to reproduce noise", reason: "Confirm conditions that trigger the sound", requires_inspection: true },
      { action: "Visual inspection of suspected area", reason: "Look for obvious wear or damage", requires_inspection: true },
      { action: "Component-specific testing", reason: "Isolate the exact source", requires_inspection: true },
    ],
    quote_guidance: {
      recommend_diagnostic_first: true,
      disclaimer: "Noise diagnosis requires inspection. Quote covers diagnostic time only until source is confirmed.",
      labor_range_hint: "45-90 minutes for diagnosis depending on complexity",
    },
    documentation_template: {
      complaint: "Customer reports unusual noise",
      checks: ["Road test", "Visual inspection", "Component isolation test", "Brake inspection"],
      findings: "",
      recommendation: "",
      customer_approval: "",
    },
  },
  brake_issue: {
    triage_level: "high",
    clarifying_questions: [
      { text: "Are the brakes making any noise (squealing, grinding, scraping)?", why: "Indicates pad wear level", send_channel: "message" },
      { text: "Does the brake pedal feel soft, spongy, or go to the floor?", why: "Could indicate fluid leak or air in lines", send_channel: "message" },
      { text: "Does the vehicle pull to one side when braking?", why: "Suggests uneven brake wear or caliper issue", send_channel: "message" },
      { text: "Is the brake warning light on?", why: "May indicate low fluid or system fault", send_channel: "message" },
      { text: "When did you last have brake service?", why: "Helps estimate wear level", send_channel: "message" },
      { text: "Is the vehicle safe to drive to a shop, or should I come to you?", why: "Safety assessment for scheduling", send_channel: "message" },
    ],
    likely_causes: [
      { label: "Worn brake pads", confidence: "high", reason: "Most common brake complaint cause" },
      { label: "Warped or worn rotors", confidence: "medium", reason: "Causes pulsation or grinding" },
      { label: "Brake fluid leak", confidence: "medium", reason: "Soft pedal indicates possible leak" },
      { label: "Stuck caliper", confidence: "low", reason: "Causes pulling and uneven wear" },
    ],
    next_steps: [
      { action: "Advise limited driving until inspection", reason: "Brakes are safety-critical", requires_inspection: false },
      { action: "Visual brake inspection", reason: "Check pad thickness, rotor condition, fluid level", requires_inspection: true },
      { action: "Brake system test", reason: "Check for leaks, caliper function, line condition", requires_inspection: true },
      { action: "Road test with caution", reason: "Verify symptoms and brake performance", requires_inspection: true },
    ],
    quote_guidance: {
      recommend_diagnostic_first: false,
      disclaimer: "Brake issues are safety-critical. Full inspection required before any repair quote.",
      labor_range_hint: "60-120 minutes for full brake service",
    },
    documentation_template: {
      complaint: "Customer reports brake issue",
      checks: ["Pad thickness measurement", "Rotor inspection", "Fluid level and condition", "Caliper function test", "Line inspection"],
      findings: "",
      recommendation: "",
      customer_approval: "",
    },
  },
  default: {
    triage_level: "medium",
    clarifying_questions: [
      { text: "Can you describe the issue in more detail?", why: "More information helps accurate diagnosis", send_channel: "message" },
      { text: "When did you first notice this problem?", why: "Timeline helps identify cause", send_channel: "message" },
      { text: "Has anything changed recently (new parts, accident, weather)?", why: "Recent changes often relate to new issues", send_channel: "message" },
      { text: "Is the vehicle safe to drive?", why: "Safety assessment for scheduling", send_channel: "message" },
      { text: "Can you send photos or video of the issue?", why: "Visual aids help remote assessment", send_channel: "message" },
      { text: "What is your availability for an inspection?", why: "Schedule coordination", send_channel: "message" },
    ],
    likely_causes: [
      { label: "Requires inspection to determine", confidence: "low", reason: "Insufficient information for remote diagnosis" },
    ],
    next_steps: [
      { action: "Gather more information from customer", reason: "Need details for accurate assessment", requires_inspection: false },
      { action: "Request photos/video", reason: "Visual confirmation helps diagnosis", requires_inspection: false },
      { action: "Schedule inspection", reason: "On-site evaluation needed", requires_inspection: true },
    ],
    quote_guidance: {
      recommend_diagnostic_first: true,
      disclaimer: "This issue requires in-person inspection. Quote is for diagnostic time only.",
      labor_range_hint: "45-60 minutes for initial diagnosis",
    },
    documentation_template: {
      complaint: "",
      checks: ["Visual inspection", "System scan", "Road test if applicable"],
      findings: "",
      recommendation: "",
      customer_approval: "",
    },
  },
};

const diagnosisCache = new Map<string, { result: DiagnosisResult; timestamp: number; inputHash: string }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function hashInput(input: DiagnosisInput): string {
  return `${input.leadId}-${input.description}-${input.priorMessages?.join("|") || ""}`;
}

function getCategoryFromDescription(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes("start") || lower.includes("crank") || lower.includes("turn over")) return "wont_start";
  if (lower.includes("noise") || lower.includes("sound") || lower.includes("squeal") || lower.includes("grind")) return "strange_noise";
  if (lower.includes("brake") || lower.includes("stop") || lower.includes("pedal")) return "brake_issue";
  if (lower.includes("leak") || lower.includes("fluid") || lower.includes("drip")) return "leak";
  if (lower.includes("overheat") || lower.includes("hot") || lower.includes("temperature")) return "overheating";
  return "default";
}

export async function getDiagnosis(input: DiagnosisInput, forceRefresh = false): Promise<DiagnosisResult> {
  const inputHash = hashInput(input);
  const cached = diagnosisCache.get(input.leadId);
  
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL && cached.inputHash === inputHash) {
    return cached.result;
  }

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

  const category = input.category || getCategoryFromDescription(input.description);
  const baseResult = MOCK_RESPONSES[category] || MOCK_RESPONSES.default;

  // Customize the result based on input
  const result: DiagnosisResult = {
    ...baseResult,
    documentation_template: {
      ...baseResult.documentation_template,
      complaint: input.description || baseResult.documentation_template.complaint,
    },
  };

  // Adjust triage level for safety keywords
  const safetyKeywords = ["brake", "steering", "fuel leak", "smoke", "fire", "overheat"];
  if (safetyKeywords.some((kw) => input.description.toLowerCase().includes(kw))) {
    result.triage_level = "high";
  }

  diagnosisCache.set(input.leadId, { result, timestamp: Date.now(), inputHash });
  return result;
}

export function clearDiagnosisCache(leadId?: string): void {
  if (leadId) {
    diagnosisCache.delete(leadId);
  } else {
    diagnosisCache.clear();
  }
}

export function getSafetyMessage(triageLevel: TriageLevel): string {
  if (triageLevel === "high") {
    return "⚠️ SAFETY CONCERN: Based on the symptoms described, this may be a safety-critical issue. I recommend NOT driving the vehicle until it can be inspected. Would you like me to come to your location, or can we arrange a tow to a shop?";
  }
  return "";
}

export function formatQuestionForMessage(question: ClarifyingQuestion): string {
  return question.text;
}

export function formatDocumentationNote(template: DocumentationTemplate, findings: string, recommendation: string): string {
  const timestamp = new Date().toISOString();
  return `
=== DIAGNOSIS DOCUMENTATION ===
Date: ${timestamp}

CUSTOMER COMPLAINT:
${template.complaint}

CHECKS PERFORMED:
${template.checks.map((c) => `☐ ${c}`).join("\n")}

FINDINGS:
${findings || "[To be completed after inspection]"}

RECOMMENDATION:
${recommendation || "[To be completed after inspection]"}

CUSTOMER APPROVAL:
${template.customer_approval || "☐ Pending"}

---
Source: AI-Assisted Diagnosis
Note: Remote triage only - confirm on inspection
`.trim();
}
