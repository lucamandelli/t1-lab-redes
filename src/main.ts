// Ponto de entrada: lê argumentos, abre o socket de escuta e entrega cada conexão
// aceita para handleConnection.
//
// Uso: node dist/src/main.js --port 8080 --root ./www [--timeout 5]
//
// Concorrência: Node usa um único thread com event loop e I/O não bloqueante.
// Cada conexão só executa código quando chega um evento dela (bytes, fim, timeout);
// enquanto uma espera a rede ou o disco, as outras são atendidas.
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { handleConnection, ServerConfig } from './connection';
import { log } from './log';

const USAGE = 'uso: node dist/src/main.js --port <porta> --root <diretório> [--timeout <segundos>]';

function fail(message: string): never {
  console.error(`erro: ${message}\n${USAGE}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { port: number; root: string; timeout: number } {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!['--port', '--root', '--timeout'].includes(flag)) fail(`argumento desconhecido: ${flag}`);
    if (value === undefined) fail(`faltou o valor de ${flag}`);
    args[flag] = value;
  }
  if (!args['--port'] || !args['--root']) fail('--port e --root são obrigatórios');

  const port = Number(args['--port']);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('porta inválida');
  const timeout = Number(args['--timeout'] ?? '5');
  if (!(timeout > 0)) fail('timeout inválido');
  return { port, root: args['--root'], timeout };
}

function main(): void {
  const { port, root, timeout } = parseArgs(process.argv.slice(2));

  // Raiz canônica: absoluta e sem links simbólicos (base da checagem de travessia)
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(path.resolve(root));
  } catch {
    fail(`diretório raiz não existe: ${root}`);
  }
  if (!fs.statSync(realRoot).isDirectory()) fail(`não é um diretório: ${root}`);

  const config: ServerConfig = { root: realRoot, idleTimeoutMs: timeout * 1000 };

  // socket() + bind() + listen(); cada accept() dispara o callback com o socket do cliente.
  // allowHalfOpen: se o cliente fechar o envio (FIN), ainda podemos mandar a resposta.
  const server = net.createServer({ allowHalfOpen: true }, (socket) => handleConnection(socket, config));

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') fail(`porta ${port} já está em uso`);
    fail(err.message);
  });

  // 0.0.0.0 = todas as interfaces (não só loopback), para outras máquinas acessarem
  server.listen(port, '0.0.0.0', () => {
    log('servidor', `escutando em 0.0.0.0:${port}, raiz ${realRoot}, timeout ${timeout}s`);
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs ?? []) {
        if (a.family === 'IPv4' && !a.internal) log('servidor', `acesse de outra máquina: http://${a.address}:${port}/`);
      }
    }
  });
}

main();
