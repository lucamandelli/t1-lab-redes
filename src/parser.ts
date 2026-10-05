// Parser de requisições HTTP.
//
// O TCP entrega um fluxo de bytes: um recv() pode trazer meia requisição, uma inteira,
// ou uma requisição e o começo da próxima. Por isso o parser recebe o buffer acumulado
// da conexão e responde:
//   - incomplete: ainda não chegou a linha em branco; esperar mais bytes
//   - error:      requisição malformada (vira 400)
//   - ok:         requisição pronta + quantos bytes ela ocupou (o resto é da próxima)

export interface HttpRequest {
  method: string;
  path: string; // caminho decodificado, sem query string (ex: "/a b.txt")
  version: string;
  headers: Map<string, string>; // nomes em minúsculo
}

export type ParseResult =
  | { status: 'incomplete' }
  | { status: 'error' }
  | { status: 'ok'; request: HttpRequest; consumed: number };

export function parseRequest(buffer: Buffer): ParseResult {
  // Fim dos cabeçalhos = CRLF da última linha + linha em branco
  const end = buffer.indexOf('\r\n\r\n');
  if (end === -1) return { status: 'incomplete' };

  const lines = buffer.toString('latin1', 0, end).split('\r\n');

  // Request line: MÉTODO SP request-target SP VERSÃO
  const parts = lines[0].split(' ');
  if (parts.length !== 3) return { status: 'error' };
  const [method, target, version] = parts;
  if (!target.startsWith('/') || !version.startsWith('HTTP/')) return { status: 'error' };

  // Tira a query string e decodifica o percent-encoding (%20 -> espaço)
  let path: string;
  try {
    path = decodeURIComponent(target.split('?')[0]);
  } catch {
    return { status: 'error' }; // ex: "%zz"
  }

  // Cabeçalhos: "Nome: valor"
  const headers = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(':');
    if (colon === -1) return { status: 'error' };
    headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }

  return { status: 'ok', request: { method, path, version, headers }, consumed: end + 4 };
}
