#!/bin/bash

# Apply Seed Data to Supabase
# This script resets the database and applies all migrations including seed data

echo "🔄 Resetting Supabase database..."
echo "This will:"
echo "  - Drop all tables"
echo "  - Recreate schema"
echo "  - Apply all migrations"
echo "  - Load seed data"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "🚀 Running database reset..."
    supabase db reset
    
    if [ $? -eq 0 ]; then
        echo "✅ Database reset complete!"
        echo "📊 Seed data has been loaded:"
        echo "   - Skills"
        echo "   - Tools"
        echo "   - Safety Measures"
        echo "   - Symptoms"
        echo "   - Symptom Mappings (10 items)"
        echo "   - Education Cards (6 guides)"
        echo ""
        echo "🎉 Your education page should now work!"
    else
        echo "❌ Database reset failed. Check the error above."
        exit 1
    fi
else
    echo "❌ Cancelled"
    exit 0
fi
