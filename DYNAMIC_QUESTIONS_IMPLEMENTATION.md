# Dynamic Question System Implementation

## Overview
Implemented a dynamic question system for the WrenchGo mechanic app that allows for flexible question types and better data organization.

## Files Created

### 1. `src/components/QuestionRenderer.tsx`
A reusable component that renders different question types:
- **Single Choice**: Radio button style selection
- **Multi Choice**: Checkbox style multiple selections with "Continue" button
- **Yes/No**: Simple binary choice
- **Text Input**: Free-form text entry

Features:
- Consistent styling with theme
- Visual feedback for selected options
- Support for multi-select with visual indicators
- Responsive layout

### 2. `src/data/symptomQuestions.ts`
Centralized question data for all symptoms:
- Engine Overheating (5 questions)
- Transmission Issues (4 questions)
- Steering Problems (4 questions)
- Suspension Issues (4 questions)
- Exhaust Issues (4 questions)
- A/C & Heating Issues (3 questions)
- Electrical Issues (3 questions)
- Tire Issues (3 questions)

Each question includes:
- `symptom_key`: Links to symptom
- `question_key`: Unique identifier
- `question_label`: Display text
- `question_type`: Type of input
- `options`: Available choices
- `helps_mechanic_with`: Context for mechanics
- `affects_quote`: Whether it impacts pricing
- `affects_safety`: Whether it's safety-critical
- `affects_tools`: Whether it affects tool requirements
- `order_index`: Display order

### 3. `src/data/symptomDatabase.ts`
Extracted existing symptom data into a separate file for better organization.

## Changes to Existing Files

### `app/(customer)/request-service.tsx`
- Updated imports to use new data files
- Modified `answers` state to support both single and multi-choice (`string | string[]`)
- Updated `handleAnswerQuestion` to work with dynamic questions
- Replaced inline question rendering with `QuestionRenderer` component
- Updated question progress calculation to use dynamic question count
- Added fallback behavior when no questions exist for a symptom

## Benefits

1. **Maintainability**: Questions are now in a centralized data file, easy to update
2. **Scalability**: Adding new symptoms or questions is straightforward
3. **Flexibility**: Supports multiple question types without code changes
4. **Type Safety**: Full TypeScript support with proper interfaces
5. **Reusability**: QuestionRenderer can be used in other parts of the app
6. **Better UX**: Consistent question rendering with proper visual feedback

## Next Steps

To add new symptoms or questions:
1. Add symptom data to `src/data/symptomDatabase.ts`
2. Add questions to `src/data/symptomQuestions.ts`
3. No code changes needed in the UI components

## Testing

The implementation maintains backward compatibility with existing symptoms while supporting the new dynamic question system.
