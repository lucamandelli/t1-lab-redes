# Atende uma conexão TCP: acumula bytes, extrai requisições, responde em ordem
# e mantém a conexão aberta (persistente) até o cliente pedir para fechar ou ela ficar ociosa.
import os
import socket
from datetime import datetime

from request_parser import BadRequest, parse_request
from response import REASONS, build_head, content_type

IDLE_TIMEOUT = 5  # segundos


def handle_connection(conn, addr, root):
    client = f'{addr[0]}:{addr[1]}'
    buffer = b''  # bytes recebidos e ainda não processados

    # Conexão ociosa por 5 s -> o recv() levanta socket.timeout e a conexão é fechada
    conn.settimeout(IDLE_TIMEOUT)
    try:
        keep_alive = True
        while keep_alive:
            chunk = conn.recv(4096)  # um pedaço qualquer do fluxo TCP
            if not chunk:
                break  # o cliente fechou a conexão
            buffer += chunk

            # Responde todas as requisições completas que estão no buffer, uma de cada vez
            while keep_alive:
                try:
                    result = parse_request(buffer)
                except BadRequest:
                    send(conn, client, 400, 'GET', False)
                    keep_alive = False
                    break
                if result is None:
                    break  # requisição incompleta: esperar mais bytes
                request, consumed = result
                buffer = buffer[consumed:]  # o que sobra é o começo da próxima requisição
                keep_alive = respond(conn, client, request, root)
    except socket.timeout:
        pass
    except OSError as err:
        print(f'{client} erro: {err}')
    finally:
        conn.close()  # envia FIN e fecha


def respond(conn, client, req, root):
    # HTTP/1.1 é persistente por padrão; só fecha se o cliente pedir.
    # HTTP/1.0 é o contrário: fecha, a não ser que o cliente peça keep-alive
    connection = req.headers.get('connection', '').lower()
    if req.version == 'HTTP/1.0':
        keep_alive = connection == 'keep-alive'
    else:
        keep_alive = connection != 'close'

    if req.method not in ('GET', 'HEAD'):
        send(conn, client, 405, req.method, keep_alive, {'Allow': 'GET, HEAD'})
        return keep_alive

    # Junta o caminho com a raiz, resolvendo os "..". Se o resultado sair da raiz -> 403
    url_path = '/index.html' if req.path == '/' else req.path  # "/" serve a página inicial
    file_path = os.path.abspath(os.path.join(root, '.' + url_path))
    if file_path != root and not file_path.startswith(root + os.sep):
        send(conn, client, 403, req.method, keep_alive)
        return keep_alive

    try:
        with open(file_path, 'rb') as f:
            body = f.read()
    except (OSError, ValueError):
        send(conn, client, 404, req.method, keep_alive)  # não existe (ou é diretório)
        return keep_alive

    send(conn, client, 200, req.method, keep_alive, {}, body, content_type(file_path))
    return keep_alive


# Envia a resposta. Erros levam um corpo de texto curto. HEAD não leva corpo,
# mas o Content-Length informa o tamanho que o corpo teria.
def send(conn, client, status, method, keep_alive, extra=None, body=None, type='text/plain'):
    if body is None:
        body = f'{status} {REASONS[status]}\n'.encode()
    headers = {
        'Content-Type': type,
        'Content-Length': len(body),
        'Connection': 'keep-alive' if keep_alive else 'close',
    }
    headers.update(extra or {})
    head = build_head(status, headers)
    conn.sendall(head if method == 'HEAD' else head + body)
    # Texto e '\n' num único write, para linhas de threads diferentes não se misturarem
    print(f'{datetime.now().isoformat()} {client} {method} -> {status}\n', end='', flush=True)
