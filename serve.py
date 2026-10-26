# Local test server: python serve.py → http://localhost:5500
# Like "python -m http.server", but always sends .js as JavaScript.
# (On this PC Windows has .js registered as text/plain, and browsers refuse to run modules sent as plain text.)
import http.server

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map['.js'] = 'text/javascript'
http.server.test(HandlerClass=Handler, port=5500)