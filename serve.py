#!/usr/bin/env python3
import http.server, socketserver, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self): self.send_header('Cache-Control','no-store'); super().end_headers()
with socketserver.TCPServer(('',8791),H) as h:
    print('Naples Guide -> http://localhost:8791'); h.serve_forever()
