// Envia bytes crus para o servidor e mostra a resposta. Útil para requisições
// que o curl não consegue gerar (ex: cabeçalho sem ':') e no Windows, que não tem nc.
//
// Uso: node dist/scripts/raw.js <host> <porta> "<requisição>"
//   \r e \n no texto viram CR e LF. Ex:
//   node dist/scripts/raw.js 192.168.0.10 8080 "GET / HTTP/1.1\r\nHost: x\r\nSemDoisPontos\r\n\r\n"
import * as net from 'node:net';

const [host, port, text] = process.argv.slice(2);
if (!host || !port || text === undefined) {
  console.error('uso: node dist/scripts/raw.js <host> <porta> "<requisição com \\r\\n>"');
  process.exit(1);
}

const request = text.replace(/\\r/g, '\r').replace(/\\n/g, '\n');
console.log('>>> enviado:\n' + JSON.stringify(request) + '\n\n<<< recebido:');

const socket = net.connect(Number(port), host, () => socket.write(request));
socket.setTimeout(2000, () => {
  console.log('\n[2s sem dados, encerrando]');
  socket.destroy();
});
socket.on('data', (d) => process.stdout.write(d));
socket.on('end', () => console.log('\n[servidor fechou a conexão]'));
socket.on('error', (e) => console.error(`erro: ${e.message}`));
