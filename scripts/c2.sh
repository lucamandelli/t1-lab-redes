#!/usr/bin/env bash
# Cenário C2: as mesmas 10 requisições em UMA conexão persistente.
# Um único curl com 10 URLs reaproveita a conexão (só a 1ª mostra "conexões novas: 1").
# Rodar com o Wireshark capturando e salvar como capturas/c2.pcapng.
# Uso: scripts/c2.sh <host> [porta] [recurso]
HOST=${1:?informe o IP do servidor}
PORT=${2:-8080}
URL="http://$HOST:$PORT${3:-/index.html}"

ARGS=()
for i in $(seq 1 10); do ARGS+=(-o /dev/null "$URL"); done

echo "C2: 10x $URL na mesma conexão"
time curl -s -w "req: %{http_code}, conexões novas: %{num_connects}, tempo: %{time_total}s\n" "${ARGS[@]}"
