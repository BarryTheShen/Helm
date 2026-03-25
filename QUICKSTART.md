# Quick Start Guide - Agentic AI Super App

## What's Running Now

Your **backend is fully operational** on `http://localhost:8000`:
- ✓ FastAPI server with WebSocket support
- ✓ SQLite database with all tables migrated
- ✓ Admin user created (username: `admin`, password: `testpass123`)
- ✓ Agent configured for OpenRouter `stepfun/step-3.5-flash:free`
- ✓ MCP tools verified working (including UI update capability)

## Next Steps to Test the Full System

### 1. Add Your OpenRouter API Key

**IMPORTANT**: You need a valid OpenRouter API key for the agent to work.

```bash
cd /home/runner/work/Helm/Helm/backend
nano .env  # or vim .env
```

Replace this line:
```
OPENAI_API_KEY=sk-or-v1-test-key
```

With your actual key:
```
OPENAI_API_KEY=sk-or-v1-YOUR_ACTUAL_KEY_HERE
```

Get a free key at: https://openrouter.ai/keys

Then restart the server:
```bash
pkill -f uvicorn
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start the Mobile App

```bash
cd /home/runner/work/Helm/Helm/mobile
npm install  # First time only
npx expo start
```

Options:
- **iOS Simulator** (Mac only): Press `i` in the terminal
- **Android Emulator**: Press `a` in the terminal
- **Physical Device**: Scan QR code with Expo Go app

### 3. Connect Mobile App to Backend

In the app:
1. **Connect Screen**: Enter `http://YOUR_IP:8000`
   - Same machine: `http://localhost:8000`
   - Physical device: Use your computer's local IP (e.g., `http://192.168.1.100:8000`)

2. **Login Screen**:
   - Username: `admin`
   - Password: `testpass123`

### 4. Test Agent UI Update

Go to the **Chat** tab and send:

```
Hello! Please test your UI update capability by calling update_module_state
with a calendar showing some sample events for today.
```

**What should happen:**
1. Agent receives your message via WebSocket
2. Agent processes it using OpenRouter's step-3.5-flash model
3. Agent calls `update_module_state` tool with calendar JSON
4. Backend saves the state and pushes it via WebSocket
5. **Your mobile app's UI updates in real-time!**

## Alternative: Test Without Mobile App

I've created test scripts that work from the command line:

### Test 1: Direct Tool Call (Already Verified ✓)
```bash
cd /home/runner/work/Helm/Helm/backend
.venv/bin/python3 /tmp/test_ui_update.py
```

This directly calls `update_module_state` and verifies it saves to DB.

**Result**: ✓ Working! The tool correctly saves UI state and broadcasts via WebSocket.

### Test 2: Full WebSocket Chat Flow
```bash
cd /home/runner/work/Helm/Helm/backend
.venv/bin/python3 /tmp/test_flow.py
```

This:
- Connects to WebSocket as a client
- Sends a chat message
- Captures the agent's streaming response
- Shows any tool calls (including UI updates)

**Requires**: Valid OpenRouter API key in `.env`

## Architecture Summary

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Mobile App     │         │   FastAPI        │         │   OpenRouter     │
│  (React Native) │         │   Backend        │         │   AI Agent       │
│                 │         │                  │         │   (step-3.5)     │
├─────────────────┤         ├──────────────────┤         ├──────────────────┤
│ SDUI Renderer   │ ◄──WS───┤ WebSocket Server │         │                  │
│ Components:     │         │ Agent Proxy      │ ◄──HTTP─┤ Function Calling │
│ - Calendar      │         │ MCP Tools:       │         │                  │
│ - Chat          │         │  • update_module │───────► │                  │
│ - Alerts        │         │  • create_event  │         │                  │
│ - Forms         │         │  • send_notif    │         │                  │
└─────────────────┘         └──────────────────┘         └──────────────────┘
```

**The Flow:**
1. User sends message → Mobile App → Backend (WebSocket)
2. Backend → OpenRouter API (streaming)
3. Agent decides to update UI → calls `update_module_state` tool
4. Backend executes tool → saves SDUI JSON to database
5. Backend → Mobile App (WebSocket): `{"type": "module_state_update", ...}`
6. Mobile App's SDUI renderer displays the UI natively

## What I Fixed

### Bug: Missing AgentConfig Fields

**Problem**: The `AgentConfig` model was missing three fields that the routers expected:
- `temperature` (Float)
- `max_tokens` (Integer)
- `is_active` (Boolean)

**Fix**:
- Updated `/home/runner/work/Helm/Helm/backend/app/models/agent_config.py`
- Created migration: `638606c41297_add_temperature_max_tokens_is_active_to_*.py`
- Applied migration to database

**Location**: backend/app/models/agent_config.py:19-21

## API Key Configuration

The agent is configured with:
- **Provider**: OpenRouter
- **Model**: `stepfun/step-3.5-flash:free` (free tier, fast responses)
- **Base URL**: `https://openrouter.ai/api/v1`
- **System Prompt**: "You are Helm, an AI assistant. You can update UI by calling update_module_state tool. Test this capability."
- **Temperature**: 0.7
- **Max Tokens**: 2048

## Testing Commands

All from `/home/runner/work/Helm/Helm/backend`:

```bash
# Check backend health
curl http://localhost:8000/health

# Login (get token for other requests)
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "testpass123", "device_id": "test-001", "device_name": "Test"}'

# Run backend tests
.venv/bin/python -m pytest tests/ -v

# Check database
.venv/bin/python3 -c "
import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.module_state import ModuleState

async def check():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ModuleState))
        states = result.scalars().all()
        print(f'Module states: {len(states)}')
        for s in states:
            print(f'  - {s.module_type} (v{s.version})')
asyncio.run(check())
"
```

## Ready to Test!

Everything is configured and ready. You just need to:

1. **Add your OpenRouter API key** to `/home/runner/work/Helm/Helm/backend/.env`
2. **Start the mobile app**: `cd mobile && npx expo start`
3. **Connect and chat** with the agent to test UI updates

The agent has been instructed in its system prompt to test the `update_module_state` capability, so it should automatically demonstrate updating your frontend UI when you ask it to.
