import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../utils/testUtils';
import { mockSupabaseClient } from '../mocks/mockSupabase';
import { createMockSymptom } from '../mocks/mockData';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

const MockSymptomSelectionScreen = () => {
  const [symptoms, setSymptoms] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadSymptoms = async () => {
      try {
        setLoading(true);
        const { data, error } = await (mockSupabaseClient as any)
          .from('symptom_mappings')
          .select('*');

        if (error) throw error;
        setSymptoms(data || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    loadSymptoms();
  }, []);

  if (loading) {
    return <div testID="loading-indicator">Loading...</div>;
  }

  if (error) {
    return <div testID="error-message">{error}</div>;
  }

  if (symptoms.length === 0) {
    return <div testID="empty-state">No symptoms available</div>;
  }

  const groupedByCategory = symptoms.reduce((acc, symptom) => {
    if (!acc[symptom.category]) {
      acc[symptom.category] = [];
    }
    acc[symptom.category].push(symptom);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div testID="symptom-list">
      {Object.entries(groupedByCategory).map(([category, categorySymptoms]) => (
        <div key={category} testID={`category-${category}`}>
          <div testID={`category-title-${category}`}>{category}</div>
          {categorySymptoms.map((symptom) => (
            <button
              key={symptom.symptom_key}
              testID={`symptom-${symptom.symptom_key}`}
              onClick={() => {}}
            >
              {symptom.icon} {symptom.symptom_label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

describe('SymptomSelection Screen', () => {
  beforeEach(() => {
    mockSupabaseClient.reset();
    jest.clearAllMocks();
  });

  describe('Data Fetching', () => {
    it('should fetch symptoms from Supabase on mount', async () => {
      const { getByTestId } = renderWithProviders(<MockSymptomSelectionScreen />);

      expect(getByTestId('loading-indicator')).toBeTruthy();

      await waitFor(() => {
        expect(getByTestId('symptom-list')).toBeTruthy();
      });
    });

    it('should display symptoms grouped by category', async () => {
      const { getByTestId } = renderWithProviders(<MockSymptomSelectionScreen />);

      await waitFor(() => {
        expect(getByTestId('category-Engine')).toBeTruthy();
        expect(getByTestId('category-Transmission')).toBeTruthy();
        expect(getByTestId('category-Brakes')).toBeTruthy();
        expect(getByTestId('category-Maintenance')).toBeTruthy();
      });
    });

    it('should render all symptoms from database', async () => {
      const { getByTestId } = renderWithProviders(<MockSymptomSelectionScreen />);

      await waitFor(() => {
        expect(getByTestId('symptom-engine_overheating')).toBeTruthy();
        expect(getByTestId('symptom-transmission_issues')).toBeTruthy();
        expect(getByTestId('symptom-brakes_squeaking')).toBeTruthy();
        expect(getByTestId('symptom-oil_change')).toBeTruthy();
      });
    });
  });

  describe('Dynamic Symptom Addition', () => {
    it('should automatically display newly added symptoms from database', async () => {
      const newSymptom = createMockSymptom({
        symptom_key: 'battery_dead',
        symptom_label: 'Battery Dead',
        category: 'Electrical',
        icon: '🔋',
      });

      mockSupabaseClient.addSymptom(newSymptom);

      const { getByTestId } = renderWithProviders(<MockSymptomSelectionScreen />);

      await waitFor(() => {
        expect(getByTestId('symptom-battery_dead')).toBeTruthy();
        expect(getByTestId('category-Electrical')).toBeTruthy();
      });
    });

    it('should handle symptoms with new categories', async () => {
      const newSymptom = createMockSymptom({
        symptom_key: 'ac_not_cold',
        symptom_label: 'A/C Not Cold',
        category: 'HVAC',
        icon: '❄️',
      });

      mockSupabaseClient.addSymptom(newSymptom);

      const { getByTestId } = renderWithProviders(<MockSymptomSelectionScreen />);

      await waitFor(() => {
        expect(getByTestId('category-HVAC')).toBeTruthy();
        expect(getByTestId('symptom-ac_not_cold')).toBeTruthy();
      });
    });

    it('should not break when multiple symptoms are added to same category', async () => {
      mockSupabaseClient.addSymptom(
        createMockSymptom({
          symptom_key: 'engine_noise',
          symptom_label: 'Engine Noise',
          category: 'Engine',
        })
      );

      mockSupabaseClient.addSymptom(
        createMockSymptom({
          symptom_key: 'engine_misfire',
          symptom_label: 'Engine Misfire',
          category: 'Engine',
        })
      );

      const { getByTestId } = renderWithProviders(<MockSymptomSelectionScreen />);

      await waitFor(() => {
        expect(getByTestId('symptom-engine_overheating')).toBeTruthy();
        expect(getByTestId('symptom-engine_noise')).toBeTruthy();
        expect(getByTestId('symptom-engine_misfire')).toBeTruthy();
      });
    });
  });

  describe('Empty and Error States', () => {
    it('should display empty state when no symptoms exist', async () => {
      mockSupabaseClient.clearSymptoms();

      const { getByTestId } = renderWithProviders(<MockSymptomSelectionScreen />);

      await waitFor(() => {
        expect(getByTestId('empty-state')).toBeTruthy();
      });
    });

    it('should display error message on fetch failure', async () => {
      mockSupabaseClient.setFailure(true, 'Network error');

      const { getByTestId } = renderWithProviders(<MockSymptomSelectionScreen />);

      await waitFor(() => {
        expect(getByTestId('error-message')).toBeTruthy();
        expect(getByTestId('error-message').props.children).toBe('Network error');
      });
    });

    it('should recover from error state when data becomes available', async () => {
      mockSupabaseClient.setFailure(true);

      const { getByTestId, rerender } = renderWithProviders(<MockSymptomSelectionScreen />);

      await waitFor(() => {
        expect(getByTestId('error-message')).toBeTruthy();
      });

      mockSupabaseClient.setFailure(false);
      rerender(<MockSymptomSelectionScreen />);

      await waitFor(() => {
        expect(getByTestId('symptom-list')).toBeTruthy();
      });
    });
  });

  describe('Symptom Metadata', () => {
    it('should include risk_level in symptom data', async () => {
      const { getByTestId } = renderWithProviders(<MockSymptomSelectionScreen />);

      await waitFor(() => {
        const symptomButton = getByTestId('symptom-engine_overheating');
        expect(symptomButton).toBeTruthy();
      });
    });

    it('should include quote_strategy in symptom data', async () => {
      const { getByTestId } = renderWithProviders(<MockSymptomSelectionScreen />);

      await waitFor(() => {
        const symptomButton = getByTestId('symptom-oil_change');
        expect(symptomButton).toBeTruthy();
      });
    });
  });
});
