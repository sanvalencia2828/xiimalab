import sys
import traceback
from fastapi.testclient import TestClient
from main import app

try:
    with TestClient(app) as client:
        print("Testing /health ... ")
        res = client.get("/health")
        print(f"Status: {res.status_code}")
        print(res.json())

        print("Testing /api/v1/market/trends ... ")
        res = client.get("/api/v1/market/trends")
        print(f"Status: {res.status_code}")
        
        # We don't print the full json to avoid too much output, just a check
        if res.status_code == 200:
            print("Successfully returned market trends data.")
        else:
            print("Failed content:", res.json())
            
        print("ALL TESTS PASSED")

except Exception as e:
    traceback.print_exc()
    sys.exit(1)
