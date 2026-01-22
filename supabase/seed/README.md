# Seed Data

Seed data has been moved to the migrations folder for proper database management.

## Location
All seed data is now in: `supabase/migrations/20250127000005_seed_data.sql`

## What's Included
- **Skills**: Mechanic capabilities (brakes, oil change, diagnostics, etc.)
- **Tools**: Equipment needed for repairs
- **Safety Measures**: Safety requirements for mechanics
- **Symptoms**: Customer-friendly car problem categories
- **Symptom Mappings**: Detailed explanations of each symptom in plain English
- **Education Cards**: Educational guides for customers

## How to Apply
Run database reset to apply all migrations including seed data:
```bash
supabase db reset
```

Or apply just the seed data migration:
```bash
supabase migration up
```

## Plain English Content
All content has been simplified to be customer-friendly:
- No technical jargon
- Clear explanations
- Easy to understand safety information
- Practical advice

## Used By
- `app/(customer)/education.tsx` - Displays symptoms and guides to customers
- Job creation flow - Symptom selection
- Mechanic matching - Skills and tools
