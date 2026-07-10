"""Vercel serverless function: POST /api/token.

Relays the browser's client-credentials request to Adobe IMS to bypass browser
CORS (mirrors server.py's _proxy_token for local dev). The IMS credentials are
supplied by the user in the request body and are NOT stored server-side — this
function forwards to a single fixed Adobe endpoint and returns IMS's response.
"""
import json
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler

IMS_TOKEN_URL = "https://ims-na1.adobelogin.com/ims/token/v3"
_MAX_BODY = 8192  # client-credentials bodies are tiny; cap to reject abuse


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > _MAX_BODY:
                return self._respond(400, json.dumps(
                    {"error": "invalid or too-large request body"}).encode())
            body = self.rfile.read(length)

            req = urllib.request.Request(
                IMS_TOKEN_URL,
                data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                self._respond(200, resp.read())
        except urllib.error.HTTPError as e:
            # Pass IMS's own error + status straight through (never a secret).
            self._respond(e.code, e.read())
        except Exception as e:  # network/timeout
            self._respond(502, json.dumps({"error": str(e)}).encode())

    def _respond(self, code, body_bytes):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body_bytes)))
        self._cors()
        self.end_headers()
        self.wfile.write(body_bytes)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
