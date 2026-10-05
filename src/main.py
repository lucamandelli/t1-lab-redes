# Uso: python src/main.py --port 8080 --root ./www
#
# Concorrência: uma thread por conexão. A thread principal só faz accept(); cada
# conexão aceita ganha sua própria thread, que fica esperando no recv() dela sem
# atrapalhar as outras. Uma requisição lenta não bloqueia as demais.
import argparse
import os
import socket
import threading

from connection import handle_connection


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--root', required=True)
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        print('uso: python src/main.py --port <porta> --root <diretório>')
        return

    # socket() + bind() + listen()
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', args.port))  # 0.0.0.0 = todas as interfaces, para outras máquinas acessarem
    server.listen()
    # O accept() desiste a cada 1 s para o Ctrl+C conseguir parar o servidor
    # (no Windows o Ctrl+C não interrompe um accept() bloqueado)
    server.settimeout(1)
    print(f'servidor em 0.0.0.0:{args.port}, raiz {root}')

    try:
        while True:
            try:
                conn, addr = server.accept()
            except socket.timeout:
                continue
            # Cada conexão aceita é atendida em uma thread própria
            threading.Thread(target=handle_connection, args=(conn, addr, root), daemon=True).start()
    except KeyboardInterrupt:
        pass
    finally:
        server.close()


main()
