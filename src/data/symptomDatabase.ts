export type SymptomData = {
  key: string;
  label: string;
  icon: string;
  education: {
    title: string;
    summary: string;
    is_it_safe: string;
    what_we_check: string;
    how_quotes_work: string;
  };
  questions: {
    id: string;
    question: string;
    options: string[];
    explanation?: string;
  }[];
};

export const symptomDatabase: Record<string, SymptomData> = {
  wont_start: {
    key: "wont_start",
    label: "Won't start",
    icon: "🚨",
    education: {
      title: "Car Won't Start",
      summary: "Most no-start issues are related to the battery, starter, or fuel system. A quick diagnosis can identify the exact cause.",
      is_it_safe: "Don't drive - needs diagnosis first",
      what_we_check: "Battery voltage, starter motor, fuel pump, ignition system",
      how_quotes_work: "Diagnostic fee first, then repair quote based on findings",
    },
    questions: [
      {
        id: "q1",
        question: "What happens when you turn the key?",
        options: ["Nothing at all", "Clicking sound", "Engine cranks but won't start", "Not sure"],
        explanation: "This helps identify if it's electrical or fuel-related",
      },
      {
        id: "q2",
        question: "Are your dashboard lights working?",
        options: ["Yes, normal", "Dim or flickering", "Not working", "Not sure"],
        explanation: "Dashboard lights indicate battery health",
      },
    ],
  },
  warning_light: {
    key: "warning_light",
    label: "Warning light",
    icon: "🔔",
    education: {
      title: "Warning Light On",
      summary: "Warning lights indicate your car's computer detected an issue. Some are urgent, others can wait. We'll help you understand what it means.",
      is_it_safe: "Depends on the light - we'll assess",
      what_we_check: "Diagnostic scan, sensor readings, system health",
      how_quotes_work: "Diagnostic scan first, then repair estimate",
    },
    questions: [
      {
        id: "q1",
        question: "Which light is on?",
        options: ["Check Engine", "ABS/Brake", "Oil pressure", "Battery", "Other/Multiple"],
      },
      {
        id: "q2",
        question: "Is the light solid or flashing?",
        options: ["Solid", "Flashing", "Not sure"],
        explanation: "Flashing lights usually indicate more urgent issues",
      },
    ],
  },
  brakes_wrong: {
    key: "brakes_wrong",
    label: "Brakes feel wrong",
    icon: "🛑",
    education: {
      title: "Brake Issues",
      summary: "Brake problems should never be ignored. Whether it's noise, soft pedal, or pulling, we'll inspect the entire system for safety.",
      is_it_safe: "Drive carefully - get checked ASAP",
      what_we_check: "Pads, rotors, fluid, calipers, brake lines",
      how_quotes_work: "Inspection first, then itemized repair quote",
    },
    questions: [
      {
        id: "q1",
        question: "What do you notice when braking?",
        options: ["Grinding noise", "Squealing", "Soft/spongy pedal", "Pulls to one side", "Vibration"],
      },
      {
        id: "q2",
        question: "How long has this been happening?",
        options: ["Just started", "Few days", "Few weeks", "Longer"],
      },
    ],
  },
  strange_noise: {
    key: "strange_noise",
    label: "Strange noise",
    icon: "🔊",
    education: {
      title: "Unusual Sounds",
      summary: "Different noises point to different issues. Describing when and where you hear it helps mechanics diagnose faster.",
      is_it_safe: "Usually safe to drive short distances",
      what_we_check: "Belts, bearings, exhaust, suspension components",
      how_quotes_work: "Diagnostic inspection, then repair estimate",
    },
    questions: [
      {
        id: "q1",
        question: "What kind of noise?",
        options: ["Squealing", "Grinding", "Knocking", "Rattling", "Humming", "Other"],
      },
      {
        id: "q2",
        question: "When do you hear it?",
        options: ["When starting", "While driving", "When turning", "When braking", "All the time"],
      },
    ],
  },
  fluid_leak: {
    key: "fluid_leak",
    label: "Fluid leak",
    icon: "💧",
    education: {
      title: "Fluid Leak",
      summary: "Different fluids mean different issues. The color and location help identify what's leaking and how urgent it is.",
      is_it_safe: "Depends on fluid type - we'll assess",
      what_we_check: "Leak source, fluid levels, hoses, seals",
      how_quotes_work: "Inspection to locate leak, then repair quote",
    },
    questions: [
      {
        id: "q1",
        question: "What color is the fluid?",
        options: ["Clear/water", "Green/yellow", "Red/pink", "Brown/black", "Not sure"],
      },
      {
        id: "q2",
        question: "Where is the puddle?",
        options: ["Front of car", "Middle", "Back", "Not sure"],
      },
    ],
  },
  battery_issues: {
    key: "battery_issues",
    label: "Battery issues",
    icon: "🔋",
    education: {
      title: "Battery Problems",
      summary: "Battery issues can be the battery itself, alternator, or electrical system. Testing will identify the root cause.",
      is_it_safe: "Safe to drive if it starts",
      what_we_check: "Battery voltage, alternator output, connections",
      how_quotes_work: "Quick test, then replacement or repair quote",
    },
    questions: [
      {
        id: "q1",
        question: "What's happening?",
        options: ["Slow to start", "Won't hold charge", "Electrical issues", "Battery light on"],
      },
      {
        id: "q2",
        question: "How old is your battery?",
        options: ["Less than 2 years", "2-4 years", "4+ years", "Not sure"],
      },
    ],
  },
  maintenance: {
    key: "maintenance",
    label: "Maintenance",
    icon: "🧰",
    education: {
      title: "Scheduled Maintenance",
      summary: "Regular maintenance keeps your car running smoothly and prevents bigger issues. We'll handle everything your car needs.",
      is_it_safe: "Safe to drive",
      what_we_check: "Based on your service needs",
      how_quotes_work: "Clear pricing for standard services",
    },
    questions: [
      {
        id: "q1",
        question: "What service do you need?",
        options: ["Oil change", "Tire rotation", "Brake inspection", "Full service", "Other"],
      },
    ],
  },
  not_sure: {
    key: "not_sure",
    label: "Not sure",
    icon: "❓",
    education: {
      title: "Need Diagnosis",
      summary: "No problem! Our mechanics will perform a thorough inspection to identify what's going on with your car.",
      is_it_safe: "We'll assess during diagnosis",
      what_we_check: "Complete vehicle inspection",
      how_quotes_work: "Diagnostic fee, then detailed findings and quote",
    },
    questions: [
      {
        id: "q1",
        question: "What made you concerned?",
        options: ["Something feels off", "Preventive check", "Recent issue", "Other"],
      },
    ],
  },
};
