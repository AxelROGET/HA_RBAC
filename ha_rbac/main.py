import http.server
import socketserver
import os
import sys

# TODO filter IP 

PORT = 8000
WEB_DIR = os.path.join(os.path.dirname(__file__), 'web')

if '--debug' in sys.argv:
    # DEVELOPMENT
    print("Running in debug mode, no authentification needed. Do not use in production.")
    AUTH_FILE_PATH = os.path.join(os.path.dirname(__file__), 'temp', 'auth')
    DEVICES_FILE_PATH = os.path.join(os.path.dirname(__file__), 'temp', 'devices')
    ENTITIES_FILE_PATH = os.path.join(os.path.dirname(__file__), 'temp', 'entities')

else:
    # PRODUCTION
    AUTH_FILE_PATH = '/homeassistant/.storage/auth'
    DEVICES_FILE_PATH = '/homeassistant/.storage/core.device_registry'
    ENTITIES_FILE_PATH = '/homeassistant/.storage/core.entity_registry'





class MyHttpRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if not self.check_auth(): 
            self.send_response(401)
            self.end_headers()
            return
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
        if not self.check_auth(): 
            self.send_response(401)
            self.end_headers()
            return
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
    
    def check_auth(self):
        if not '--debug' in sys.argv:
            return True if self.client_address[0] == '172.30.32.2' else False
        else:
            return True
    
os.chdir(WEB_DIR)

Handler = MyHttpRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print("serving at port", PORT)
    httpd.serve_forever()