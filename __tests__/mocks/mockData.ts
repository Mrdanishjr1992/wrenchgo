export interface MockSymptomMapping {
  symptom_key: string;
  symptom_label: string;
  category: string;
  icon?: string;
  required_skill_keys: string[];
  suggested_tool_keys: string[];
  required_safety_keys: string[];
  quote_strategy: 'flat_estimate_ok' | 'inspect_then_quote' | 'diagnosis_first';
  risk_level: 'low' | 'medium' | 'high';
  customer_explainer: string;
  mechanic_notes: string;
}

export interface MockSymptomQuestion {
  symptom_key: string;
  question_key: string;
  question_label: string;
  question_type: 'yes_no' | 'single_choice' | 'multi_choice' | 'numeric' | 'photo' | 'audio';
  options: string[];
  helps_mechanic_with: string;
  affects_quote: boolean;
  affects_safety: boolean;
  affects_tools: boolean;
  order_index: number;
}

export const createMockSymptom = (overrides?: Partial<MockSymptomMapping>): MockSymptomMapping => ({
  symptom_key: 'engine_overheating',
  symptom_label: 'Engine Overheating',
  category: 'Engine',
  icon: '🔥',
  required_skill_keys: ['cooling_system_diagnosis', 'radiator_inspection'],
  suggested_tool_keys: ['coolant_pressure_tester', 'infrared_thermometer'],
  required_safety_keys: ['hot_engine_safety'],
  quote_strategy: 'diagnosis_first',
  risk_level: 'high',
  customer_explainer: 'Your engine is running hotter than normal, indicated by the temperature gauge or warning light.',
  mechanic_notes: 'Check coolant levels, radiator, thermostat, water pump, and hoses.',
  ...overrides,
});

export const createMockQuestion = (overrides?: Partial<MockSymptomQuestion>): MockSymptomQuestion => ({
  symptom_key: 'engine_overheating',
  question_key: 'overheat_frequency',
  question_label: 'How often does the engine overheat?',
  question_type: 'single_choice',
  options: ['Constantly', 'Only in traffic', 'Only on highways', 'Rarely, but it happens'],
  helps_mechanic_with: 'Severity and potential cause (e.g., airflow vs. pump)',
  affects_quote: true,
  affects_safety: true,
  affects_tools: false,
  order_index: 10,
  ...overrides,
});

export const mockSymptomDatabase: MockSymptomMapping[] = [
  createMockSymptom({
    symptom_key: 'engine_overheating',
    symptom_label: 'Engine Overheating',
    category: 'Engine',
    icon: '🔥',
  }),
  createMockSymptom({
    symptom_key: 'transmission_issues',
    symptom_label: 'Transmission Issues',
    category: 'Transmission',
    icon: '⚙️',
    quote_strategy: 'diagnosis_first',
    risk_level: 'high',
  }),
  createMockSymptom({
    symptom_key: 'brakes_squeaking',
    symptom_label: 'Brakes Squeaking',
    category: 'Brakes',
    icon: '🛑',
    quote_strategy: 'inspect_then_quote',
    risk_level: 'medium',
  }),
  createMockSymptom({
    symptom_key: 'oil_change',
    symptom_label: 'Oil Change',
    category: 'Maintenance',
    icon: '🛢️',
    quote_strategy: 'flat_estimate_ok',
    risk_level: 'low',
  }),
];

export const mockQuestionDatabase: Record<string, MockSymptomQuestion[]> = {
  engine_overheating: [
    createMockQuestion({
      symptom_key: 'engine_overheating',
      question_key: 'overheat_frequency',
      question_label: 'How often does the engine overheat?',
      question_type: 'single_choice',
      options: ['Constantly', 'Only in traffic', 'Only on highways', 'Rarely, but it happens'],
      order_index: 10,
    }),
    createMockQuestion({
      symptom_key: 'engine_overheating',
      question_key: 'coolant_level_check',
      question_label: 'Have you checked the coolant level?',
      question_type: 'yes_no',
      options: [],
      order_index: 20,
    }),
    createMockQuestion({
      symptom_key: 'engine_overheating',
      question_key: 'coolant_leak_signs',
      question_label: 'Do you see any visible coolant leaks or puddles?',
      question_type: 'yes_no',
      options: [],
      order_index: 30,
    }),
  ],
  transmission_issues: [
    createMockQuestion({
      symptom_key: 'transmission_issues',
      question_key: 'shifting_behavior',
      question_label: 'Describe the shifting problem:',
      question_type: 'multi_choice',
      options: ['Hard shifts', 'Delayed shifts', 'Slipping out of gear', 'No engagement'],
      order_index: 10,
    }),
    createMockQuestion({
      symptom_key: 'transmission_issues',
      question_key: 'fluid_color',
      question_label: 'What color is the transmission fluid?',
      question_type: 'single_choice',
      options: ['Red/Pink', 'Brown', 'Black', 'Not sure'],
      order_index: 20,
    }),
  ],
  brakes_squeaking: [
    createMockQuestion({
      symptom_key: 'brakes_squeaking',
      question_key: 'noise_frequency',
      question_label: 'When do you hear the squeaking?',
      question_type: 'single_choice',
      options: ['Every time I brake', 'Only when cold', 'Only when hot', 'Intermittent'],
      order_index: 10,
    }),
  ],
  oil_change: [],
};

export const createMockJobPayload = (symptomKey: string, answers: Record<string, string | string[]>) => ({
  symptom_key: symptomKey,
  answers,
  safety_flags: Object.entries(answers)
    .filter(([key]) => {
      const questions = mockQuestionDatabase[symptomKey] || [];
      const question = questions.find((q) => q.question_key === key);
      return question?.affects_safety;
    })
    .map(([key]) => key),
  quote_strategy: mockSymptomDatabase.find((s) => s.symptom_key === symptomKey)?.quote_strategy || 'diagnosis_first',
  created_at: new Date().toISOString(),
});
