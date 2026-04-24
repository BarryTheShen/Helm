# Phase 5B Implementation Summary

## Overview
Implemented Dynamic Bottom Bar + Launchpad functionality for the mobile app, enabling app-based configuration of tab visibility and module organization.

## Files Created

### 1. `/mobile/src/constants/moduleRoutes.ts`
- **Purpose:** Explicit mapping from module_type slugs to Expo Router routes
- **Key Features:**
  - `MODULE_TYPE_TO_ROUTE` constant mapping all 7 built-in module types
  - `getRouteForModuleInstance()` helper function for routing logic
  - Handles both built-in modules (static routes) and custom modules (dynamic routes)

### 2. `/mobile/src/stores/appConfigStore.ts`
- **Purpose:** Zustand store for app configuration state
- **Key Features:**
  - Stores bottom_bar_config and launchpad_config
  - `loadAppConfig()` fetches config from `/api/devices/{deviceId}/config`
  - `updateFromWebSocket()` for live updates via WebSocket
  - Error handling and loading states
- **Note:** Modified by linter to use correct API signature with deviceId parameter

### 3. `/mobile/app/launchpad.tsx`
- **Purpose:** Full-screen module launcher for non-bottom-bar modules
- **Key Features:**
  - 3-column grid layout with module cards
  - Icon + name display for each module
  - Navigation using `getRouteForModuleInstance()` helper
  - Empty state when all modules are in bottom bar
  - Accessible with proper ARIA labels

## Files Modified

### 1. `/mobile/app/(tabs)/_layout.tsx`
- **Changes:**
  - Added import for `useAppConfigStore` and `MODULE_TYPE_TO_ROUTE`
  - Updated `TabsConfigSync` to load app config on mount
  - Added WebSocket handler for `app_config_update` events
  - Modified `tabHref()` to support both new (app config) and legacy (hiddenTabs) systems
  - Updated `tabLabel()` and `tabIcon()` to prioritize app config over legacy configs
  - Built `bottomBarMap` to track which modules are in bottom bar
- **Backward Compatibility:** Falls back to legacy system when appConfig is null

## Key Implementation Details

### Dynamic Tab Visibility
- All 7 tabs remain defined in `_layout.tsx`
- Visibility controlled via `href: null` (Expo Router pattern)
- New system: tab visible only if in `bottom_bar_config`
- Legacy system: tab visible if in `enabledTabIds` AND not in `hiddenTabs`

### Route Mapping
- Built-in modules use `MODULE_TYPE_TO_ROUTE` constant
- Custom modules (template_id != null) use `/template/[id]` route
- Helper function encapsulates routing logic for consistency

### WebSocket Integration
- `app_config_update` event triggers `updateFromWebSocket()`
- Config updates are applied immediately without full refetch
- Maintains backward compatibility with `tabs_updated` event

### State Management
- `appConfigStore` holds current app configuration
- Separate from `tabsStore` (legacy system)
- Both systems coexist for smooth migration

## Dependencies on Other Phases

### Phase 4 (Device Registration) - BLOCKING
- **Issue:** `loadAppConfig()` requires `device_id` parameter
- **Current State:** Commented out in `TabsConfigSync` until device_id is available
- **TODO:** Uncomment app config loading once `authStore.device_id` is implemented

### Phase 1 (Backend Foundation) - REQUIRED
- Expects `/api/devices/{deviceId}/config` endpoint
- Expects enriched config with `module_type`, `name`, `icon` fields
- Expects WebSocket `app_config_update` event with full config payload

## Testing Checklist

- [ ] Verify MODULE_TYPE_TO_ROUTE maps all 7 module types correctly
- [ ] Test launchpad screen renders module grid
- [ ] Test launchpad navigation to built-in modules
- [ ] Test launchpad navigation to custom modules (when implemented)
- [ ] Test bottom bar visibility updates when app config changes
- [ ] Test WebSocket `app_config_update` event triggers UI refresh
- [ ] Test backward compatibility with legacy hiddenTabs system
- [ ] Test empty launchpad state displays correctly
- [ ] Verify all 7 routes remain accessible even when hidden from tab bar

## Known Limitations

1. **Device ID Missing:** App config loading is disabled until Phase 4 completes
2. **Template ID:** Launchpad currently assumes `template_id: null` for all modules
3. **Backend Dependency:** Requires Phase 1 backend endpoints to be functional
4. **No 5th-slot toggle:** "More" button logic not yet implemented (deferred)

## Next Steps

1. Complete Phase 4 (Device Registration) to enable app config loading
2. Implement backend endpoints from Phase 1
3. Test end-to-end flow with real backend data
4. Add 5th-slot toggle logic if needed (optional feature)
5. Implement custom module support with template_id handling
