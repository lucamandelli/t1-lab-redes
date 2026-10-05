# Montagem das respostas HTTP/1.1.
import os
from email.utils import formatdate

# Identificador do grupo no cabeçalho Server (trocar pelo nome do grupo)
SERVER_ID = 'TrabRedes-Grupo9/1.0'

REASONS = {
    200: 'OK',
    400: 'Bad Request',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
}

MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.pdf': 'application/pdf',
}


def content_type(file_path):
    extension = os.path.splitext(file_path)[1].lower()
    return MIME_TYPES.get(extension, 'application/octet-stream')


# Linha de status + cabeçalhos + linha em branco
def build_head(status, headers):
    lines = [
        f'HTTP/1.1 {status} {REASONS[status]}',
        f'Date: {formatdate(usegmt=True)}',  # IMF-fixdate em GMT: "Sun, 06 Nov 1994 08:49:37 GMT"
        f'Server: {SERVER_ID}',
    ]
    for name, value in headers.items():
        lines.append(f'{name}: {value}')
    return ('\r\n'.join(lines) + '\r\n\r\n').encode('latin-1')
