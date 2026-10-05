# Trabalho 1 — Servidor HTTP/1.1 sobre sockets TCP

Servidor HTTP/1.1 em TypeScript (Node.js) construído direto sobre TCP (módulo `net`).
Nenhum módulo HTTP é usado: parsing da requisição e geração da resposta são feitos à mão.

## Requisitos

- Node.js 18 ou superior (`node -v`)
- npm (vem com o Node), só para compilar o TypeScript

## Compilar e executar

```bash
npm install          # instala só o compilador TypeScript (dependência de desenvolvimento)
npm run build        # gera dist/ a partir de src/ e scripts/
node dist/src/main.js --port 8080 --root ./www
```

Ou simplesmente `npm start` (usa porta 8080 e raiz `./www`).

### Argumentos

| Argumento | Obrigatório | Descrição |
|---|---|---|
| `--port <n>` | sim | Porta TCP de escuta (usar > 1024) |
| `--root <dir>` | sim | Diretório raiz servido |
| `--timeout <s>` | não | Timeout de conexão ociosa em segundos (padrão 5) |

O servidor escuta em `0.0.0.0` (todas as interfaces) e, ao iniciar, imprime os IPs pelos
quais outras máquinas podem acessá-lo. O nome no cabeçalho `Server` fica em `src/response.ts` (`SERVER_ID`).

## Estrutura

```
src/
  main.ts        argumentos, socket de escuta (bind/listen/accept)
  connection.ts  uma conexão: buffer, loop de requisições, keep-alive, timeout
  parser.ts      parsing da requisição sobre o fluxo de bytes
  response.ts    linha de status + cabeçalhos (Date, Server, ...) e páginas de erro
  files.ts       caminho da URL -> arquivo, com proteção contra travessia
  mime.ts        extensão -> Content-Type
  log.ts         log com horário (evidência de concorrência)
scripts/         testes manuais (curl / clientes TCP crus)
www/             site de teste (página do teste de interoperabilidade em index.html)
capturas/        arquivos .pcapng do Wireshark
```

## Funcionamento

- **Parsing**: cada conexão tem um buffer. Bytes recebidos são concatenados; quando aparece
  `\r\n\r\n` a requisição é interpretada e removida do buffer; o que sobra é o início da próxima.
- **Métodos**: GET e HEAD. Outros → `405` com `Allow: GET, HEAD`.
- **Status**: 200, 400 (request line inválida, cabeçalho sem `:`, HTTP/1.1 sem `Host`,
  percent-encoding inválido), 403 (fora da raiz), 404, 405.
- **Segurança**: o caminho é decodificado uma vez, `\` vira `/`, é resolvido contra a raiz e
  precisa continuar dentro dela (também após seguir links simbólicos). Senão → 403.
- **Concorrência**: event loop do Node com I/O não bloqueante. Nenhuma conexão bloqueia as
  outras; arquivos grandes são enviados em stream respeitando o ritmo do cliente.
- **Conexões persistentes**: HTTP/1.1 mantém a conexão aberta por padrão. `Connection: close`
  do cliente → resposta com `Connection: close` e fechamento. Conexão ociosa por 5 s → fechada.
  Várias requisições na mesma conexão (inclusive coladas no mesmo pacote) são respondidas em ordem.

## Scripts de teste

Os `.sh` rodam em macOS/Linux ou Git Bash no Windows. Os `.js` rodam em qualquer sistema com Node.

| Script | O que faz |
|---|---|
| `scripts/conformidade.sh [host] [porta]` | Um curl para cada status obrigatório (200, 400, 403, 404, 405) e HEAD |
| `scripts/travessia.sh [host] [porta]` | 8 tentativas de travessia de diretório (com e sem percent-encoding) |
| `node dist/scripts/fluxo.js <host> <porta>` | Requisição em pedaços, requisições coladas (pipelining) e timeout ocioso |
| `node dist/scripts/raw.js <host> <porta> "<texto>"` | Envia bytes crus (`\r\n` no texto vira CRLF) |
| `scripts/c1.sh <host> [porta]` | Cenário C1: 10 requisições, uma conexão nova por requisição |
| `scripts/c2.sh <host> [porta]` | Cenário C2: 10 requisições numa única conexão persistente |

### Comandos equivalentes no Windows (cmd)

No PowerShell use `curl.exe` (o `curl` lá é outro comando).

```
curl.exe -i http://IP:8080/index.html
curl.exe -I http://IP:8080/index.html
curl.exe -i --path-as-is http://IP:8080/../../Windows/System32/drivers/etc/hosts
curl.exe -i --path-as-is http://IP:8080/%2e%2e/%2e%2e/Windows/win.ini
curl.exe -i -X POST -d x=1 http://IP:8080/index.html
curl.exe -i --request-target sem-barra http://IP:8080/
node dist\scripts\raw.js IP 8080 "GET / HTTP/1.1\r\nHost: x\r\nSemDoisPontos\r\n\r\n"
```

C1 (cmd):
```
for /L %i in (1,1,10) do curl.exe -s -o NUL -H "Connection: close" -w "%{http_code} conexoes novas: %{num_connects}\n" http://IP:8080/index.html
```

C2 (um curl com 10 URLs reaproveita a conexão):
```
curl.exe -s -w "%{http_code} conexoes novas: %{num_connects}\n" -o NUL http://IP:8080/index.html -o NUL http://IP:8080/index.html -o NUL http://IP:8080/index.html -o NUL http://IP:8080/index.html -o NUL http://IP:8080/index.html -o NUL http://IP:8080/index.html -o NUL http://IP:8080/index.html -o NUL http://IP:8080/index.html -o NUL http://IP:8080/index.html -o NUL http://IP:8080/index.html
```

### Teste de atendimento simultâneo

1. Máquina A abre uma conexão e não termina a requisição (fica "lenta"):
   `node dist/scripts/raw.js IP 8080 "GET / HTTP/1.1\r\nHost: x\r\n"`
   (ou `nc IP 8080` e digitar devagar)
2. Ao mesmo tempo, máquina B: `curl -i http://IP:8080/index.html` → resposta imediata.
3. O log do servidor mostra as duas conexões abertas, com IPs diferentes e horários sobrepostos.

## Medição no Wireshark (Parte 2)

1. `ping IP` (10 vezes) e anotar o RTT médio.
2. Captura com filtro `tcp.port == 8080` na interface de rede, rodar `c1.sh`, salvar `capturas/c1.pcapng`.
3. Repetir com `c2.sh`, salvar `capturas/c2.pcapng`.
4. Métricas de cada captura:
   - **Handshakes**: filtro `tcp.flags.syn == 1 && tcp.flags.ack == 0` (um SYN por conexão).
   - **Pacotes, bytes e tempo**: `Statistics → Capture File Properties` (ou `Statistics → Conversations → TCP`).
   - **Overhead de abrir/fechar conexão**: filtro `tcp.flags.syn == 1 || tcp.flags.fin == 1` e os ACKs
     correspondentes; somar pacotes e bytes.
