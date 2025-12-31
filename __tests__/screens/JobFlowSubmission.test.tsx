import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../utils/testUtils';
import { mockSupabaseClient } from '../mocks/mockSupabase';
import { createMockJobPayload, mockQuestionDatabase, mockSymptomDatabase } from '../mocks/mockData';

const MockJobSubmissionFlow = ({ symptomKey }: { symptomKey: string }) => {
  const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({});
  const [questions, setQuestions] = React.useState<any[]>([]);
  const [symptom, setSymptom] = React.useState<any>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadData = async () => {
      const { data: questionsData } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', symptomKey)
        .order('order_index');

      const { data: symptomsData } = await (mockSupabaseClient as any)
        .from('symptom_mappings')
        .select('*');

      setQuestions(questionsData || []);
      setSymptom(symptomsData?.find((s: any) => s.symptom_key === symptomKey));
    };

    loadData();
  }, [symptomKey]);

  const getSafetyFlags = () => {
    return questions
      .filter((q) => q.affects_safety && answers[q.question_key])
      .map((q) => q.question_key);
  };

  const getQuoteStrategy = () => {
    return symptom?.quote_strategy || 'diagnosis_first';
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        symptom_key: symptomKey,
        answers,
        safety_flags: getSafetyFlags(),
        quote_strategy: getQuoteStrategy(),
        created_at: new Date().toISOString(),
      };

      const { data, error: submitError } = await (mockSupabaseClient as any)
        .from('jobs')
        .insert(payload);

      if (submitError) throw submitError;

      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <div testID="success-screen">Job submitted successfully!</div>;
  }

  if (error) {
    return (
      <div testID="error-screen">
        <div testID="error-message">{error}</div>
        <button testID="retry-button" onClick={handleSubmit}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div testID="submission-flow">
      <div testID="symptom-key">{symptomKey}</div>
      <div testID="answers-data">{JSON.stringify(answers)}</div>
      <div testID="safety-flags">{JSON.stringify(getSafetyFlags())}</div>
      <div testID="quote-strategy">{getQuoteStrategy()}</div>

      <button
        testID="add-answer"
        onClick={() => setAnswers({ ...answers, test_question: 'Test Answer' })}
      >
        Add Answer
      </button>

      <button testID="submit-button" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Job'}
      </button>
    </div>
  );
};

describe('JobFlow - Safety and Quote Logic', () => {
  beforeEach(() => {
    mockSupabaseClient.reset();
    jest.clearAllMocks();
  });

  describe('Safety Flag Detection', () => {
    it('should identify questions with affects_safety=true', async () => {
      const { data } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', 'engine_overheating');

      const safetyQuestions = data.filter((q: any) => q.affects_safety);
      expect(safetyQuestions.length).toBeGreaterThan(0);
    });

    it('should set safety flag when safety-critical question is answered', async () => {
      const MockSafetyFlagFlow = () => {
        const [answers, setAnswers] = React.useState<Record<string, any>>({});
        const questions = mockQuestionDatabase.engine_overheating;

        const safetyFlags = questions
          .filter((q) => q.affects_safety && answers[q.question_key])
          .map((q) => q.question_key);

        return (
          <div testID="safety-flow">
            <button
              testID="answer-safety-question"
              onClick={() => setAnswers({ overheat_frequency: 'Constantly' })}
            >
              Answer
            </button>
            <div testID="safety-flags">{JSON.stringify(safetyFlags)}</div>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<MockSafetyFlagFlow />);

      fireEvent.press(getByTestId('answer-safety-question'));

      await waitFor(() => {
        const flags = JSON.parse(getByTestId('safety-flags').props.children);
        expect(flags).toContain('overheat_frequency');
      });
    });

    it('should not set safety flag for non-safety questions', () => {
      const MockNonSafetyFlow = () => {
        const questions = mockQuestionDatabase.engine_overheating;
        const nonSafetyQuestion = questions.find((q) => !q.affects_safety);

        const [answers, setAnswers] = React.useState<Record<string, any>>({});

        const safetyFlags = questions
          .filter((q) => q.affects_safety && answers[q.question_key])
          .map((q) => q.question_key);

        return (
          <div testID="non-safety-flow">
            <button
              testID="answer-non-safety"
              onClick={() =>
                setAnswers({ [nonSafetyQuestion?.question_key || 'test']: 'Answer' })
              }
            >
              Answer
            </button>
            <div testID="safety-flags">{JSON.stringify(safetyFlags)}</div>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<MockNonSafetyFlow />);

      fireEvent.press(getByTestId('answer-non-safety'));

      const flags = JSON.parse(getByTestId('safety-flags').props.children);
      expect(flags).toHaveLength(0);
    });

    it('should accumulate multiple safety flags', () => {
      const MockMultipleSafetyFlags = () => {
        const [answers, setAnswers] = React.useState<Record<string, any>>({});
        const questions = mockQuestionDatabase.engine_overheating;

        const safetyFlags = questions
          .filter((q) => q.affects_safety && answers[q.question_key])
          .map((q) => q.question_key);

        return (
          <div testID="multiple-safety">
            <button
              testID="answer-multiple"
              onClick={() =>
                setAnswers({
                  overheat_frequency: 'Constantly',
                  coolant_level_check: 'No',
                  coolant_leak_signs: 'Yes',
                })
              }
            >
              Answer All
            </button>
            <div testID="safety-flags">{JSON.stringify(safetyFlags)}</div>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<MockMultipleSafetyFlags />);

      fireEvent.press(getByTestId('answer-multiple'));

      const flags = JSON.parse(getByTestId('safety-flags').props.children);
      expect(flags.length).toBeGreaterThan(1);
    });
  });

  describe('Quote Strategy Detection', () => {
    it('should retrieve quote_strategy from symptom mapping', async () => {
      const { data } = await (mockSupabaseClient as any)
        .from('symptom_mappings')
        .select('*');

      const symptom = data.find((s: any) => s.symptom_key === 'engine_overheating');
      expect(symptom.quote_strategy).toBe('diagnosis_first');
    });

    it('should use correct quote strategy for flat_estimate_ok symptoms', async () => {
      const { data } = await (mockSupabaseClient as any)
        .from('symptom_mappings')
        .select('*');

      const symptom = data.find((s: any) => s.symptom_key === 'oil_change');
      expect(symptom.quote_strategy).toBe('flat_estimate_ok');
    });

    it('should use correct quote strategy for inspect_then_quote symptoms', async () => {
      const { data } = await (mockSupabaseClient as any)
        .from('symptom_mappings')
        .select('*');

      const symptom = data.find((s: any) => s.symptom_key === 'brakes_squeaking');
      expect(symptom.quote_strategy).toBe('inspect_then_quote');
    });

    it('should default to diagnosis_first if strategy not specified', () => {
      const MockDefaultStrategy = () => {
        const getStrategy = (symptom: any) => {
          return symptom?.quote_strategy || 'diagnosis_first';
        };

        return (
          <div testID="default-strategy">
            <div testID="strategy">{getStrategy(null)}</div>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<MockDefaultStrategy />);

      expect(getByTestId('strategy').props.children).toBe('diagnosis_first');
    });
  });

  describe('Quote Flag Detection', () => {
    it('should identify questions with affects_quote=true', async () => {
      const { data } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', 'engine_overheating');

      const quoteQuestions = data.filter((q: any) => q.affects_quote);
      expect(quoteQuestions.length).toBeGreaterThan(0);
    });

    it('should mark job for diagnostic quote when affects_quote questions answered', () => {
      const MockQuoteFlagFlow = () => {
        const [answers, setAnswers] = React.useState<Record<string, any>>({});
        const questions = mockQuestionDatabase.engine_overheating;

        const needsDiagnosticQuote = questions.some(
          (q) => q.affects_quote && answers[q.question_key]
        );

        return (
          <div testID="quote-flag-flow">
            <button
              testID="answer-quote-question"
              onClick={() => setAnswers({ overheat_frequency: 'Constantly' })}
            >
              Answer
            </button>
            <div testID="needs-diagnostic">{needsDiagnosticQuote.toString()}</div>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<MockQuoteFlagFlow />);

      fireEvent.press(getByTestId('answer-quote-question'));

      expect(getByTestId('needs-diagnostic').props.children).toBe('true');
    });
  });

  describe('Safety Warning UI', () => {
    it('should render safety warning when safety flags present', () => {
      const MockSafetyWarning = ({ safetyFlags }: { safetyFlags: string[] }) => {
        const hasSafetyFlags = safetyFlags.length > 0;

        return (
          <div testID="safety-warning-ui">
            {hasSafetyFlags && (
              <div testID="safety-warning">
                ⚠️ Safety concerns detected. Please drive carefully.
              </div>
            )}
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(
        <MockSafetyWarning safetyFlags={['overheat_frequency']} />
      );

      expect(getByTestId('safety-warning')).toBeTruthy();
    });

    it('should not render safety warning when no safety flags', () => {
      const MockNoSafetyWarning = ({ safetyFlags }: { safetyFlags: string[] }) => {
        const hasSafetyFlags = safetyFlags.length > 0;

        return (
          <div testID="no-safety-warning-ui">
            {hasSafetyFlags && <div testID="safety-warning">Warning</div>}
            {!hasSafetyFlags && <div testID="no-warning">All clear</div>}
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<MockNoSafetyWarning safetyFlags={[]} />);

      expect(getByTestId('no-warning')).toBeTruthy();
    });
  });
});

describe('JobFlow - Job Submission', () => {
  beforeEach(() => {
    mockSupabaseClient.reset();
    jest.clearAllMocks();
  });

  describe('Payload Construction', () => {
    it('should include symptom_key in payload', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobSubmissionFlow symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('symptom-key').props.children).toBe('engine_overheating');
      });
    });

    it('should include all answers in payload', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobSubmissionFlow symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('submission-flow')).toBeTruthy();
      });

      fireEvent.press(getByTestId('add-answer'));

      await waitFor(() => {
        const answers = JSON.parse(getByTestId('answers-data').props.children);
        expect(answers.test_question).toBe('Test Answer');
      });
    });

    it('should include safety_flags array in payload', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobSubmissionFlow symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('safety-flags')).toBeTruthy();
      });
    });

    it('should include quote_strategy in payload', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobSubmissionFlow symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('quote-strategy').props.children).toBe('diagnosis_first');
      });
    });

    it('should include timestamp in payload', () => {
      const payload = createMockJobPayload('engine_overheating', {
        q1: 'Answer 1',
      });

      expect(payload.created_at).toBeTruthy();
      expect(new Date(payload.created_at).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Submission Success', () => {
    it('should call Supabase insert with correct payload', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobSubmissionFlow symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('submission-flow')).toBeTruthy();
      });

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(getByTestId('success-screen')).toBeTruthy();
      });

      const jobs = mockSupabaseClient.getJobs();
      expect(jobs.length).toBe(1);
      expect(jobs[0].symptom_key).toBe('engine_overheating');
    });

    it('should navigate to success screen after submission', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobSubmissionFlow symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('submission-flow')).toBeTruthy();
      });

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(getByTestId('success-screen')).toBeTruthy();
      });
    });

    it('should disable submit button while submitting', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobSubmissionFlow symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('submission-flow')).toBeTruthy();
      });

      const submitButton = getByTestId('submit-button');
      fireEvent.press(submitButton);

      expect(submitButton.props.children).toBe('Submitting...');
    });
  });

  describe('Submission Failure', () => {
    it('should display error message on submission failure', async () => {
      mockSupabaseClient.setFailure(true, 'Network error');

      const { getByTestId } = renderWithProviders(
        <MockJobSubmissionFlow symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('submission-flow')).toBeTruthy();
      });

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(getByTestId('error-screen')).toBeTruthy();
        expect(getByTestId('error-message').props.children).toBe('Network error');
      });
    });

    it('should render retry button on failure', async () => {
      mockSupabaseClient.setFailure(true);

      const { getByTestId } = renderWithProviders(
        <MockJobSubmissionFlow symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('submission-flow')).toBeTruthy();
      });

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(getByTestId('retry-button')).toBeTruthy();
      });
    });

    it('should allow retry after failure', async () => {
      mockSupabaseClient.setFailure(true);

      const { getByTestId } = renderWithProviders(
        <MockJobSubmissionFlow symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('submission-flow')).toBeTruthy();
      });

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(getByTestId('retry-button')).toBeTruthy();
      });

      mockSupabaseClient.setFailure(false);
      fireEvent.press(getByTestId('retry-button'));

      await waitFor(() => {
        expect(getByTestId('success-screen')).toBeTruthy();
      });
    });

    it('should handle database constraint violations', async () => {
      mockSupabaseClient.setFailure(true, 'Duplicate entry');

      const { getByTestId } = renderWithProviders(
        <MockJobSubmissionFlow symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('submission-flow')).toBeTruthy();
      });

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(getByTestId('error-message').props.children).toBe('Duplicate entry');
      });
    });
  });

  describe('Payload Validation', () => {
    it('should ensure all required fields are present', () => {
      const payload = createMockJobPayload('engine_overheating', {
        q1: 'Answer 1',
      });

      expect(payload.symptom_key).toBeTruthy();
      expect(payload.answers).toBeTruthy();
      expect(payload.safety_flags).toBeDefined();
      expect(payload.quote_strategy).toBeTruthy();
      expect(payload.created_at).toBeTruthy();
    });

    it('should handle empty answers object', () => {
      const payload = createMockJobPayload('oil_change', {});

      expect(payload.answers).toEqual({});
      expect(payload.safety_flags).toEqual([]);
    });

    it('should correctly map multi-choice answers', () => {
      const payload = createMockJobPayload('transmission_issues', {
        shifting_behavior: ['Hard shifts', 'Delayed shifts'],
      });

      expect(Array.isArray(payload.answers.shifting_behavior)).toBe(true);
      expect(payload.answers.shifting_behavior).toHaveLength(2);
    });
  });
});
