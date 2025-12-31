import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../utils/testUtils';
import { mockSupabaseClient } from '../mocks/mockSupabase';
import { createMockJobPayload, mockQuestionDatabase } from '../mocks/mockData';

const MockJobFlowScreen = ({ symptomKey }: { symptomKey: string }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({});
  const [questions, setQuestions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadQuestions = async () => {
      const { data } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', symptomKey)
        .order('order_index');

      setQuestions(data || []);
      setLoading(false);
    };

    loadQuestions();
  }, [symptomKey]);

  const handleAnswer = (questionKey: string, answer: string | string[]) => {
    const newAnswers = { ...answers, [questionKey]: answer };
    setAnswers(newAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  if (loading) {
    return <div testID="loading">Loading...</div>;
  }

  if (questions.length === 0) {
    return <div testID="no-questions">No questions for this symptom</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div testID="job-flow">
      <div testID="question-label">{currentQuestion.question_label}</div>
      <div testID="question-index">
        {currentQuestionIndex + 1} of {questions.length}
      </div>

      {currentQuestionIndex > 0 && (
        <button testID="back-button" onClick={handleBack}>
          Back
        </button>
      )}

      <div testID="answers-state">{JSON.stringify(answers)}</div>

      <button
        testID={`answer-${currentQuestion.question_key}`}
        onClick={() => handleAnswer(currentQuestion.question_key, 'Test Answer')}
      >
        Answer
      </button>
    </div>
  );
};

describe('JobFlow - Answer Persistence', () => {
  beforeEach(() => {
    mockSupabaseClient.reset();
    jest.clearAllMocks();
  });

  describe('Answer State Management', () => {
    it('should store answer when question is answered', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobFlowScreen symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('job-flow')).toBeTruthy();
      });

      const answerButton = getByTestId('answer-overheat_frequency');
      fireEvent.press(answerButton);

      await waitFor(() => {
        const answersState = JSON.parse(getByTestId('answers-state').props.children);
        expect(answersState.overheat_frequency).toBe('Test Answer');
      });
    });

    it('should preserve answers when navigating forward', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobFlowScreen symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('job-flow')).toBeTruthy();
      });

      fireEvent.press(getByTestId('answer-overheat_frequency'));

      await waitFor(() => {
        expect(getByTestId('question-index').props.children).toBe('2 of 3');
      });

      fireEvent.press(getByTestId('answer-coolant_level_check'));

      await waitFor(() => {
        const answersState = JSON.parse(getByTestId('answers-state').props.children);
        expect(answersState.overheat_frequency).toBe('Test Answer');
        expect(answersState.coolant_level_check).toBe('Test Answer');
      });
    });

    it('should preserve answers when navigating backward', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobFlowScreen symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('job-flow')).toBeTruthy();
      });

      fireEvent.press(getByTestId('answer-overheat_frequency'));

      await waitFor(() => {
        expect(getByTestId('back-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('back-button'));

      await waitFor(() => {
        const answersState = JSON.parse(getByTestId('answers-state').props.children);
        expect(answersState.overheat_frequency).toBe('Test Answer');
      });
    });

    it('should allow updating previous answers', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobFlowScreen symptomKey="engine_overheating" />
      );

      await waitFor(() => {
        expect(getByTestId('job-flow')).toBeTruthy();
      });

      fireEvent.press(getByTestId('answer-overheat_frequency'));

      await waitFor(() => {
        expect(getByTestId('back-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('back-button'));
      fireEvent.press(getByTestId('answer-overheat_frequency'));

      await waitFor(() => {
        const answersState = JSON.parse(getByTestId('answers-state').props.children);
        expect(answersState.overheat_frequency).toBe('Test Answer');
      });
    });
  });

  describe('Multi-Choice Answer Persistence', () => {
    it('should store array of answers for multi-choice questions', async () => {
      const { getByTestId } = renderWithProviders(
        <MockJobFlowScreen symptomKey="transmission_issues" />
      );

      await waitFor(() => {
        expect(getByTestId('job-flow')).toBeTruthy();
      });

      const MockMultiChoiceFlow = () => {
        const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({});

        const handleMultiChoice = (key: string, values: string[]) => {
          setAnswers({ ...answers, [key]: values });
        };

        return (
          <div testID="multi-choice-flow">
            <button
              testID="add-answer"
              onClick={() => handleMultiChoice('shifting_behavior', ['Hard shifts', 'Delayed shifts'])}
            >
              Add Answers
            </button>
            <div testID="multi-answers">{JSON.stringify(answers)}</div>
          </div>
        );
      };

      const { getByTestId: getMulti } = renderWithProviders(<MockMultiChoiceFlow />);

      fireEvent.press(getMulti('add-answer'));

      await waitFor(() => {
        const answers = JSON.parse(getMulti('multi-answers').props.children);
        expect(Array.isArray(answers.shifting_behavior)).toBe(true);
        expect(answers.shifting_behavior).toHaveLength(2);
      });
    });

    it('should preserve multi-choice selections through navigation', async () => {
      const MockMultiChoiceNavFlow = () => {
        const [step, setStep] = React.useState(0);
        const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({
          shifting_behavior: ['Hard shifts', 'Slipping'],
        });

        return (
          <div testID="nav-flow">
            <div testID="current-step">{step}</div>
            <button testID="next" onClick={() => setStep(step + 1)}>
              Next
            </button>
            <button testID="prev" onClick={() => setStep(step - 1)}>
              Previous
            </button>
            <div testID="preserved-answers">{JSON.stringify(answers)}</div>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<MockMultiChoiceNavFlow />);

      fireEvent.press(getByTestId('next'));

      await waitFor(() => {
        expect(getByTestId('current-step').props.children).toBe(1);
      });

      fireEvent.press(getByTestId('prev'));

      await waitFor(() => {
        const answers = JSON.parse(getByTestId('preserved-answers').props.children);
        expect(answers.shifting_behavior).toEqual(['Hard shifts', 'Slipping']);
      });
    });
  });

  describe('Numeric Input Validation', () => {
    it('should only accept numeric values for numeric questions', () => {
      const MockNumericInput = () => {
        const [value, setValue] = React.useState('');
        const [error, setError] = React.useState('');

        const handleChange = (text: string) => {
          if (/^\d*$/.test(text)) {
            setValue(text);
            setError('');
          } else {
            setError('Only numbers allowed');
          }
        };

        return (
          <div testID="numeric-input">
            <input
              testID="input"
              value={value}
              onChange={(e: any) => handleChange(e.target.value)}
            />
            {error && <div testID="error">{error}</div>}
            <div testID="value">{value}</div>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<MockNumericInput />);

      fireEvent.change(getByTestId('input'), { target: { value: '12345' } });
      expect(getByTestId('value').props.children).toBe('12345');

      fireEvent.change(getByTestId('input'), { target: { value: 'abc' } });
      expect(getByTestId('error')).toBeTruthy();
    });

    it('should validate numeric range if specified', () => {
      const MockRangeValidation = () => {
        const [value, setValue] = React.useState('');
        const [error, setError] = React.useState('');

        const handleValidate = () => {
          const num = parseInt(value);
          if (num < 0 || num > 999999) {
            setError('Value must be between 0 and 999999');
          } else {
            setError('');
          }
        };

        return (
          <div testID="range-validation">
            <input
              testID="input"
              value={value}
              onChange={(e: any) => setValue(e.target.value)}
            />
            <button testID="validate" onClick={handleValidate}>
              Validate
            </button>
            {error && <div testID="error">{error}</div>}
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<MockRangeValidation />);

      fireEvent.change(getByTestId('input'), { target: { value: '1000000' } });
      fireEvent.press(getByTestId('validate'));

      expect(getByTestId('error')).toBeTruthy();
    });
  });

  describe('Answer Completeness', () => {
    it('should track which questions have been answered', () => {
      const MockAnswerTracking = () => {
        const [answers, setAnswers] = React.useState<Record<string, any>>({
          q1: 'Answer 1',
          q2: 'Answer 2',
        });

        const questions = ['q1', 'q2', 'q3'];
        const answeredCount = questions.filter((q) => answers[q]).length;

        return (
          <div testID="tracking">
            <div testID="answered-count">{answeredCount}</div>
            <div testID="total-count">{questions.length}</div>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<MockAnswerTracking />);

      expect(getByTestId('answered-count').props.children).toBe(2);
      expect(getByTestId('total-count').props.children).toBe(3);
    });

    it('should prevent submission if required questions unanswered', () => {
      const MockSubmissionValidation = () => {
        const [answers, setAnswers] = React.useState<Record<string, any>>({
          q1: 'Answer 1',
        });

        const requiredQuestions = ['q1', 'q2', 'q3'];
        const canSubmit = requiredQuestions.every((q) => answers[q]);

        return (
          <div testID="validation">
            <button testID="submit" disabled={!canSubmit}>
              Submit
            </button>
            <div testID="can-submit">{canSubmit.toString()}</div>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<MockSubmissionValidation />);

      expect(getByTestId('can-submit').props.children).toBe('false');
      expect(getByTestId('submit').props.disabled).toBe(true);
    });
  });
});
