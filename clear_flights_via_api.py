#!/usr/bin/env python3
"""Clear all flights and recommendations via API (requires backend running)."""

import requests

try:
    resp = requests.delete('http://localhost:5001/api/flights')
    if resp.status_code == 200:
        print('All flight and recommendation data cleared.')
    else:
        print(f'Error: {resp.status_code} {resp.text}')
except Exception as e:
    print(f'Failed to connect to backend: {e}')
    print('Make sure the backend is running on http://localhost:5001')
