// Parser de requisições HTTP/1.1.
//
// O TCP entrega um FLUXO de bytes, não mensagens. Um único evento 'data' pode trazer
// meia requisição, uma requisição inteira, ou uma requisição e o começo da próxima.
// Por isso o parser recebe o buffer acumulado da conexão e responde uma de três coisas:
//   - incomplete: ainda não chegou a linha em branco (ou o corpo); esperar mais bytes
//   - error:      requisição malformada (vira 400)
//   - ok:         requisição pronta + quantos bytes ela ocupou (o resto fica para a próxima)

export const MAX_HEADER_BYTES = 8 * 1024; // limite da request line + cabeçalhos
export const MAX_BODY_BYTES = 1024 * 1024; // limite de corpo (só descartamos, nunca usamos)

export interface HttpRequest {
  method: string;
  target: string; // request-target como veio (ex: /a%20b.txt?x=1)
  path: string; // caminho decodificado, sem query (ex: /a b.txt)
  version: string; // HTTP/1.1 ou HTTP/1.0
  headers: Map<string, string>; // nomes em minúsculo (cabeçalhos são case-insensitive)
}

export type ParseResult =
  | { status: 'incomplete' }
  | { status: 'error'; reason: string }
  | { status: 'ok'; request: HttpRequest; consumed: number };

const HEADER_END = Buffer.from('\r\n\r\n'); // CRLF da última linha + linha em branco
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/; // caracteres válidos em método e nome de cabeçalho (RFC 9110 §5.6.2)

function error(reason: string): ParseResult {
  return { status: 'error', reason };
}

export function parseRequest(buffer: Buffer): ParseResult {
  // RFC 9112 §2.2: o servidor deve ignorar linhas vazias antes da request line
  let start = 0;
  while (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2;

  // 1. Procurar o fim da seção de cabeçalhos
  const end = buffer.indexOf(HEADER_END, start);
  if (end === -1) {
    if (buffer.length - start > MAX_HEADER_BYTES) return error('cabeçalho grande demais');
    return { status: 'incomplete' };
  }
  if (end - start > MAX_HEADER_BYTES) return error('cabeçalho grande demais');

  // latin1 = 1 byte -> 1 caractere, sem risco de quebrar bytes inválidos
  const lines = buffer.toString('latin1', start, end).split('\r\n');

  // 2. Request line: MÉTODO SP request-target SP VERSÃO
  const parts = lines[0].split(' ');
  if (parts.length !== 3) return error('request line deve ter 3 partes: método, alvo e versão');
  const [method, target, version] = parts;
  if (!TOKEN.test(method)) return error('método inválido');
  if (!/^HTTP\/1\.[01]$/.test(version)) return error('versão HTTP inválida');

  const path = parseTarget(method, target);
  if (path === null) return error('request-target inválido');

  // 3. Linhas de cabeçalho: Nome: valor
  const headers = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(':');
    if (colon <= 0) return error(`linha de cabeçalho sem ':'`);
    const name = line.slice(0, colon);
    // nome com espaço (ex: "Host : x" ou linha começando com espaço) é proibido pela RFC 9112 §5
    if (!TOKEN.test(name)) return error('nome de cabeçalho inválido');
    const value = line.slice(colon + 1).trim();
    if (/[\r\n\0]/.test(value)) return error('valor de cabeçalho inválido');
    const key = name.toLowerCase();
    const previous = headers.get(key);
    headers.set(key, previous === undefined ? value : `${previous}, ${value}`);
  }

  // RFC 9112 §3.2: requisição HTTP/1.1 sem Host deve receber 400
  if (version === 'HTTP/1.1' && !headers.has('host')) return error('HTTP/1.1 exige o cabeçalho Host');

  // 4. Corpo: GET/HEAD não usam, mas se o cliente mandar um (ex: POST que vai virar 405)
  //    precisamos consumi-lo, senão os bytes dele seriam lidos como a "próxima requisição".
  if (headers.has('transfer-encoding')) return error('Transfer-Encoding na requisição não é suportado');
  let bodyLength = 0;
  const contentLength = headers.get('content-length');
  if (contentLength !== undefined) {
    if (!/^\d+$/.test(contentLength)) return error('Content-Length inválido');
    bodyLength = Number(contentLength);
    if (bodyLength > MAX_BODY_BYTES) return error('corpo grande demais');
  }

  const consumed = end + HEADER_END.length + bodyLength;
  if (buffer.length < consumed) return { status: 'incomplete' }; // corpo ainda chegando

  return { status: 'ok', request: { method, target, path, version, headers }, consumed };
}

// Extrai o caminho decodificado do request-target. Retorna null se for inválido.
function parseTarget(method: string, target: string): string | null {
  if (target === '*') return method === 'OPTIONS' ? '*' : null; // asterisk-form (só OPTIONS)

  // absolute-form (ex: GET http://host:8080/a.html HTTP/1.1): fica só com o caminho
  let raw = target;
  const absolute = /^https?:\/\/[^/?#]*/i.exec(target);
  if (absolute) raw = target.slice(absolute[0].length);

  raw = raw.split(/[?#]/)[0]; // query string não identifica arquivo
  if (raw === '' && absolute) raw = '/';
  if (!raw.startsWith('/')) return null;

  // percent-encoding: %20 -> espaço, %2e -> '.', etc. Decodifica UMA vez só.
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null; // ex: "%zz" ou sequência UTF-8 quebrada
  }
  if (decoded.includes('\0')) return null; // byte nulo pode truncar caminhos em APIs do SO
  return decoded;
}
