# Trabalho 1 — Servidor HTTP/1.1 sobre sockets TCP

Servidor HTTP/1.1 em TypeScript (Node.js) usando sockets TCP (módulo `net`).
O parsing e a geração das mensagens HTTP são feitos pelo grupo.

## Compilar e executar

Requer Node.js 18+.

```bash
npm install
npm run build
node dist/main.js --port 8080 --root ./www
```

## Argumentos

| Argumento | Descrição |
|---|---|
| `--port <n>` | Porta TCP de escuta (usar acima de 1024) |
| `--root <dir>` | Diretório raiz a ser servido |

O servidor escuta em `0.0.0.0`. A página de teste fica em `http://<ip>:<porta>/`.

## Estrutura

- `src/main.ts`: argumentos e socket de escuta
- `src/connection.ts`: atende uma conexão (buffer, respostas, conexão persistente, timeout)
- `src/parser.ts`: parsing da requisição
- `src/response.ts`: cabeçalhos da resposta e Content-Type
- `www/`: site de teste
- `capturas/`: capturas do Wireshark
