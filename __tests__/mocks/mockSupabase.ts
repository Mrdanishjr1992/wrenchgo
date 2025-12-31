import { SupabaseClient } from '@supabase/supabase-js';
import { mockSymptomDatabase, mockQuestionDatabase, MockSymptomMapping, MockSymptomQuestion } from './mockData';

type SupabaseQuery = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
};

export class MockSupabaseClient {
  private symptoms: MockSymptomMapping[] = [...mockSymptomDatabase];
  private questions: Record<string, MockSymptomQuestion[]> = { ...mockQuestionDatabase };
  private jobs: any[] = [];
  private shouldFail = false;
  private failureMessage = 'Mock error';

  auth = {
    getUser: jest.fn(() =>
      Promise.resolve({
        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
        error: null,
      })
    ),
    signInWithPassword: jest.fn(() =>
      Promise.resolve({
        data: { user: { id: 'mock-user-id' }, session: { access_token: 'mock-token' } },
        error: null,
      })
    ),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  };

  from(table: string): any {
    const query: Partial<SupabaseQuery> = {
      select: jest.fn((columns?: string) => {
        if (this.shouldFail) {
          return {
            ...query,
            data: null,
            error: { message: this.failureMessage },
          };
        }

        if (table === 'symptom_mappings') {
          return {
            ...query,
            data: this.symptoms,
            error: null,
          };
        }

        if (table === 'symptom_questions') {
          return {
            ...query,
            eq: jest.fn((column: string, value: string) => {
              const questions = this.questions[value] || [];
              return {
                ...query,
                order: jest.fn(() => ({
                  data: questions.sort((a, b) => a.order_index - b.order_index),
                  error: null,
                })),
                data: questions,
                error: null,
              };
            }),
            order: jest.fn(() => ({
              data: Object.values(this.questions).flat(),
              error: null,
            })),
            data: Object.values(this.questions).flat(),
            error: null,
          };
        }

        if (table === 'jobs') {
          return {
            ...query,
            data: this.jobs,
            error: null,
          };
        }

        return {
          ...query,
          data: [],
          error: null,
        };
      }),

      insert: jest.fn((data: any) => {
        if (this.shouldFail) {
          return Promise.resolve({
            data: null,
            error: { message: this.failureMessage },
          });
        }

        if (table === 'jobs') {
          const newJob = { id: `job-${Date.now()}`, ...data };
          this.jobs.push(newJob);
          return Promise.resolve({
            data: newJob,
            error: null,
          });
        }

        return Promise.resolve({
          data: data,
          error: null,
        });
      }),

      update: jest.fn((data: any) => ({
        ...query,
        eq: jest.fn(() =>
          Promise.resolve({
            data: data,
            error: this.shouldFail ? { message: this.failureMessage } : null,
          })
        ),
      })),

      delete: jest.fn(() => ({
        ...query,
        eq: jest.fn(() =>
          Promise.resolve({
            data: null,
            error: this.shouldFail ? { message: this.failureMessage } : null,
          })
        ),
      })),

      eq: jest.fn((column: string, value: any) => query),
      order: jest.fn((column: string, options?: any) => query),
      single: jest.fn(() => query),
      maybeSingle: jest.fn(() => query),
    };

    return query;
  }

  setFailure(shouldFail: boolean, message = 'Mock error') {
    this.shouldFail = shouldFail;
    this.failureMessage = message;
  }

  addSymptom(symptom: MockSymptomMapping) {
    this.symptoms.push(symptom);
  }

  addQuestion(symptomKey: string, question: MockSymptomQuestion) {
    if (!this.questions[symptomKey]) {
      this.questions[symptomKey] = [];
    }
    this.questions[symptomKey].push(question);
  }

  clearSymptoms() {
    this.symptoms = [];
  }

  clearQuestions(symptomKey?: string) {
    if (symptomKey) {
      this.questions[symptomKey] = [];
    } else {
      this.questions = {};
    }
  }

  getJobs() {
    return this.jobs;
  }

  clearJobs() {
    this.jobs = [];
  }

  reset() {
    this.symptoms = [...mockSymptomDatabase];
    this.questions = { ...mockQuestionDatabase };
    this.jobs = [];
    this.shouldFail = false;
    this.failureMessage = 'Mock error';
  }
}

export const createMockSupabaseClient = (): MockSupabaseClient => {
  return new MockSupabaseClient();
};

export const mockSupabaseClient = createMockSupabaseClient();
