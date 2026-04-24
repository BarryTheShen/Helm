# Session 10 Data Migration

## Overview

This migration script (`migrate_session10_data.py`) implements Step 1.11 of the Session 10 plan. It creates the default app architecture for all existing users.

## What It Does

1. **Creates 7 default ModuleInstances per user:**
   - home, chat, modules, calendar, forms, alerts, settings
   - All marked as `status='active'`, `template_id=null` (built-in)
   - Skips creation if ModuleInstance already exists for that module_type

2. **Creates one default App per user:**
   - Name: "My App"
   - Icon: "smartphone"
   - Default theme and design tokens
   - Skips creation if user already has an app

3. **Links ModuleInstances to App via AppModuleRef:**
   - Bottom bar (slots 0-4): home, chat, modules, calendar, forms
   - Launchpad (slot_position=null): alerts, settings

4. **Assigns default app to all existing devices:**
   - Updates `Device.assigned_app_id` for all devices with `assigned_app_id=null`

5. **Backfills module_instance_id in module_states:**
   - Links existing SDUI canvas data to new ModuleInstances
   - Handles legacy naming conventions (`sdui__` prefix, `__draft` suffix)
   - Skips invalid/draft modules

## Prerequisites

**CRITICAL:** Run AFTER the Alembic migration that adds the `assigned_app_id` column to the `devices` table.

```bash
cd backend
alembic upgrade head
```

The script will check for this column and refuse to run if it's missing.

## Usage

### Dry Run (Preview Changes)

```bash
cd backend
.venv/bin/python scripts/migrate_session10_data.py --dry-run
```

This shows what would be changed without committing to the database.

### Apply Migration

```bash
cd backend
.venv/bin/python scripts/migrate_session10_data.py
```

This applies the changes and commits them to the database.

## Expected Output

```
================================================================================
Session 10 Data Migration
================================================================================

Checking prerequisites...
✅ Prerequisites passed

Gathering migration statistics...
  Total users: 1
  Existing module instances: 1
  Existing apps: 0
  Unassigned devices: 24
  Module states to backfill: 3

Migrating 1 users...

✅ barry (user_id: 56f4a2df-6619-44e1-990f-4de9e120fa3e)
   Created 7 module instances
   Created default app
   Created 7 app-module links
   Assigned app to 24 devices
   Backfilled 2 module states

================================================================================
Migration Summary
================================================================================
  Module instances created: 7
  Apps created: 1
  App-module links created: 7
  Devices assigned: 24
  Module states backfilled: 2
  Errors: 0

💾 Committing changes...
✅ Migration complete!
```

## Idempotency

The script is idempotent and safe to run multiple times:
- Skips ModuleInstance creation if already exists
- Skips App creation if user already has an app
- Only assigns devices that have `assigned_app_id=null`
- Only backfills module_states that have `module_instance_id=null`

## Error Handling

- Transaction-based: All changes for a user are committed together
- Errors are logged but don't stop migration of other users
- Returns exit code 1 if any errors occurred

## Rollback

If you need to rollback:

```sql
-- Delete all apps (cascades to AppModuleRef)
DELETE FROM apps WHERE name = 'My App';

-- Delete built-in module instances (cascades to module_states FK)
DELETE FROM module_instances WHERE template_id IS NULL AND module_type IN ('home', 'chat', 'modules', 'calendar', 'forms', 'alerts', 'settings');

-- Clear device assignments
UPDATE devices SET assigned_app_id = NULL;
```

Note: This will break the app if users are actively using it. Only rollback in development.
