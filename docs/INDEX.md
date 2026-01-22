# WrenchGo Documentation Index

**Last Updated:** January 2026  
**Repository:** WrenchGo - Mechanic Marketplace Mobile App

---

## 📖 Quick Navigation

| Category | Description | Key Files |
|----------|-------------|-----------|
| [🚀 Getting Started](#-getting-started) | Setup and initial configuration | Quick Start, Setup Guides |
| [📦 Deployment](#-deployment) | Production deployment procedures | Deployment guides, checklists |
| [🎨 Features](#-features) | Feature documentation | Payments, Stripe, Reviews, etc. |
| [🔧 Troubleshooting](#-troubleshooting) | Debug guides and fixes | Error fixes, debug steps |
| [🏗️ Architecture](#%EF%B8%8F-architecture) | System design and structure | Database schema, architecture |
| [🗄️ Database](#%EF%B8%8F-database) | Migration and schema management | Migration guides, SQL scripts |
| [🧪 Testing](#-testing) | Testing procedures | Test guides, verification |
| [📚 Reference](#-reference) | Code examples and references | Examples, patch notes |

---

## 🚀 Getting Started

**New to WrenchGo? Start here:**

1. **[START_HERE.md](setup/START_HERE.md)** - Begin your journey
2. **[QUICK_START.md](setup/QUICK_START.md)** - Fast setup guide
3. **[QUICK_SETUP_GUIDE.md](setup/QUICK_SETUP_GUIDE.md)** - Detailed setup

### Setup Documentation

- **[GOOGLE_SIGNIN_QUICKSTART.md](setup/GOOGLE_SIGNIN_QUICKSTART.md)** - Google OAuth setup
- **[GOOGLE_SIGNIN_SETUP.md](setup/GOOGLE_SIGNIN_SETUP.md)** - Detailed Google signin
- **[SUPABASE_VERIFICATION_GUIDE.md](setup/SUPABASE_VERIFICATION_GUIDE.md)** - Verify Supabase setup
- **[SUPABASE_ACCOUNT_SWITCH_GUIDE.md](setup/SUPABASE_ACCOUNT_SWITCH_GUIDE.md)** - Switch Supabase accounts
- **[SETUP_TRIGGER_GUIDE.md](setup/SETUP_TRIGGER_GUIDE.md)** - Database trigger setup

---

## 📦 Deployment

### Production Deployment

- **[PRODUCTION_DEPLOYMENT_GUIDE.md](deployment/PRODUCTION_DEPLOYMENT_GUIDE.md)** - Complete production guide
- **[DEPLOYMENT_ORDER.md](deployment/DEPLOYMENT_ORDER.md)** - Deployment sequence
- **[DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md)** - General deployment
- **[QUICK_START_DEPLOY.md](deployment/QUICK_START_DEPLOY.md)** - Fast deployment

### Edge Functions

- **[EDGE_FUNCTIONS_CHECKLIST.md](deployment/EDGE_FUNCTIONS_CHECKLIST.md)** - Edge function checklist
- **[DEPLOY_EDGE_FUNCTION.md](deployment/DEPLOY_EDGE_FUNCTION.md)** - Deploy edge functions
- **[EDGE_FUNCTION_MANUAL_DEPLOY.md](deployment/EDGE_FUNCTION_MANUAL_DEPLOY.md)** - Manual deployment
- **[DEPLOY_ALL_FUNCTIONS.md](deployment/DEPLOY_ALL_FUNCTIONS.md)** - Deploy all functions

### Specialized Deployments

- **[MECHANIC_LEADS_DEPLOYMENT_GUIDE.md](deployment/MECHANIC_LEADS_DEPLOYMENT_GUIDE.md)** - Mechanic leads system
- **[ACCOUNT_DELETION_DEPLOYMENT.md](deployment/ACCOUNT_DELETION_DEPLOYMENT.md)** - Account deletion feature
- **[SCHEMA_FIX_DEPLOYMENT.md](deployment/SCHEMA_FIX_DEPLOYMENT.md)** - Schema fixes
- **[EMERGENCY_DEPLOY_INSTRUCTIONS.md](deployment/EMERGENCY_DEPLOY_INSTRUCTIONS.md)** - Emergency procedures

---

## 🎨 Features

### Payment System

- **[PAYMENT_SYSTEM_COMPLETE.md](features/PAYMENT_SYSTEM_COMPLETE.md)** - Complete payment system
- **[PAYMENT_IMPLEMENTATION.md](features/PAYMENT_IMPLEMENTATION.md)** - Implementation details
- **[PAYMENTS_QUICK_SETUP.md](features/PAYMENTS_QUICK_SETUP.md)** - Quick payment setup
- **[PAYMENTS_CHECKLIST.md](features/PAYMENTS_CHECKLIST.md)** - Payment checklist

### Stripe Connect

- **[STRIPE_CONNECT_README.md](features/STRIPE_CONNECT_README.md)** - Stripe Connect overview
- **[STRIPE_CONNECT_SETUP.md](features/STRIPE_CONNECT_SETUP.md)** - Setup guide
- **[STRIPE_CONNECT_TESTING.md](features/STRIPE_CONNECT_TESTING.md)** - Testing procedures
- **[STRIPE_CONNECT_DIAGRAMS.md](features/STRIPE_CONNECT_DIAGRAMS.md)** - Flow diagrams

### Mechanic Leads

- **[MECHANIC_LEADS_ARCHITECTURE.md](features/MECHANIC_LEADS_ARCHITECTURE.md)** - System architecture
- **[MECHANIC_LEADS_SUMMARY.md](features/MECHANIC_LEADS_SUMMARY.md)** - Feature summary
- **[MECHANIC_LEADS_FILTER_LOGIC.md](features/MECHANIC_LEADS_FILTER_LOGIC.md)** - Filter logic
- **[MECHANIC_FLOW_DOCUMENTATION.md](features/MECHANIC_FLOW_DOCUMENTATION.md)** - User flows

### Reviews & Ratings

- **[REVIEWS_RATINGS_SYSTEM_GUIDE.md](features/REVIEWS_RATINGS_SYSTEM_GUIDE.md)** - Complete guide

### User Interface

- **[DARK_MODE_QUICK_REF.md](features/DARK_MODE_QUICK_REF.md)** - Dark mode reference
- **[DARK_MODE_REFACTOR.md](features/DARK_MODE_REFACTOR.md)** - Dark mode implementation
- **[RESPONSIVE_GUIDE.md](features/RESPONSIVE_GUIDE.md)** - Responsive design
- **[VEHICLE_PICKER_DRAWER_IMPLEMENTATION.md](features/VEHICLE_PICKER_DRAWER_IMPLEMENTATION.md)** - Vehicle picker

### Verification & Security

- **[ID_VERIFICATION_COMPLETE.md](features/ID_VERIFICATION_COMPLETE.md)** - ID verification
- **[PHOTO_ID_VERIFICATION_GUIDE.md](features/PHOTO_ID_VERIFICATION_GUIDE.md)** - Photo ID guide
- **[AUTO_VERIFICATION_GUIDE.md](features/AUTO_VERIFICATION_GUIDE.md)** - Auto verification
- **[LOCATION_PRIVACY_IMPLEMENTATION.md](features/LOCATION_PRIVACY_IMPLEMENTATION.md)** - Location privacy

### Other Features

- **[CANCELLATION_IMPLEMENTATION.md](features/CANCELLATION_IMPLEMENTATION.md)** - Cancellation flow
- **[DYNAMIC_QUESTIONS_IMPLEMENTATION.md](features/DYNAMIC_QUESTIONS_IMPLEMENTATION.md)** - Dynamic questions
- **[LEGAL_INTEGRATION_STATUS.md](features/LEGAL_INTEGRATION_STATUS.md)** - Legal integration

---

## 🔧 Troubleshooting

### Quick Fixes

- **[QUICK_DEBUG_STEPS.md](troubleshooting/QUICK_DEBUG_STEPS.md)** - Fast debugging
- **[QUICK_FIX_REFERENCE.md](troubleshooting/QUICK_FIX_REFERENCE.md)** - Common fixes

### Authentication Issues

- **[FIX_401_ERROR_NOW.md](troubleshooting/FIX_401_ERROR_NOW.md)** - Fix 401 errors
- **[FIX_UNAUTHORIZED_ERROR.md](troubleshooting/FIX_UNAUTHORIZED_ERROR.md)** - Unauthorized errors
- **[FIX_LOGIN_NOW.md](troubleshooting/FIX_LOGIN_NOW.md)** - Login issues

### Platform-Specific

- **[COMPLETE_ANDROID_SOLUTION.md](troubleshooting/COMPLETE_ANDROID_SOLUTION.md)** - Android fixes
- **[ANDROID_NAV_BAR_FIX.md](troubleshooting/ANDROID_NAV_BAR_FIX.md)** - Navigation bar
- **[REACT_NATIVE_UPLOAD_FIX.md](troubleshooting/REACT_NATIVE_UPLOAD_FIX.md)** - Upload issues

### Database & Backend

- **[DATABASE_RECOVERY_PLAN.md](troubleshooting/DATABASE_RECOVERY_PLAN.md)** - Database recovery
- **[DEBUG_EDGE_FUNCTION.md](troubleshooting/DEBUG_EDGE_FUNCTION.md)** - Edge function debugging
- **[SQL_FIX_NOTES.md](troubleshooting/SQL_FIX_NOTES.md)** - SQL fixes

### Feature-Specific

- **[MECHANIC_LEADS_BUG_FIXES.md](troubleshooting/MECHANIC_LEADS_BUG_FIXES.md)** - Mechanic leads bugs
- **[UUID_BUG_FIX_SUMMARY.md](troubleshooting/UUID_BUG_FIX_SUMMARY.md)** - UUID issues
- **[INFINITE_LOOP_FIXED.md](troubleshooting/INFINITE_LOOP_FIXED.md)** - Infinite loop fixes

---

## 🏗️ Architecture

### System Overview

- **[COMPLETE_SUMMARY.md](architecture/COMPLETE_SUMMARY.md)** - Complete system summary
- **[IMPLEMENTATION_SUMMARY.md](architecture/IMPLEMENTATION_SUMMARY.md)** - Implementation overview

### Database

- **[PROFILES_TABLE_SPEC.md](architecture/PROFILES_TABLE_SPEC.md)** - Profiles table specification
- **[SEED_DATA_ARCHITECTURE_ANALYSIS.md](architecture/SEED_DATA_ARCHITECTURE_ANALYSIS.md)** - Seed data design

### Integration

- **[PROJECT_B_INTEGRATION_GUIDE.md](architecture/PROJECT_B_INTEGRATION_GUIDE.md)** - Project B integration
- **[EDGE_FUNCTION_NEEDED.md](architecture/EDGE_FUNCTION_NEEDED.md)** - Edge function requirements

---

## 🗄️ Database

### Migration Management

- **[MIGRATION_QUICK_REF.md](migration/MIGRATION_QUICK_REF.md)** - Quick reference
- **[MIGRATION_SUMMARY.md](migration/MIGRATION_SUMMARY.md)** - Migration overview
- **[MIGRATION_DEPLOYMENT_GUIDE.md](deployment/MIGRATION_DEPLOYMENT_GUIDE.md)** - Deploy migrations

### Schema Management

- **[NO_SCHEMA_DRIFT_WORKFLOW.md](migration/NO_SCHEMA_DRIFT_WORKFLOW.md)** - Prevent schema drift
- **[SCHEMA_CLEANUP_COMPLETE_PLAN.md](migration/SCHEMA_CLEANUP_COMPLETE_PLAN.md)** - Schema cleanup

### Cleanup & Maintenance

- **[MIGRATION_CLEANUP_GUIDE.md](migration/MIGRATION_CLEANUP_GUIDE.md)** - Cleanup procedures
- **[MIGRATION_ACTION_PLAN.md](migration/MIGRATION_ACTION_PLAN.md)** - Action plan

---

## 🧪 Testing

### Testing Guides

- **[TESTING_GUIDE.md](testing/TESTING_GUIDE.md)** - Complete testing guide
- **[STEP_BY_STEP_TESTING.md](testing/STEP_BY_STEP_TESTING.md)** - Step-by-step tests
- **[TEST_SUITE_SUMMARY.md](testing/TEST_SUITE_SUMMARY.md)** - Test suite overview

### Verification

- **[VERIFICATION_CHECKLIST.md](testing/VERIFICATION_CHECKLIST.md)** - Verification checklist
- **[RELEASE_VERIFICATION_SUMMARY.md](testing/RELEASE_VERIFICATION_SUMMARY.md)** - Release verification
- **[ROLE_SELECTION_VERIFICATION.md](testing/ROLE_SELECTION_VERIFICATION.md)** - Role selection tests

---

## 📚 Reference

### Code Examples

- **[EXAMPLES_SAFE_AREA.tsx](reference/EXAMPLES_SAFE_AREA.tsx)** - Safe area examples
- **[README_RESPONSIVE.md](reference/README_RESPONSIVE.md)** - Responsive patterns

### Documentation

- **[SUPABASE_DOCS_INDEX.md](reference/SUPABASE_DOCS_INDEX.md)** - Supabase docs index
- **[PATCH_CHANGES.md](reference/PATCH_CHANGES.md)** - Patch change log

---

## 📦 Archive

Historical documentation and completed phases:

- **[PHASE_1_COMPLETE.md](archive/PHASE_1_COMPLETE.md)** - Phase 1 completion
- **[PHASE_2_COMPLETE.md](archive/PHASE_2_COMPLETE.md)** - Phase 2 completion
- **[PHASE_3_COMPLETE.md](archive/PHASE_3_COMPLETE.md)** - Phase 3 completion
- **[PHASE_4_COMPLETE.md](archive/PHASE_4_COMPLETE.md)** - Phase 4 completion
- **[REMOVAL_SUMMARY.md](archive/REMOVAL_SUMMARY.md)** - Feature removal summary
- **[SEED_DATA_CLEANUP_SUMMARY.md](archive/SEED_DATA_CLEANUP_SUMMARY.md)** - Seed cleanup

---

## 🔍 Finding Documentation

### By Topic

- **Authentication**: See [Setup](#-getting-started) and [Troubleshooting](#-troubleshooting)
- **Payments**: See [Features > Payment System](#payment-system)
- **Database**: See [Database](#%EF%B8%8F-database) and [Architecture](#%EF%B8%8F-architecture)
- **Deployment**: See [Deployment](#-deployment)
- **Testing**: See [Testing](#-testing)

### By Task

- **Setting up locally**: [QUICK_START.md](setup/QUICK_START.md)
- **Deploying to production**: [PRODUCTION_DEPLOYMENT_GUIDE.md](deployment/PRODUCTION_DEPLOYMENT_GUIDE.md)
- **Fixing bugs**: [QUICK_FIX_REFERENCE.md](troubleshooting/QUICK_FIX_REFERENCE.md)
- **Running migrations**: [MIGRATION_QUICK_REF.md](migration/MIGRATION_QUICK_REF.md)
- **Testing features**: [TESTING_GUIDE.md](testing/TESTING_GUIDE.md)

---

## 📝 Contributing to Documentation

When adding new documentation:

1. Place files in the appropriate category folder
2. Update this INDEX.md with a link to your new doc
3. Use clear, descriptive filenames (UPPERCASE_WITH_UNDERSCORES.md)
4. Include a brief description in the index
5. Archive outdated docs to `archive/` folder

---

## 🆘 Need Help?

1. Check [QUICK_DEBUG_STEPS.md](troubleshooting/QUICK_DEBUG_STEPS.md)
2. Review [TROUBLESHOOTING](troubleshooting/) folder
3. Check [START_HERE.md](setup/START_HERE.md) for basics
4. Review relevant feature documentation

---

**Repository Structure:**
```
wrenchgo/
├── docs/               # All documentation (you are here)
│   ├── INDEX.md       # This file
│   ├── deployment/    # Deployment guides
│   ├── features/      # Feature documentation
│   ├── troubleshooting/ # Debug guides
│   ├── architecture/  # System design
│   ├── migration/     # Database migrations
│   ├── setup/         # Setup guides
│   ├── testing/       # Testing docs
│   ├── reference/     # Code examples
│   └── archive/       # Historical docs
├── scripts/           # Utility scripts
│   ├── manual/        # Manual SQL operations
│   └── tools/         # Helper scripts
├── supabase/          # Supabase configuration
│   ├── migrations/    # Database migrations
│   └── functions/     # Edge functions
└── src/               # Application code
```
