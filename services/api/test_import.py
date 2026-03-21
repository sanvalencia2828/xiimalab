import sys
import traceback

try:
    from main import app
    print("IMPORT SUCCESS")
except Exception as e:
    print("IMPORT ERROR:")
    traceback.print_exc()
    sys.exit(1)
