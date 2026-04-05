"""Send a prompt to the Helm Agent API and capture the SSE response."""
import sys
import json
import requests

AGENT_URL = "http://localhost:7860/api/run"

def send(message: str) -> str:
    resp = requests.post(
        AGENT_URL,
        json={"message": message},
        stream=True,
        timeout=600,  # 10 minutes max
    )
    resp.raise_for_status()

    full = []
    for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        payload = json.loads(line[6:])
        if payload["type"] == "token":
            sys.stdout.write(payload["text"])
            sys.stdout.flush()
            full.append(payload["text"])
        elif payload["type"] == "done":
            print("\n\n--- DONE ---")
            return payload["text"]
        elif payload["type"] == "error":
            print(f"\n\n--- ERROR: {payload['text']} ---")
            return ""
    return "".join(full)


if __name__ == "__main__":
    msg = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else input("Prompt: ")
    result = send(msg)
    print(f"\n[Full response length: {len(result)} chars]")
