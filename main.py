import http.server
import socketserver
import os

# TODO filter IP 

PORT = 8000
WEB_DIR = os.path.join(os.path.dirname(__file__), 'web')

# PRODUCTION
""" AUTH_FILE_PATH = '/homeassistant/.storage/auth'
DEVICES_FILE_PATH = '/homeassistant/.storage/core.device_registry'
ENTITIES_FILE_PATH = '/homeassistant/.storage/core.entity_registry' """

# DEVELOPPEMENT
AUTH_FILE_PATH = os.path.join(os.path.dirname(__file__), 'temp', 'auth')
DEVICES_FILE_PATH = os.path.join(os.path.dirname(__file__), 'temp', 'devices')
ENTITIES_FILE_PATH = os.path.join(os.path.dirname(__file__), 'temp', 'entities')



class MyHttpRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
        elif self.path == '/api/auth':
            with open(AUTH_FILE_PATH, 'r', encoding='utf-8') as file:
                auth = file.read()
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(auth.encode())
            return
        elif self.path == '/api/device_registry':
            with open(DEVICES_FILE_PATH, 'r', encoding='utf-8') as file:
                devices = file.read()
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(devices.encode())
            return
        elif self.path == '/api/entity_registry':
            with open(ENTITIES_FILE_PATH, 'r', encoding='utf-8') as file:
                entities = file.read()
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(entities.encode())
            return
        return http.server.SimpleHTTPRequestHandler.do_GET(self)
    
    def do_POST(self):
        if self.path == '/api/auth':
            # Lire le body de la requête
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            # Ecrire dans le fichier
            with open(AUTH_FILE_PATH, 'w', encoding='utf-8') as file:
                file.write(post_data.decode())

            self.send_response(200)
            self.end_headers()
            return
        return http.server.SimpleHTTPRequestHandler.do_POST(self)
    
os.chdir(WEB_DIR)

Handler = MyHttpRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print("serving at port", PORT)
    httpd.serve_forever()