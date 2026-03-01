import http.server, os

ROOT = os.path.dirname(__file__) or "."

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
        '.html': 'text/html; charset=utf-8',
        '.css':  'text/css; charset=utf-8',
        '.js':   'text/javascript; charset=utf-8',
        '.mjs':  'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.xml':  'application/xml; charset=utf-8',
        '.yml':  'text/yaml; charset=utf-8',
    }

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_GET(self):
        path = os.path.join(ROOT, self.path.lstrip("/"))
        if not os.path.exists(path) or os.path.isdir(path) and not os.path.exists(os.path.join(path, "index.html")):
            self.path = "/index.html"
        super().do_GET()

http.server.HTTPServer(("", 3000), SPAHandler).serve_forever()
