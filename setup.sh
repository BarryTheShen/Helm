HELM_DIR=$(pwd)

# Backend
tmux new-session -d -s backend -c "$HELM_DIR/backend"
tmux send-keys -t backend 'source .venv/bin/activate' Enter
tmux send-keys -t backend 'uvicorn app.main:app --reload --host 0.0.0.0 --port 9100' Enter

# Agent
tmux new-session -d -s agent -c "$HELM_DIR/agent"
tmux send-keys -t agent 'source ../backend/.venv/bin/activate' Enter
tmux send-keys -t agent 'python api_server.py' Enter

# Web
tmux new-session -d -s web -c "$HELM_DIR/web"
tmux send-keys -t web 'npm run dev' Enter

# Mobile
tmux new-session -d -s mobile -c "$HELM_DIR/mobile"
tmux send-keys -t mobile 'npx expo start' Enter
