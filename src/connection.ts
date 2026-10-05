// Atende UMA conexão TCP: acumula bytes, extrai requisições, responde em ordem
// e decide se a conexão continua aberta (persistente) ou fecha.
import * as fs from 'node:fs';
import * as net from 'node:net';
import { HttpRequest, parseRequest } from './parser';
import { buildHead, errorPage } from './response';
import { resolveFile } from './files';
import { contentType } from './mime';
import { log } from './log';

export interface ServerConfig {
  root: string; // raiz canônica (realpath)
  idleTimeoutMs: number; // tempo máximo de conexão ociosa
}

// Arquivos até esse tamanho vão num único write (cabeçalho + corpo juntos -> menos pacotes).
// Maiores são enviados em stream, sem carregar tudo na memória.
const SMALL_FILE_BYTES = 64 * 1024;

let nextConnectionId = 1;

export function handleConnection(socket: net.Socket, config: ServerConfig): void {
  const id = nextConnectionId++;
  const client = `${(socket.remoteAddress ?? '?').replace(/^::ffff:/, '')}:${socket.remotePort}`;
  const tag = `#${id} ${client}`;

  let buffer = Buffer.alloc(0); // bytes recebidos e ainda não consumidos pelo parser
  let busy = false; // processando uma requisição (respostas precisam sair em ordem)
  let closing = false; // já decidimos fechar: ignorar novas requisições
  let peerEnded = false; // cliente fechou o lado de envio dele (FIN)
  let requests = 0;

  log(tag, 'conexão aberta');

  // Envia cada write na hora, sem esperar o ACK do anterior (desliga o algoritmo de Nagle).
  // Sem isso, Nagle + ACK atrasado do cliente pode segurar a resposta por até ~200 ms.
  socket.setNoDelay(true);

  // Timeout de ociosidade: sem bytes chegando/saindo por idleTimeoutMs -> fecha
  socket.setTimeout(config.idleTimeoutMs);
  socket.on('timeout', () => {
    if (busy) return; // está enviando um arquivo para cliente lento: não é ociosidade
    log(tag, `ociosa por ${config.idleTimeoutMs / 1000}s, fechando`);
    closing = true;
    socket.end(); // envia FIN
  });

  // recv(): cada 'data' é um pedaço arbitrário do fluxo TCP
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    void processBuffer();
  });
  socket.on('end', () => {
    peerEnded = true;
    void processBuffer(); // responde o que já chegou e depois fecha
  });
  socket.on('error', (err) => log(tag, `erro: ${err.message}`));
  socket.on('close', () => log(tag, `conexão fechada (${requests} requisições)`));

  // Extrai e responde todas as requisições completas do buffer, uma de cada vez.
  async function processBuffer(): Promise<void> {
    if (busy) return; // a chamada em andamento vai ver os bytes novos no próximo loop
    busy = true;
    try {
      while (!closing && !socket.destroyed) {
        const result = parseRequest(buffer);
        if (result.status === 'incomplete') break; // esperar mais bytes

        if (result.status === 'error') {
          requests++;
          sendError(400, false, false, {}, result.reason);
          log(tag, `requisição malformada -> 400 (${result.reason})`);
          closing = true; // fluxo pode estar dessincronizado: melhor fechar
          socket.end();
          break;
        }

        // remove a requisição do buffer; o que sobrar é o começo da próxima
        buffer = buffer.subarray(result.consumed);
        requests++;
        const keepAlive = await respond(result.request);
        if (!keepAlive) {
          closing = true;
          socket.end(); // envia o que falta e depois FIN
        }
      }
      if (peerEnded && !closing) {
        closing = true;
        socket.end();
      }
    } finally {
      busy = false;
    }
  }

  // Responde uma requisição. Retorna true se a conexão deve continuar aberta.
  async function respond(req: HttpRequest): Promise<boolean> {
    const keepAlive = wantsKeepAlive(req);
    const isHead = req.method === 'HEAD';
    let status: number;
    let bodySize = 0;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      status = 405;
      bodySize = sendError(405, keepAlive, false, { Allow: 'GET, HEAD' });
    } else {
      const file = await resolveFile(config.root, req.path);
      if (file.kind === 'forbidden') {
        status = 403;
        bodySize = sendError(403, keepAlive, isHead, {}, 'Caminho fora do diretório raiz.');
      } else if (file.kind === 'notfound') {
        status = 404;
        bodySize = sendError(404, keepAlive, isHead, {}, `Arquivo não encontrado: ${req.path}`);
      } else {
        status = 200;
        bodySize = file.size;
        const head = buildHead(200, {
          'Content-Type': contentType(file.fullPath),
          'Content-Length': file.size, // HEAD também informa o tamanho que o corpo teria
          Connection: keepAlive ? 'keep-alive' : 'close',
        });
        if (isHead) socket.write(head);
        else if (file.size <= SMALL_FILE_BYTES) {
          const body = await fs.promises.readFile(file.fullPath);
          socket.write(Buffer.concat([head, body.subarray(0, file.size)]));
        } else {
          socket.write(head);
          await streamFile(file.fullPath, file.size);
        }
      }
    }

    log(tag, `${req.method} ${req.target} ${req.version} -> ${status} (${bodySize} B, ${keepAlive ? 'keep-alive' : 'close'})`);
    return keepAlive;
  }

  // Envia resposta de erro com corpo HTML. Retorna o tamanho do corpo.
  function sendError(status: number, keepAlive: boolean, isHead: boolean, extra: Record<string, string>, detail = ''): number {
    const body = errorPage(status, detail);
    const head = buildHead(status, {
      ...extra,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': body.length,
      Connection: keepAlive ? 'keep-alive' : 'close',
    });
    socket.write(isHead ? head : Buffer.concat([head, body]));
    return body.length;
  }

  // Envia um arquivo grande aos poucos. pipe() respeita o ritmo do cliente (backpressure)
  // e o event loop continua livre para atender outras conexões.
  function streamFile(fullPath: string, size: number): Promise<void> {
    return new Promise((resolve) => {
      // end: size-1 garante que nunca enviamos mais bytes do que o Content-Length anunciou
      const stream = fs.createReadStream(fullPath, { start: 0, end: size - 1 });
      const onClose = () => {
        stream.destroy(); // cliente foi embora no meio do envio
        resolve();
      };
      socket.once('close', onClose);
      stream.on('end', () => {
        socket.off('close', onClose);
        resolve();
      });
      stream.on('error', (err) => {
        log(tag, `erro lendo arquivo: ${err.message}`);
        socket.destroy(); // cabeçalho já foi: não dá para trocar por um erro
      });
      stream.pipe(socket, { end: false }); // end:false -> não fecha o socket ao terminar
    });
  }
}

// HTTP/1.1: persistente por padrão, a menos que o cliente mande "Connection: close".
// HTTP/1.0: fecha por padrão, a menos que o cliente mande "Connection: keep-alive".
function wantsKeepAlive(req: HttpRequest): boolean {
  const tokens = (req.headers.get('connection') ?? '').toLowerCase().split(',').map((t) => t.trim());
  if (tokens.includes('close')) return false;
  if (req.version === 'HTTP/1.0') return tokens.includes('keep-alive');
  return true;
}
