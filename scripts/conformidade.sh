#!/usr/bin/env bash
# Uma requisição para cada código de status obrigatório (tabela de conformidade do relatório).
# Uso: scripts/conformidade.sh [host] [porta]
HOST=${1:-localhost}
PORT=${2:-8080}
BASE="http://$HOST:$PORT"
cd "$(dirname "$0")/.." || exit 1

show() { echo; echo "================ $1"; echo "\$ ${*:2}"; "${@:2}"; echo; }

show "200 OK (GET)"          curl -s -i "$BASE/index.html" -o /dev/null -D -
show "200 OK (HEAD)"         curl -s -I "$BASE/index.html"
show "200 OK (percent-encoding %20)" curl -s -i "$BASE/pasta%20com%20espaco/leia-me.txt"
show "200 OK (extensão desconhecida)" curl -s -I "$BASE/arquivo.xyz"
show "400 (request-target sem /)"  curl -s -i --request-target "sem-barra" "$BASE/"
show "400 (HTTP/1.1 sem Host)"     curl -s -i -H "Host:" "$BASE/"
show "400 (cabeçalho sem ':')"     node dist/scripts/raw.js "$HOST" "$PORT" 'GET / HTTP/1.1\r\nHost: x\r\nCabecalhoSemDoisPontos\r\n\r\n'
show "403 Forbidden"         curl -s -i --path-as-is "$BASE/../../etc/passwd"
show "404 Not Found"         curl -s -i "$BASE/nao-existe.html"
show "405 (POST)"            curl -s -i -X POST -d "x=1" "$BASE/index.html"
show "405 (DELETE)"          curl -s -i -X DELETE "$BASE/index.html"
