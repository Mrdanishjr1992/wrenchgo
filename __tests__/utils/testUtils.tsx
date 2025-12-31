import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/ui/theme-context';
import { mockSupabaseClient } from '../mocks/mockSupabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children }) => {
  return <ThemeProvider>{children}</ThemeProvider>;
};

export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: AllTheProviders, ...options });
};

export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

export const waitForLoadingToFinish = async (getByTestId: any, testId = 'loading-indicator') => {
  await waitForAsync();
  try {
    const loadingElement = getByTestId(testId);
    if (loadingElement) {
      await waitForAsync();
    }
  } catch {
  }
};

export * from '@testing-library/react-native';
