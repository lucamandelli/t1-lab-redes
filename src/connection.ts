// Atende uma conexão TCP: acumula bytes, extrai requisições, responde em ordem
// e mantém a conexão aberta (persistente) até o cliente pedir para fechar ou ela ficar ociosa.
import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as path from 'node:path';
import { HttpRequest, parseRequest } from './parser';
import { buildHead, contentType, REASONS } from './response';

const IDLE_TIMEOUT_MS = 5000;

export function handleConnection(socket: net.Socket, root: string): void {
  const client = `${socket.remoteAddress}:${socket.remotePort}`;
  let buffer = Buffer.alloc(0); // bytes recebidos e ainda não processados
  let busy = false; // respondendo uma requisição (as respostas precisam sair em ordem)
  let closing = false; // já decidimos fechar a conexão

  // Conexão ociosa por 5 s -> fecha
  socket.setTimeout(IDLE_TIMEOUT_MS);
  socket.on('timeout', () => socket.end());
  socket.on('error', (err) => console.log(`${client} erro: ${err.message}`));

  // Cada 'data' é um pedaço qualquer do fluxo TCP (equivale a um recv())
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    processBuffer();
  });

  // Responde todas as requisições completas que estão no buffer, uma de cada vez
  async function processBuffer(): Promise<void> {
    if (busy) return; // a execução em andamento vai pegar os bytes novos no próximo loop
    busy = true;
    while (!closing) {
      const result = parseRequest(buffer);
      if (result.status === 'incomplete') break;

      if (result.status === 'error') {
        send(400, 'GET', false);
        closing = true;
        break;
      }

      buffer = buffer.subarray(result.consumed); // o que sobra é o começo da próxima requisição
      const keepAlive = await respond(result.request);
      if (!keepAlive) closing = true;
    }
    if (closing) socket.end(); // envia o que falta e fecha (FIN)
    busy = false;
  }

  async function respond(req: HttpRequest): Promise<boolean> {
    // HTTP/1.1 é persistente por padrão; só fecha se o cliente pedir
    const keepAlive = req.headers.get('connection')?.toLowerCase() !== 'close';

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(405, req.method, keepAlive, { Allow: 'GET, HEAD' });
    } else {
      // Junta o caminho com a raiz, resolvendo os "..". Se o resultado sair da raiz -> 403
      const urlPath = req.path === '/' ? '/index.html' : req.path; // "/" serve a página inicial
      const filePath = path.resolve(root, '.' + urlPath);
      if (filePath !== root && !filePath.startsWith(root + path.sep)) {
        send(403, req.method, keepAlive);
      } else {
        try {
          const body = await fs.readFile(filePath);
          send(200, req.method, keepAlive, {}, body, contentType(filePath));
        } catch {
          send(404, req.method, keepAlive); // não existe (ou é diretório)
        }
      }
    }
    return keepAlive;
  }

  // Envia a resposta. Erros levam um corpo de texto curto. HEAD não leva corpo,
  // mas o Content-Length informa o tamanho que o corpo teria.
  function send(status: number, method: string, keepAlive: boolean, extra: Record<string, string> = {},
    body = Buffer.from(`${status} ${REASONS[status]}\n`), type = 'text/plain'): void {
    const head = buildHead(status, {
      'Content-Type': type,
      'Content-Length': body.length,
      Connection: keepAlive ? 'keep-alive' : 'close',
      ...extra,
    });
    socket.write(method === 'HEAD' ? head : Buffer.concat([head, body]));
    console.log(`${new Date().toISOString()} ${client} ${method} -> ${status}`);
  }
}
