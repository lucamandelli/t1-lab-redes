#!/usr/bin/env bash
# Cenário C1: 10 requisições, cada uma em uma conexão TCP nova (Connection: close).
# Rodar com o Wireshark capturando (filtro: tcp.port == <porta>) e salvar como capturas/c1.pcapng.
# Uso: scripts/c1.sh <host> [porta] [recurso]
HOST=${1:?informe o IP do servidor}
PORT=${2:-8080}
URL="http://$HOST:$PORT${3:-/index.html}"

echo "C1: 10x $URL com Connection: close"
time (
  for i in $(seq 1 10); do
    curl -s -o /dev/null -H "Connection: close" \
      -w "req $i: %{http_code}, conexões novas: %{num_connects}, tempo: %{time_total}s\n" "$URL"
  done
)
