#!/bin/bash

set -e

echo "🧪 Testing Helm Full Flow"
echo "=========================="

BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:8082"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Backend health check
echo -e "\n${YELLOW}1. Testing backend health check...${NC}"
if curl -s "$BACKEND_URL/health" | grep -q "ok"; then
  echo -e "${GREEN}✓ Backend is healthy${NC}"
else
  echo -e "${RED}✗ Backend health check failed${NC}"
  exit 1
fi

# Test 2: Auth status
echo -e "\n${YELLOW}2. Testing auth status...${NC}"
STATUS=$(curl -s "$BACKEND_URL/auth/status")
if echo "$STATUS" | grep -q "setup_complete"; then
  echo -e "${GREEN}✓ Auth status endpoint works${NC}"
  echo "Response: $STATUS"
else
  echo -e "${RED}✗ Auth status endpoint failed${NC}"
  exit 1
fi

# Test 3: Login endpoint
echo -e "\n${YELLOW}3. Testing login endpoint...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123", "device_id": "web", "device_name": "Web Browser"}')

if echo "$LOGIN_RESPONSE" | grep -q "session_token"; then
  echo -e "${GREEN}✓ Login endpoint works${NC}"
  SESSION_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"session_token":"[^"]*' | cut -d'"' -f4)
  echo "Session token: ${SESSION_TOKEN:0:20}..."
else
  echo -e "${RED}✗ Login endpoint failed${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

# Test 4: Frontend rendering
echo -e "\n${YELLOW}4. Testing frontend rendering...${NC}"
if curl -s "$FRONTEND_URL" | grep -q "Helm"; then
  echo -e "${GREEN}✓ Frontend is rendering${NC}"
else
  echo -e "${RED}✗ Frontend rendering failed${NC}"
  exit 1
fi

# Test 5: Frontend bundle loads
echo -e "\n${YELLOW}5. Testing frontend bundle...${NC}"
if curl -s "$FRONTEND_URL/index.ts.bundle?platform=web&dev=true" | head -c 100 | grep -q "." ; then
  echo -e "${GREEN}✓ Frontend bundle loads${NC}"
else
  echo -e "${RED}✗ Frontend bundle failed${NC}"
  exit 1
fi

echo -e "\n${GREEN}✅ All tests passed!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Open http://localhost:8082 in your browser"
echo "2. The app should initialize without errors"
echo "3. You should see the setup/login screen"
echo "4. Try logging in with: testuser / testpass123"

