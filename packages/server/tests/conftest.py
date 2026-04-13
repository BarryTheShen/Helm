"""Shared pytest configuration for keel-server tests."""

import sys
from pathlib import Path

# Ensure keel_server package is importable without installation
sys.path.insert(0, str(Path(__file__).parent.parent))
