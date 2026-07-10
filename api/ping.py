"""Vercel serverless function: GET /api/token health check.

Lets the browser confirm the proxy is reachable (mirrors server.py's /api/ping
for local dev). Holds no secret.
"""
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b'{"status":"ok","server":"aep-proxy"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)
