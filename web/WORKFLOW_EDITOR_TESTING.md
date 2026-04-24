# Workflow Visual Editor - Testing Guide

## What Was Implemented

### 1. Custom Node Types
Created 5 custom React Flow node components:

- **TriggerNode** (`/web/src/components/workflow/TriggerNode.tsx`)
  - Supports: manual, onSchedule, onDataChange, onServerEvent
  - Visual: Indigo color scheme with icon
  - Single output handle

- **ActionNode** (`/web/src/components/workflow/ActionNode.tsx`)
  - Bound to 23 actions from action registry
  - Visual: Blue color scheme
  - Input and output handles

- **ConditionNode** (`/web/src/components/workflow/ConditionNode.tsx`)
  - If/else branching
  - Visual: Yellow color scheme
  - Two output handles: "true" (green) and "false" (red)

- **SwitchNode** (`/web/src/components/workflow/SwitchNode.tsx`)
  - Multi-way branching (switch/case)
  - Visual: Purple color scheme
  - Dynamic output handles based on cases

- **LoopNode** (`/web/src/components/workflow/LoopNode.tsx`)
  - Iterate over collections or fixed iterations
  - Visual: Green color scheme
  - Single "body" output handle

### 2. Enhanced Node Inspector
Created schema-driven property inspector (`/web/src/components/workflow/NodeInspector.tsx`):

- **Trigger Configuration**
  - Trigger type selector
  - Cron expression for onSchedule
  - Data source for onDataChange
  - Event type for onServerEvent

- **Action Configuration**
  - Dropdown with 23 actions grouped by category
  - JSON parameter editor with mustache syntax support
  - Hint text for variable references

- **Condition Configuration**
  - Expression editor
  - Support for step output references

- **Switch Configuration**
  - Value expression editor
  - Comma-separated case list

- **Loop Configuration**
  - Items array reference
  - Fixed iteration count
  - Loop variable name configuration

- **Node Output Reference**
  - Shows mustache syntax for referencing node output
  - Format: `{{step_<nodeId>.output}}`

### 3. Node Connections
- React Flow `onConnect` handler properly wired
- Edges created with arrow markers
- Conditional branching via sourceHandle (true/false)
- Switch branching via case-specific handles

### 4. Workflow Execution
- Execute button calls `POST /api/workflows/:id/execute`
- Backend workflow engine processes graph topologically
- Supports all node types (action, condition, switch, loop, parallel, delay, try_catch)

## Testing Instructions

### Test 1: Create Simple Workflow
1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start web admin: `cd web && npm run dev`
3. Navigate to Workflows page
4. Click "New Workflow"
5. Name: "Test Simple Workflow"
6. Trigger Type: "Manual"
7. Click "Create"

### Test 2: Build Workflow Graph
1. Click "+ Trigger" button
2. Select the trigger node, set label to "Manual Trigger"
3. Click "+ Action" button
4. Select the action node
5. In inspector:
   - Label: "Send Notification"
   - Action: "show_notification"
   - Parameters:
     ```json
     {
       "title": "Hello",
       "message": "Workflow executed!"
     }
     ```
6. Connect trigger output to action input (drag from bottom handle to top handle)
7. Click "Save"

### Test 3: Conditional Branching
1. Add another action node
2. Configure:
   - Label: "Fetch Weather"
   - Action: "fetch_weather"
   - Parameters:
     ```json
     {
       "location": "London",
       "connection_id": "your-connection-id"
     }
     ```
3. Add a condition node
4. Configure:
   - Label: "Check Temperature"
   - Condition: "step_action-123.output.temperature > 20"
5. Add two more action nodes for true/false branches
6. Connect: Trigger → Fetch Weather → Condition → (true) Action A / (false) Action B
7. Click "Save"

### Test 4: Loop Workflow
1. Add action node:
   - Label: "Fetch RSS"
   - Action: "fetch_rss"
   - Parameters:
     ```json
     {
       "feed_url": "https://hnrss.org/frontpage"
     }
     ```
2. Add loop node:
   - Label: "Process Articles"
   - Items: "step_action-456.output.articles"
   - Variable: "article"
3. Add action inside loop:
   - Label: "Log Article"
   - Action: "set_variable"
   - Parameters:
     ```json
     {
       "name": "last_article",
       "value": "{{article.title}}"
     }
     ```
4. Connect: Trigger → Fetch RSS → Loop → Log Article
5. Click "Save"

### Test 5: Execute Workflow
1. Click "Execute" button
2. Check toast notification for success
3. Backend logs should show workflow execution
4. Verify actions were executed (check notifications, variables, etc.)

### Test 6: Switch Node
1. Add action that returns status
2. Add switch node:
   - Label: "Route by Status"
   - Value: "step_action-789.output.status"
   - Cases: "success, error, pending"
3. Add 3 action nodes for each case
4. Connect switch to each action via case-specific handles
5. Save and execute

## Action Registry Reference

### Data Actions
- `refresh_data` - Re-fetch SDUI screen data
- `submit_form` - Store form submission
- `fetch_rss` - Parse RSS feed
- `fetch_weather` - Get weather data (requires connection)

### AI Actions
- `send_to_agent` - Route message to AI chat

### Calendar Actions
- `create_calendar_event` - Create event
- `delete_calendar_event` - Delete event

### Notification Actions
- `mark_notification_read` - Mark as read
- `show_notification` - Display notification
- `show_alert` - Display alert

### SDUI Actions
- `approve_draft` - Publish draft screen
- `reject_draft` - Reject draft screen

### Variable Actions
- `set_variable` - Upsert custom variable

### Workflow Actions
- `run_workflow` - Execute another workflow

### Navigation Actions
- `navigate` - Navigate to screen
- `go_back` - Go back
- `open_url` - Open external URL

### UI Actions
- `set_component_state` - Update component state
- `toggle` - Toggle boolean state
- `haptic` - Trigger haptic feedback

### System Actions
- `share` - Share content
- `copy_text` - Copy to clipboard

### Flow Control Actions
- `delay` - Wait for duration
- `chain` - Chain multiple actions
- `conditional` - Conditional execution

## Mustache Variable Syntax

Reference previous step outputs in parameters:

- `{{step_<nodeId>.output}}` - Full output
- `{{step_<nodeId>.output.field}}` - Specific field
- `{{step_<nodeId>.output.nested.field}}` - Nested field
- `{{event.data}}` - Trigger event data
- `{{item}}` - Current loop item
- `{{index}}` - Current loop index

## Known Limitations

1. Node IDs are auto-generated as `<type>-<timestamp>` - not sequential
2. Switch node handles are positioned evenly - may overlap with many cases
3. No visual validation of mustache syntax
4. No autocomplete for step references
5. No workflow execution history/logs in UI (backend only)

## Files Modified

- `/web/src/pages/WorkflowsPage.tsx` - Updated to use new node types and inspector
- `/web/src/components/workflow/TriggerNode.tsx` - New
- `/web/src/components/workflow/ActionNode.tsx` - New
- `/web/src/components/workflow/ConditionNode.tsx` - New
- `/web/src/components/workflow/SwitchNode.tsx` - New
- `/web/src/components/workflow/LoopNode.tsx` - New
- `/web/src/components/workflow/NodeInspector.tsx` - New

## Backend Integration

The workflow editor saves graphs to the backend as:

```json
{
  "nodes": [
    {
      "id": "trigger-123",
      "type": "trigger",
      "position": { "x": 250, "y": 100 },
      "data": {
        "label": "Manual Trigger",
        "triggerType": "manual"
      }
    },
    {
      "id": "action-456",
      "type": "action",
      "position": { "x": 250, "y": 250 },
      "data": {
        "label": "Send Notification",
        "action": "show_notification",
        "params": {
          "title": "Hello",
          "message": "Workflow executed!"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "trigger-123",
      "target": "action-456",
      "markerEnd": { "type": "arrowclosed" }
    }
  ]
}
```

The backend workflow engine (`backend/app/services/workflow_engine.py`) executes this graph topologically, resolving mustache variables and handling branching logic.
