// Geração das mensagens de resposta HTTP/1.1.

// Identificador do grupo enviado no cabeçalho Server (trocar pelo nome do grupo)
export const SERVER_ID = 'TrabRedes-GrupoX/1.0';

const REASONS: Record<number, string> = {
  200: 'OK',
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
};

// Monta a linha de status + cabeçalhos + linha em branco.
// Date, Server e os demais cabeçalhos passados vão em toda resposta.
export function buildHead(status: number, headers: Record<string, string | number>): Buffer {
  const lines = [
    `HTTP/1.1 ${status} ${REASONS[status]}`,
    // toUTCString() já gera o IMF-fixdate da RFC 9110: "Sun, 06 Nov 1994 08:49:37 GMT"
    `Date: ${new Date().toUTCString()}`,
    `Server: ${SERVER_ID}`,
  ];
  for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
  return Buffer.from(lines.join('\r\n') + '\r\n\r\n', 'latin1');
}

// Corpo HTML das respostas de erro
export function errorPage(status: number, detail = ''): Buffer {
  const title = `${status} ${REASONS[status]}`;
  const html =
    `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${title}</title></head>\n` +
    `<body><h1>${title}</h1>${detail ? `<p>${escapeHtml(detail)}</p>` : ''}</body></html>\n`;
  return Buffer.from(html, 'utf-8');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
