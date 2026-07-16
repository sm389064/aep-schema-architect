"""
Local dev server for AEP Schema Architect.
Serves static files AND proxies IMS token requests to bypass browser CORS.
Run: python server.py
Then open: http://localhost:8788/setup.html
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.error
import json
import os

PORT = 8788
IMS_TOKEN_URL = "https://ims-na1.adobelogin.com/ims/token/v3"


class Handler(SimpleHTTPRequestHandler):

    def log_message(self, fmt, *args):
        # Quieter logging — only show non-200s and API calls
        if args and (str(args[1]) != "200" or "/api/" in str(args[0])):
            super().log_message(fmt, *args)

    # ── CORS preflight ──
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        # Expose a ping endpoint so the browser can confirm this is the real proxy
        if self.path == "/api/ping":
            body = b'{"status":"ok","server":"aep-proxy"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
            return
        # All other GETs: serve static files as normal
        super().do_GET()

    # ── Proxy endpoint ──
    def do_POST(self):
        if self.path == "/api/token":
            self._proxy_token()
        else:
            self.send_response(404)
            self.end_headers()

    def _proxy_token(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)

            req = urllib.request.Request(
                IMS_TOKEN_URL,
                data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
                self._json_response(200, data)

        except urllib.error.HTTPError as e:
            data = e.read()
            self._json_response(e.code, data)
        except Exception as e:
            self._json_response(500, json.dumps({"error": str(e)}).encode())

    def _json_response(self, code, body_bytes):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body_bytes)))
        self._cors()
        self.end_headers()
        self.wfile.write(body_bytes)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "http://localhost:" + str(PORT))
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")


if __name__ == "__main__":
    # Serve files from the same directory as this script
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    httpd = HTTPServer(("localhost", PORT), Handler)
    print(f"\n  AEP Schema Architect — local server")
    print(f"  ─────────────────────────────────────")
    print(f"  App          : http://localhost:{PORT}/index.html")
    print(f"  IMS proxy    : http://localhost:{PORT}/api/token")
    print(f"\n  Press Ctrl+C to stop.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
