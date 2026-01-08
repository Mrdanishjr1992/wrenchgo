export type SupportCategory = 
  | 'payments_refunds'
  | 'job_issue'
  | 'account_login'
  | 'bug_app_problem'
  | 'other';

export type SupportStatus = 'open' | 'resolved';

export interface SupportRequestMetadata {
  platform: string;
  app_version: string;
  device_model: string;
  role: string;
}

export interface SupportRequest {
  id: string;
  user_id: string;
  category: SupportCategory;
  message: string;
  job_id?: string;
  screenshot_url?: string;
  metadata: SupportRequestMetadata;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateSupportRequestPayload {
  category: SupportCategory;
  message: string;
  job_id?: string;
  screenshot_url?: string;
  metadata?: Partial<SupportRequestMetadata>;
}

export interface SupportRequestResponse {
  success: boolean;
  request_id?: string;
  message?: string;
  error?: string;
}

export interface SupportCategoryOption {
  value: SupportCategory;
  label: string;
  icon: string;
  sla: string;
}

export const SUPPORT_CATEGORIES: SupportCategoryOption[] = [
  {
    value: 'payments_refunds',
    label: 'Payments & Refunds',
    icon: 'card',
    sla: '12-24 hours',
  },
  {
    value: 'job_issue',
    label: 'Job Issue',
    icon: 'construct',
    sla: '24 hours',
  },
  {
    value: 'account_login',
    label: 'Account / Login',
    icon: 'person',
    sla: '48 hours',
  },
  {
    value: 'bug_app_problem',
    label: 'Bug / App Problem',
    icon: 'bug',
    sla: '48 hours',
  },
  {
    value: 'other',
    label: 'Other',
    icon: 'help-circle',
    sla: '48 hours',
  },
];

export interface FAQItem {
  question: string;
  answer: string;
}

export const SUPPORT_FAQ: FAQItem[] = [
  {
    question: 'How do I get paid for completed jobs?',
    answer: 'Payments are automatically processed within 2-3 business days after job completion. Funds are transferred directly to your connected bank account.',
  },
  {
    question: 'What if a customer cancels a job?',
    answer: 'If a customer cancels before you accept, there\'s no penalty. If they cancel after acceptance, you may be eligible for a cancellation fee depending on timing.',
  },
  {
    question: 'How do I update my availability?',
    answer: 'Go to Profile > Settings > Availability to set your working hours and days off.',
  },
  {
    question: 'What happens if there\'s a dispute?',
    answer: 'Contact support immediately. We\'ll review the job details, messages, and photos to mediate fairly. Keep all communication on the platform.',
  },
  {
    question: 'How do reviews work?',
    answer: 'After job completion, both parties can leave reviews. Reviews are visible after both submit or after 7 days. Maintain professionalism to build your reputation.',
  },
  {
    question: 'Can I work outside the platform?',
    answer: 'All job-related work must stay on WrenchGo for payment protection and support access. Off-platform work violates our terms and removes protections.',
  },
];
