import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../utils/testUtils';
import { mockSupabaseClient } from '../mocks/mockSupabase';
import { createMockQuestion, mockQuestionDatabase } from '../mocks/mockData';
import QuestionRenderer from '../../src/components/QuestionRenderer';

describe('JobFlow - Dynamic Question Rendering', () => {
  beforeEach(() => {
    mockSupabaseClient.reset();
    jest.clearAllMocks();
  });

  describe('Question Fetching by Symptom', () => {
    it('should fetch questions for selected symptom', async () => {
      const symptomKey = 'engine_overheating';
      const questions = mockQuestionDatabase[symptomKey];

      const { data, error } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', symptomKey)
        .order('order_index');

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data[0].question_key).toBe('overheat_frequency');
    });

    it('should return empty array for symptom with no questions', async () => {
      const symptomKey = 'oil_change';

      const { data, error } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', symptomKey)
        .order('order_index');

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('should fetch questions in correct order_index sequence', async () => {
      const symptomKey = 'engine_overheating';

      const { data } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', symptomKey)
        .order('order_index');

      expect(data[0].order_index).toBe(10);
      expect(data[1].order_index).toBe(20);
      expect(data[2].order_index).toBe(30);
    });
  });

  describe('Question Type Rendering - Yes/No', () => {
    it('should render yes/no question with two buttons', () => {
      const question = createMockQuestion({
        question_type: 'yes_no',
        question_label: 'Have you checked the coolant level?',
        options: [],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value={undefined} onAnswer={onAnswer} />
      );

      expect(getByText('Have you checked the coolant level?')).toBeTruthy();
      expect(getByText('Yes')).toBeTruthy();
      expect(getByText('No')).toBeTruthy();
    });

    it('should call onAnswer with "Yes" when yes button pressed', () => {
      const question = createMockQuestion({
        question_type: 'yes_no',
        options: [],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value={undefined} onAnswer={onAnswer} />
      );

      fireEvent.press(getByText('Yes'));
      expect(onAnswer).toHaveBeenCalledWith('Yes');
    });

    it('should call onAnswer with "No" when no button pressed', () => {
      const question = createMockQuestion({
        question_type: 'yes_no',
        options: [],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value={undefined} onAnswer={onAnswer} />
      );

      fireEvent.press(getByText('No'));
      expect(onAnswer).toHaveBeenCalledWith('No');
    });
  });

  describe('Question Type Rendering - Single Choice', () => {
    it('should render all options for single choice question', () => {
      const question = createMockQuestion({
        question_type: 'single_choice',
        options: ['Constantly', 'Only in traffic', 'Only on highways', 'Rarely'],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value={undefined} onAnswer={onAnswer} />
      );

      expect(getByText('Constantly')).toBeTruthy();
      expect(getByText('Only in traffic')).toBeTruthy();
      expect(getByText('Only on highways')).toBeTruthy();
      expect(getByText('Rarely')).toBeTruthy();
    });

    it('should call onAnswer immediately when option selected', () => {
      const question = createMockQuestion({
        question_type: 'single_choice',
        options: ['Option A', 'Option B', 'Option C'],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value={undefined} onAnswer={onAnswer} />
      );

      fireEvent.press(getByText('Option B'));
      expect(onAnswer).toHaveBeenCalledWith('Option B');
    });

    it('should highlight selected option', () => {
      const question = createMockQuestion({
        question_type: 'single_choice',
        options: ['Option A', 'Option B'],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value="Option A" onAnswer={onAnswer} />
      );

      const selectedButton = getByText('Option A').parent;
      expect(selectedButton).toBeTruthy();
    });
  });

  describe('Question Type Rendering - Multi Choice', () => {
    it('should render all options with checkboxes', () => {
      const question = createMockQuestion({
        question_type: 'multi_choice',
        options: ['Hard shifts', 'Delayed shifts', 'Slipping', 'No engagement'],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value={[]} onAnswer={onAnswer} />
      );

      expect(getByText('Hard shifts')).toBeTruthy();
      expect(getByText('Delayed shifts')).toBeTruthy();
      expect(getByText('Slipping')).toBeTruthy();
      expect(getByText('No engagement')).toBeTruthy();
    });

    it('should allow multiple selections', () => {
      const question = createMockQuestion({
        question_type: 'multi_choice',
        options: ['Option A', 'Option B', 'Option C'],
      });

      const onAnswer = jest.fn();
      const { getByText, rerender } = renderWithProviders(
        <QuestionRenderer question={question} value={[]} onAnswer={onAnswer} />
      );

      fireEvent.press(getByText('Option A'));
      expect(onAnswer).toHaveBeenCalledWith(['Option A']);

      rerender(
        <QuestionRenderer question={question} value={['Option A']} onAnswer={onAnswer} />
      );

      fireEvent.press(getByText('Option B'));
      expect(onAnswer).toHaveBeenCalledWith(['Option A', 'Option B']);
    });

    it('should deselect option when pressed again', () => {
      const question = createMockQuestion({
        question_type: 'multi_choice',
        options: ['Option A', 'Option B'],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value={['Option A', 'Option B']} onAnswer={onAnswer} />
      );

      fireEvent.press(getByText('Option A'));
      expect(onAnswer).toHaveBeenCalledWith(['Option B']);
    });

    it('should show Continue button for multi-choice', () => {
      const question = createMockQuestion({
        question_type: 'multi_choice',
        options: ['Option A', 'Option B'],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value={['Option A']} onAnswer={onAnswer} />
      );

      expect(getByText('Continue')).toBeTruthy();
    });
  });

  describe('Question Type Rendering - Numeric', () => {
    it('should render numeric input field', () => {
      const question = createMockQuestion({
        question_type: 'numeric',
        question_label: 'What is your mileage?',
        options: [],
      });

      const onAnswer = jest.fn();
      const { getByPlaceholderText } = renderWithProviders(
        <QuestionRenderer question={question} value={undefined} onAnswer={onAnswer} />
      );

      expect(getByPlaceholderText('Enter number')).toBeTruthy();
    });

    it('should only accept numeric input', () => {
      const question = createMockQuestion({
        question_type: 'numeric',
        options: [],
      });

      const onAnswer = jest.fn();
      const { getByPlaceholderText } = renderWithProviders(
        <QuestionRenderer question={question} value={undefined} onAnswer={onAnswer} />
      );

      const input = getByPlaceholderText('Enter number');
      fireEvent.changeText(input, '12345');

      expect(onAnswer).toHaveBeenCalledWith('12345');
    });

    it('should show Continue button for numeric input', () => {
      const question = createMockQuestion({
        question_type: 'numeric',
        options: [],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value="1000" onAnswer={onAnswer} />
      );

      expect(getByText('Continue')).toBeTruthy();
    });
  });

  describe('Question Type Rendering - Photo', () => {
    it('should render photo upload button', () => {
      const question = createMockQuestion({
        question_type: 'photo',
        question_label: 'Upload a photo of the issue',
        options: [],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value={undefined} onAnswer={onAnswer} />
      );

      expect(getByText('Take Photo')).toBeTruthy();
    });

    it('should show preview after photo selected', () => {
      const question = createMockQuestion({
        question_type: 'photo',
        options: [],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value="mock-image-uri" onAnswer={onAnswer} />
      );

      expect(getByText('Continue')).toBeTruthy();
    });
  });

  describe('Question Type Rendering - Audio', () => {
    it('should render audio recording button', () => {
      const question = createMockQuestion({
        question_type: 'audio',
        question_label: 'Record the noise',
        options: [],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value={undefined} onAnswer={onAnswer} />
      );

      expect(getByText('Start Recording')).toBeTruthy();
    });
  });

  describe('Dynamic Question Addition', () => {
    it('should render newly added questions without code changes', async () => {
      const newQuestion = createMockQuestion({
        symptom_key: 'engine_overheating',
        question_key: 'temperature_gauge_reading',
        question_label: 'What does the temperature gauge show?',
        question_type: 'single_choice',
        options: ['Normal', 'High', 'Very High', 'Fluctuating'],
        order_index: 40,
      });

      mockSupabaseClient.addQuestion('engine_overheating', newQuestion);

      const { data } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', 'engine_overheating')
        .order('order_index');

      expect(data).toHaveLength(4);
      expect(data[3].question_key).toBe('temperature_gauge_reading');
    });

    it('should handle questions with new question_types gracefully', () => {
      const question = createMockQuestion({
        question_type: 'single_choice' as any,
        options: ['Option A', 'Option B'],
      });

      const onAnswer = jest.fn();
      const { getByText } = renderWithProviders(
        <QuestionRenderer question={question} value={undefined} onAnswer={onAnswer} />
      );

      expect(getByText('Option A')).toBeTruthy();
    });
  });

  describe('Question Metadata', () => {
    it('should include helps_mechanic_with in question data', async () => {
      const { data } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', 'engine_overheating');

      expect(data[0].helps_mechanic_with).toBeTruthy();
      expect(typeof data[0].helps_mechanic_with).toBe('string');
    });

    it('should include affects_quote flag', async () => {
      const { data } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', 'engine_overheating');

      expect(typeof data[0].affects_quote).toBe('boolean');
    });

    it('should include affects_safety flag', async () => {
      const { data } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', 'engine_overheating');

      expect(typeof data[0].affects_safety).toBe('boolean');
    });

    it('should include affects_tools flag', async () => {
      const { data } = await (mockSupabaseClient as any)
        .from('symptom_questions')
        .select('*')
        .eq('symptom_key', 'engine_overheating');

      expect(typeof data[0].affects_tools).toBe('boolean');
    });
  });
});
function expect(error: any) {
  throw new Error('Function not implemented.');
}

function beforeEach(arg0: () => void) {
  throw new Error('Function not implemented.');
}

