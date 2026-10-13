import http.server, os

# public/ at http://localhost:3000, answered the way GitHub Pages answers: a file as it is,
# a folder by its index.html (a folder asked for without its slash gets one), and anything
# else 404.html with a 404.
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

class PagesHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
        '.html':  'text/html; charset=utf-8',
        '.css':   'text/css; charset=utf-8',
        '.js':    'text/javascript; charset=utf-8',
        '.json':  'application/json; charset=utf-8',
        '.xml':   'application/xml; charset=utf-8',
        '.woff2': 'font/woff2',
    }

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isfile(path) or os.path.isfile(os.path.join(path, "index.html")):
            return super().send_head()
        try:
            f = open(os.path.join(ROOT, "404.html"), "rb")
        except OSError:
            self.send_error(404)
            return None
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(os.fstat(f.fileno()).st_size))
        self.end_headers()
        return f

http.server.ThreadingHTTPServer(("", 3000), PagesHandler).serve_forever()
