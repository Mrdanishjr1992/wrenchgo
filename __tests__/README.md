# WrenchGo Automated Test Suite

## Overview
Comprehensive automated test suite for WrenchGo's data-driven symptom selection and job flow system. These tests ensure the app remains functional as database content changes and new symptoms/questions are added.

---

## Test File Structure

```
__tests__/
├── setup.ts                              # Jest configuration and global mocks
├── mocks/
│   ├── mockData.ts                       # Mock data factories for symptoms/questions
│   └── mockSupabase.ts                   # Supabase client mock implementation
├── utils/
│   └── testUtils.tsx                     # Test utilities and provider wrappers
├── screens/
│   ├── SymptomSelection.test.tsx         # Symptom selection screen tests
│   ├── JobFlowQuestions.test.tsx         # Dynamic question rendering tests
│   ├── JobFlowAnswerPersistence.test.tsx # Answer state management tests
│   └── JobFlowSubmission.test.tsx        # Job submission and safety/quote tests
└── components/
    └── QuestionRenderer.test.tsx         # Question component unit tests
```

---

## Testing Stack

- **Jest**: Test runner and assertion library
- **@testing-library/react-native**: Component testing utilities
- **TypeScript**: Type-safe test code
- **Mock Supabase Client**: Database interaction mocking

---

## Installation

Add required dependencies to `package.json`:

```json
{
  "devDependencies": {
    "@testing-library/react-native": "^12.4.0",
    "@testing-library/jest-native": "^5.4.3",
    "jest": "^29.7.0",
    "jest-expo": "^50.0.0",
    "react-test-renderer": "^18.2.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

Install dependencies:
```bash
npm install --save-dev @testing-library/react-native @testing-library/jest-native jest jest-expo react-test-renderer
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test SymptomSelection.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="should fetch symptoms"
```

---

## Test Coverage

### 1. Symptom Selection Screen (`SymptomSelection.test.tsx`)

**Purpose**: Validates that symptoms are fetched from database and rendered correctly.

**Test Cases**:
- ✅ Fetches symptoms from Supabase on mount
- ✅ Displays symptoms grouped by category
- ✅ Renders all symptoms from database
- ✅ Automatically displays newly added symptoms
- ✅ Handles symptoms with new categories
- ✅ Displays empty state when no symptoms exist
- ✅ Displays error message on fetch failure
- ✅ Recovers from error state
- ✅ Includes risk_level metadata
- ✅ Includes quote_strategy metadata

**Key Protection**:
- No hardcoded symptom assumptions
- Tests pass when new symptoms added to database
- Validates dynamic category grouping

---

### 2. Dynamic Question Rendering (`JobFlowQuestions.test.tsx`)

**Purpose**: Ensures questions load dynamically and render correctly by type.

**Test Cases**:

**Question Fetching**:
- ✅ Fetches questions for selected symptom
- ✅ Returns empty array for symptom with no questions
- ✅ Fetches questions in correct order_index sequence

**Question Type: Yes/No**:
- ✅ Renders yes/no question with two buttons
- ✅ Calls onAnswer with "Yes" when yes button pressed
- ✅ Calls onAnswer with "No" when no button pressed

**Question Type: Single Choice**:
- ✅ Renders all options for single choice question
- ✅ Calls onAnswer immediately when option selected
- ✅ Highlights selected option

**Question Type: Multi Choice**:
- ✅ Renders all options with checkboxes
- ✅ Allows multiple selections
- ✅ Deselects option when pressed again
- ✅ Shows Continue button for multi-choice

**Question Type: Numeric**:
- ✅ Renders numeric input field
- ✅ Only accepts numeric input
- ✅ Shows Continue button for numeric input

**Question Type: Photo**:
- ✅ Renders photo upload button
- ✅ Shows preview after photo selected

**Question Type: Audio**:
- ✅ Renders audio recording button

**Dynamic Addition**:
- ✅ Renders newly added questions without code changes
- ✅ Handles questions with new question_types gracefully

**Metadata Validation**:
- ✅ Includes helps_mechanic_with in question data
- ✅ Includes affects_quote flag
- ✅ Includes affects_safety flag
- ✅ Includes affects_tools flag

**Key Protection**:
- No hardcoded question assumptions
- Tests pass when new questions added
- Validates all question types render correctly

---

### 3. Answer Persistence (`JobFlowAnswerPersistence.test.tsx`)

**Purpose**: Validates answer state management through navigation.

**Test Cases**:

**Answer State Management**:
- ✅ Stores answer when question is answered
- ✅ Preserves answers when navigating forward
- ✅ Preserves answers when navigating backward
- ✅ Allows updating previous answers

**Multi-Choice Persistence**:
- ✅ Stores array of answers for multi-choice questions
- ✅ Preserves multi-choice selections through navigation

**Numeric Validation**:
- ✅ Only accepts numeric values for numeric questions
- ✅ Validates numeric range if specified

**Answer Completeness**:
- ✅ Tracks which questions have been answered
- ✅ Prevents submission if required questions unanswered

**Key Protection**:
- Ensures no data loss during navigation
- Validates multi-choice array handling
- Prevents incomplete submissions

---

### 4. Job Submission & Safety/Quote Logic (`JobFlowSubmission.test.tsx`)

**Purpose**: Validates safety flag detection, quote strategy, and job submission.

**Test Cases**:

**Safety Flag Detection**:
- ✅ Identifies questions with affects_safety=true
- ✅ Sets safety flag when safety-critical question answered
- ✅ Does not set safety flag for non-safety questions
- ✅ Accumulates multiple safety flags

**Quote Strategy Detection**:
- ✅ Retrieves quote_strategy from symptom mapping
- ✅ Uses correct strategy for flat_estimate_ok symptoms
- ✅ Uses correct strategy for inspect_then_quote symptoms
- ✅ Defaults to diagnosis_first if strategy not specified

**Quote Flag Detection**:
- ✅ Identifies questions with affects_quote=true
- ✅ Marks job for diagnostic quote when affects_quote questions answered

**Safety Warning UI**:
- ✅ Renders safety warning when safety flags present
- ✅ Does not render safety warning when no safety flags

**Payload Construction**:
- ✅ Includes symptom_key in payload
- ✅ Includes all answers in payload
- ✅ Includes safety_flags array in payload
- ✅ Includes quote_strategy in payload
- ✅ Includes timestamp in payload

**Submission Success**:
- ✅ Calls Supabase insert with correct payload
- ✅ Navigates to success screen after submission
- ✅ Disables submit button while submitting

**Submission Failure**:
- ✅ Displays error message on submission failure
- ✅ Renders retry button on failure
- ✅ Allows retry after failure
- ✅ Handles database constraint violations

**Payload Validation**:
- ✅ Ensures all required fields are present
- ✅ Handles empty answers object
- ✅ Correctly maps multi-choice answers

**Key Protection**:
- Validates safety flag propagation
- Ensures quote strategy is correctly applied
- Prevents malformed payloads
- Handles submission errors gracefully

---

## Mock Data Factories

### `createMockSymptom(overrides?)`
Creates a mock symptom mapping with sensible defaults.

```typescript
const symptom = createMockSymptom({
  symptom_key: 'battery_dead',
  symptom_label: 'Battery Dead',
  category: 'Electrical',
  quote_strategy: 'diagnosis_first',
  risk_level: 'medium',
});
```

### `createMockQuestion(overrides?)`
Creates a mock symptom question with sensible defaults.

```typescript
const question = createMockQuestion({
  symptom_key: 'battery_dead',
  question_key: 'battery_age',
  question_label: 'How old is your battery?',
  question_type: 'single_choice',
  options: ['< 2 years', '2-4 years', '4+ years'],
  affects_safety: false,
  affects_quote: true,
});
```

### `createMockJobPayload(symptomKey, answers)`
Creates a complete job submission payload.

```typescript
const payload = createMockJobPayload('engine_overheating', {
  overheat_frequency: 'Constantly',
  coolant_level_check: 'No',
});
```

---

## Supabase Mocking Strategy

### MockSupabaseClient

The `MockSupabaseClient` class provides a complete mock of Supabase operations:

**Features**:
- In-memory data storage
- Chainable query methods (`.select()`, `.eq()`, `.order()`)
- Insert/update/delete operations
- Configurable failure modes
- Data manipulation methods

**Usage**:

```typescript
import { mockSupabaseClient } from '../mocks/mockSupabase';

// Reset to default state
mockSupabaseClient.reset();

// Add new symptom
mockSupabaseClient.addSymptom(createMockSymptom({
  symptom_key: 'new_symptom',
}));

// Add new question
mockSupabaseClient.addQuestion('engine_overheating', createMockQuestion({
  question_key: 'new_question',
}));

// Simulate failure
mockSupabaseClient.setFailure(true, 'Network error');

// Clear data
mockSupabaseClient.clearSymptoms();
mockSupabaseClient.clearQuestions('engine_overheating');
mockSupabaseClient.clearJobs();

// Inspect submitted jobs
const jobs = mockSupabaseClient.getJobs();
```

---

## Test Utilities

### `renderWithProviders(component, options?)`
Renders component with all necessary providers (Theme, Navigation, etc.).

```typescript
import { renderWithProviders } from '../utils/testUtils';

const { getByTestId } = renderWithProviders(<MyComponent />);
```

### `waitForAsync()`
Waits for async operations to complete.

```typescript
await waitForAsync();
```

### `waitForLoadingToFinish(getByTestId, testId?)`
Waits for loading indicator to disappear.

```typescript
await waitForLoadingToFinish(getByTestId, 'loading-indicator');
```

---

## Regression Protection

### How These Tests Protect Against Future Regressions

1. **Database Schema Changes**:
   - Tests use mock data that mirrors real schema
   - If schema changes, tests will fail until mocks are updated
   - Ensures code is updated to handle new fields

2. **New Symptoms Added**:
   - Tests verify symptoms are fetched dynamically
   - No hardcoded symptom lists in tests
   - New symptoms automatically appear in UI without code changes

3. **New Questions Added**:
   - Tests verify questions are fetched by symptom_key
   - Tests validate all question_types render correctly
   - New questions work without code changes

4. **Question Type Changes**:
   - Tests cover all question types (yes_no, single_choice, multi_choice, numeric, photo, audio)
   - If new question type added, tests will fail until renderer is updated
   - Ensures UI handles all question types

5. **Safety Flag Logic**:
   - Tests verify affects_safety flag is respected
   - Tests ensure safety flags propagate to submission
   - Prevents safety-critical questions from being ignored

6. **Quote Strategy Logic**:
   - Tests verify quote_strategy is retrieved from symptom mapping
   - Tests ensure correct strategy is applied per symptom
   - Prevents incorrect pricing logic

7. **Answer Persistence**:
   - Tests verify answers survive navigation
   - Tests ensure multi-choice arrays are handled correctly
   - Prevents data loss bugs

8. **Submission Payload**:
   - Tests verify payload structure matches expected format
   - Tests ensure all required fields are present
   - Prevents malformed submissions

---

## Best Practices

### Writing New Tests

1. **Use Mock Data Factories**:
   ```typescript
   const symptom = createMockSymptom({ symptom_key: 'test_symptom' });
   ```

2. **Reset State Before Each Test**:
   ```typescript
   beforeEach(() => {
     mockSupabaseClient.reset();
     jest.clearAllMocks();
   });
   ```

3. **Use Descriptive Test Names**:
   ```typescript
   it('should display error message when Supabase fetch fails', async () => {
     // ...
   });
   ```

4. **Test Behavior, Not Implementation**:
   ```typescript
   // ✅ Good: Test what user sees
   expect(getByText('Engine Overheating')).toBeTruthy();
   
   // ❌ Bad: Test internal state
   expect(component.state.symptoms).toHaveLength(4);
   ```

5. **Use waitFor for Async Operations**:
   ```typescript
   await waitFor(() => {
     expect(getByTestId('symptom-list')).toBeTruthy();
   });
   ```

6. **Test Error States**:
   ```typescript
   mockSupabaseClient.setFailure(true, 'Network error');
   // ... test error handling
   ```

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Cannot find module"
**Solution**: Check `moduleNameMapper` in `jest.config.js`

**Issue**: Tests timeout
**Solution**: Increase timeout in test:
```typescript
it('should load data', async () => {
  // ...
}, 10000); // 10 second timeout
```

**Issue**: Mock Supabase not working
**Solution**: Ensure mock is imported before component:
```typescript
import { mockSupabaseClient } from '../mocks/mockSupabase';
jest.mock('../../src/lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));
```

**Issue**: Tests pass locally but fail in CI
**Solution**: Check for environment-specific dependencies (e.g., Expo modules)

---

## Maintenance

### When to Update Tests

1. **Database Schema Changes**: Update mock data factories
2. **New Question Types**: Add test cases for new type
3. **New Symptom Fields**: Update mock symptom factory
4. **UI Changes**: Update test selectors (testID)
5. **Business Logic Changes**: Update assertion expectations

### Test Maintenance Checklist

- [ ] All tests pass locally
- [ ] All tests pass in CI
- [ ] Coverage remains above 80%
- [ ] No skipped tests (`.skip`)
- [ ] No focused tests (`.only`)
- [ ] Mock data matches production schema
- [ ] Test names are descriptive
- [ ] Error cases are tested

---

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

Run coverage report:
```bash
npm run test:coverage
```

View HTML coverage report:
```bash
open coverage/lcov-report/index.html
```

---

## Future Enhancements

1. **Integration Tests**: Test full user flows end-to-end
2. **Visual Regression Tests**: Detect UI changes with screenshot comparison
3. **Performance Tests**: Measure render times and memory usage
4. **Accessibility Tests**: Validate screen reader compatibility
5. **E2E Tests**: Use Detox for full app testing on real devices

---

## Support

For questions or issues with the test suite:
1. Check this documentation
2. Review existing test files for examples
3. Check Jest and React Native Testing Library docs
4. Ask the team in #engineering-help

---

## Summary

This test suite provides comprehensive coverage of WrenchGo's data-driven symptom and question flow. The tests are designed to:

- ✅ Validate database-driven content rendering
- ✅ Ensure new symptoms/questions work without code changes
- ✅ Protect against regressions in safety and quote logic
- ✅ Verify answer persistence through navigation
- ✅ Validate job submission payload structure
- ✅ Handle error states gracefully

**Key Principle**: Tests should pass even when database content changes, as long as the schema remains consistent.
