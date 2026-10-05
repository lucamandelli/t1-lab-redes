# Parser de requisições HTTP.
#
# O TCP entrega um fluxo de bytes: um recv() pode trazer meia requisição, uma inteira,
# ou uma requisição e o começo da próxima. Por isso o parser recebe o buffer acumulado
# da conexão e responde:
#   - None:             ainda não chegou a linha em branco (ou o corpo inteiro); esperar mais bytes
#   - BadRequest:       requisição malformada (vira 400)
#   - (req, consumidos): requisição pronta + quantos bytes ela ocupou (o resto é da próxima)
import re
from urllib.parse import unquote


class BadRequest(Exception):
    pass


class HttpRequest:
    def __init__(self, method, path, version, headers):
        self.method = method
        self.path = path  # caminho decodificado, sem query string (ex: "/a b.txt")
        self.version = version
        self.headers = headers  # nomes em minúsculo


def parse_request(buffer):
    # Fim dos cabeçalhos = CRLF da última linha + linha em branco
    end = buffer.find(b'\r\n\r\n')
    if end == -1:
        return None

    lines = buffer[:end].decode('latin-1').split('\r\n')

    # Request line: MÉTODO SP request-target SP VERSÃO
    parts = lines[0].split(' ')
    if len(parts) != 3:
        raise BadRequest()
    method, target, version = parts
    # Versão no formato HTTP/x.y (ex: HTTP/1.1)
    if not target.startswith('/') or not re.fullmatch(r'HTTP/\d\.\d', version):
        raise BadRequest()

    # Tira a query string e decodifica o percent-encoding (%20 -> espaço)
    path = unquote(target.split('?')[0])

    # Cabeçalhos: "Nome: valor"
    headers = {}
    for line in lines[1:]:
        if ':' not in line:
            raise BadRequest()
        name, value = line.split(':', 1)
        headers[name.strip().lower()] = value.strip()

    # Se tiver corpo (ex: POST), ele também faz parte desta requisição: espera chegar
    # inteiro e consome junto, senão ele seria lido como o começo da próxima
    length = headers.get('content-length', '0')
    if not length.isdigit():
        raise BadRequest()
    consumed = end + 4 + int(length)
    if len(buffer) < consumed:
        return None

    return HttpRequest(method, path, version, headers), consumed
