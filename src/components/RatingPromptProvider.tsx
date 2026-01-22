import React, { createContext, useContext, ReactNode } from 'react';
import { useRatingPrompt, RatingPromptHook } from '@/src/hooks/useRatingPrompt';
import { RatingModal } from './RatingModal';

const RatingPromptContext = createContext<RatingPromptHook | null>(null);

export function useRatingPromptContext(): RatingPromptHook {
  const context = useContext(RatingPromptContext);
  if (!context) {
    throw new Error('useRatingPromptContext must be used within RatingPromptProvider');
  }
  return context;
}

type RatingPromptProviderProps = {
  children: ReactNode;
};

export function RatingPromptProvider({ children }: RatingPromptProviderProps) {
  const ratingPrompt = useRatingPrompt();

  return (
    <RatingPromptContext.Provider value={ratingPrompt}>
      {children}
      <RatingModal
        visible={ratingPrompt.showPrompt}
        type="prompt"
        onRateApp={ratingPrompt.handleRateApp}
        onSnooze={ratingPrompt.handleSnooze}
        onDismiss={ratingPrompt.dismissPrompt}
      />
      <RatingModal
        visible={ratingPrompt.showConfirmation}
        type="confirmation"
        onConfirmRated={ratingPrompt.handleConfirmRated}
        onConfirmNotYet={ratingPrompt.handleConfirmNotYet}
        onDismiss={() => ratingPrompt.handleConfirmNotYet()}
      />
    </RatingPromptContext.Provider>
  );
}
