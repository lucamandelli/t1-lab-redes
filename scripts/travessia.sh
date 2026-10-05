#!/usr/bin/env bash
# Tentativas de travessia de diretório. Todas devem dar 403 (ou 404 no caso do duplo encoding,
# que mostra que o servidor decodifica só uma vez e procura um arquivo literal "%2e%2e").
# --path-as-is impede o curl de "limpar" os ../ antes de enviar.
# Uso: scripts/travessia.sh [host] [porta]
HOST=${1:-localhost}
PORT=${2:-8080}
BASE="http://$HOST:$PORT"

try() {
  printf '%-48s -> ' "GET $1"
  curl -s -o /dev/null --path-as-is -w "%{http_code} $2\n" "$BASE$1"
}

try "/../../etc/passwd"
try "/../../Windows/System32/drivers/etc/hosts"
try "/%2e%2e/%2e%2e/etc/passwd"
try "/..%2f..%2f..%2fetc%2fpasswd"
try "/%2E%2E%2F%2E%2E%2Fetc%2Fpasswd"
try "/..%5c..%5cWindows%5cwin.ini"
try "/imagens/../../../etc/passwd"
try "/%252e%252e/%252e%252e/etc/passwd" "(duplo encoding: 404 esperado)"
