
import requests
import json

# Local AI Server
URL = "http://localhost:8000/api/face/register"

payload = {
    "user_id": "35ecc231-2e5a-4c7d-afb9-a218db859ce9",
    "photos": [{"imageData": "dummy_data", "angle": "front"}],
    "liveness_frames": ["dummy_frame"],
    "challenge_type": "blink"
}

try:
    print(f"Testing registration for user: {payload['user_id']}")
    # Note: This will likely fail on embedding generation because of dummy data, 
    # but we want to see if it gets past the 'Student not found' check (404).
    res = requests.post(URL, json=payload)
    print(f"Status Code: {res.status_code}")
    print(f"Response: {res.json()}")
except Exception as e:
    print(f"Error: {e}")
