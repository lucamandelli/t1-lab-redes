// Montagem das respostas HTTP/1.1.
import * as path from 'node:path';

// Identificador do grupo no cabeçalho Server (trocar pelo nome do grupo)
const SERVER_ID = 'TrabRedes-GrupoX/1.0';

export const REASONS: Record<number, string> = {
  200: 'OK',
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
};

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
};

export function contentType(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

// Linha de status + cabeçalhos + linha em branco
export function buildHead(status: number, headers: Record<string, string | number>): Buffer {
  const lines = [
    `HTTP/1.1 ${status} ${REASONS[status]}`,
    `Date: ${new Date().toUTCString()}`, // IMF-fixdate em GMT: "Sun, 06 Nov 1994 08:49:37 GMT"
    `Server: ${SERVER_ID}`,
  ];
  for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
  return Buffer.from(lines.join('\r\n') + '\r\n\r\n');
}
