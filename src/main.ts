// Uso: node dist/main.js --port 8080 --root ./www
//
// Concorrência: o Node roda um event loop com I/O não bloqueante. Cada conexão só executa
// código quando chega um evento dela (bytes, timeout); enquanto uma espera a rede ou o
// disco, as outras são atendidas. Uma requisição lenta não bloqueia as demais.
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { handleConnection } from './connection';

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

const port = Number(getArg('--port'));
const rootArg = getArg('--root');
if (!port || !rootArg || !fs.existsSync(rootArg)) {
  console.error('uso: node dist/main.js --port <porta> --root <diretório>');
  process.exit(1);
}
const root = path.resolve(rootArg);

// createServer + listen = socket() + bind() + listen().
// Cada conexão aceita (accept) é entregue para handleConnection.
const server = net.createServer((socket) => handleConnection(socket, root));

// 0.0.0.0 = todas as interfaces, para outras máquinas conseguirem acessar
server.listen(port, '0.0.0.0', () => console.log(`servidor em 0.0.0.0:${port}, raiz ${root}`));
