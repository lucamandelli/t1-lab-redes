// Testa o tratamento do FLUXO de bytes do TCP e da conexão persistente:
//   1. requisição chegando em vários pedaços (vários recv())
//   2. duas requisições coladas no mesmo pacote (pipelining)
//   3. requisição + começo da próxima no mesmo pacote, resto depois
//   4. timeout de conexão ociosa
//
// Uso: node dist/scripts/fluxo.js <host> <porta>
import * as net from 'node:net';

const host = process.argv[2] ?? '127.0.0.1';
const port = Number(process.argv[3] ?? '8080');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Abre conexão, envia os pedaços com pausas e devolve tudo que o servidor mandou até fechar.
function session(pieces: string[], pauseMs: number): Promise<{ data: string; closedAfterMs: number }> {
  return new Promise((resolve, reject) => {
    let data = '';
    let lastSent = 0;
    const socket = net.connect(port, host, async () => {
      for (const piece of pieces) {
        socket.write(piece);
        lastSent = Date.now();
        await sleep(pauseMs);
      }
    });
    socket.on('data', (d) => (data += d.toString('latin1')));
    socket.on('close', () => resolve({ data, closedAfterMs: Date.now() - lastSent }));
    socket.on('error', reject);
  });
}

// Separa as respostas usando o Content-Length de cada uma e lista "status + Connection"
// (latin1: 1 caractere = 1 byte, então o Content-Length vale como tamanho da string)
function summary(data: string): string[] {
  const result: string[] = [];
  let rest = data;
  while (rest.length > 0) {
    const end = rest.indexOf('\r\n\r\n');
    if (end === -1) break;
    const head = rest.slice(0, end);
    const length = Number(/\r\nContent-Length: (\d+)/i.exec(head)?.[1] ?? 0);
    const conn = /\r\nConnection: ([^\r]+)/i.exec(head)?.[1];
    result.push(`${head.split('\r\n')[0]} (Content-Length: ${length}, Connection: ${conn})`);
    rest = rest.slice(end + 4 + length);
  }
  return result;
}

async function run(title: string, pieces: string[], pauseMs: number, expected: number) {
  console.log(`\n== ${title}`);
  pieces.forEach((p, i) => console.log(`   pedaço ${i + 1}: ${JSON.stringify(p)}`));
  const { data } = await session(pieces, pauseMs);
  const responses = summary(data);
  responses.forEach((r) => console.log(`   <- ${r}`));
  const ok = responses.length === expected && responses.every((r) => r.includes(' 200 '));
  console.log(`   ${ok ? 'OK' : 'FALHOU'}: ${responses.length}/${expected} respostas 200`);
}

async function main() {
  const req = (path: string, close = false) =>
    `GET ${path} HTTP/1.1\r\nHost: ${host}\r\n${close ? 'Connection: close\r\n' : ''}\r\n`;

  const full = req('/index.html', true);
  await run('1. Requisição em 4 pedaços (300 ms entre eles)', [full.slice(0, 5), full.slice(5, 20), full.slice(20, 40), full.slice(40)], 300, 1);

  await run('2. Duas requisições no mesmo write (pipelining)', [req('/index.html') + req('/style.css', true)], 0, 2);

  const second = req('/texto.txt', true);
  await run('3. Requisição + começo da próxima juntas, resto depois', [req('/index.html') + second.slice(0, 12), second.slice(12)], 300, 2);

  console.log('\n== 4. Timeout de conexão ociosa');
  console.log('   envia 1 requisição sem Connection: close e espera o servidor fechar...');
  const { data, closedAfterMs } = await session([req('/index.html')], 0);
  summary(data).forEach((r) => console.log(`   <- ${r}`));
  console.log(`   servidor fechou ${(closedAfterMs / 1000).toFixed(1)}s após a requisição`);
}

main().catch((e) => {
  console.error(`erro: ${e.message}`);
  process.exit(1);
});
