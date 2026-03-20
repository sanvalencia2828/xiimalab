#!/usr/bin/env python
"""Test imports del backend"""
import sys
import os
import traceback

# Add API directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'services/api'))

try:
    from main import app
    print("✅ All imports OK - API ready")
except Exception as e:
    print(f"❌ Error importing main: {e}")
    traceback.print_exc()
    sys.exit(1)
