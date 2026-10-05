# Trabalho 1 — Servidor HTTP/1.1 sobre sockets TCP

Servidor HTTP/1.1 em Python usando sockets TCP diretamente (módulo `socket`).
O parsing e a geração das mensagens HTTP são feitos pelo grupo. Nenhuma biblioteca HTTP é usada.

## O que precisa

- Python 3 (testado no 3.9). Não precisa instalar nenhuma biblioteca.
- Para conferir se o Python existe na máquina, abra o terminal e rode `python --version`
  (no Mac/Linux pode ser `python3 --version`).

## Como iniciar

1. Abra um terminal na pasta do projeto (a pasta onde está este README).
2. Rode:

   ```bash
   python src/main.py --port 8080 --root ./www
   ```

   (no Mac/Linux, use `python3` no lugar de `python`)
3. Deve aparecer `servidor em 0.0.0.0:8080, raiz ...`. Pronto, o servidor está no ar.
4. Para parar o servidor, aperte `Ctrl+C` no terminal.

Se aparecer um aviso do Firewall do Windows, clique em **Permitir acesso**; sem isso as outras máquinas não conseguem acessar.

### Argumentos

| Argumento | O que é |
|---|---|
| `--port <n>` | Porta onde o servidor escuta. Use um número acima de 1024 (ex: 8080). |
| `--root <pasta>` | Pasta com os arquivos que o servidor vai entregar (ex: `./www`). |

O servidor escuta em `0.0.0.0` (todas as interfaces de rede), então outras máquinas conseguem acessar.

## Como usar

1. Descubra o IP da máquina onde o servidor está rodando: no Windows, `ipconfig` (campo "Endereço IPv4").
2. Em qualquer máquina da rede, abra o navegador em `http://<IP>:8080/`.
   Vai aparecer a página de teste com duas imagens, CSS e JavaScript.
3. Cada requisição atendida aparece no terminal do servidor, com hora, IP:porta do cliente, método e código:

   ```
   2026-10-04T22:38:11.589429 192.168.0.108:60601 GET -> 200
   ```

### Exemplos com curl

No PowerShell, escreva `curl.exe` (e não só `curl`). No cmd e no Mac/Linux, `curl` funciona.
Troque `<IP>` pelo IP do servidor.

| Código | Comando | O que acontece |
|---|---|---|
| 200 | `curl -i http://<IP>:8080/texto.txt` | Arquivo encontrado |
| 200 (HEAD) | `curl -I http://<IP>:8080/imagem.png` | Só as linhas de cabeçalho, sem corpo |
| 400 | `curl -i -X "GET X" http://<IP>:8080/` | Linha de requisição com 4 partes (malformada) |
| 403 | `curl -i --path-as-is http://<IP>:8080/../../Windows/System32/drivers/etc/hosts` | Tentativa de sair da pasta raiz |
| 404 | `curl -i http://<IP>:8080/nao-existe.html` | Arquivo não existe |
| 405 | `curl -i -X POST http://<IP>:8080/` | Método não suportado (vem `Allow: GET, HEAD`) |

Atenção: no 403 use `--path-as-is`. Sem ele, o próprio curl apaga os `../` antes de enviar e a tentativa nem chega ao servidor.

## Estrutura

- `src/main.py`: lê os argumentos, cria o socket de escuta (socket, bind, listen, accept) e abre uma thread por conexão
- `src/connection.py`: atende uma conexão (buffer de bytes, respostas, conexão persistente, timeout de 5 s, proteção contra travessia)
- `src/request_parser.py`: parsing da requisição (linha de requisição, cabeçalhos, percent-encoding)
- `src/response.py`: monta a linha de status e os cabeçalhos (Date, Server, Content-Type)
- `www/`: site de teste (inclui a página do teste de interoperabilidade)
- `capturas/`: capturas do Wireshark (`.pcapng`)

---

## Passo a passo para o grupo cumprir 100% do enunciado

### 1. Antes de tudo

1. Trocar o identificador do grupo em `src/response.py`, na linha `SERVER_ID = 'TrabRedes-GrupoX/1.0'`.
2. Na VDI, confirmar que o Python roda sem admin: `python --version` e depois iniciar o servidor.
3. Verificação inicial do enunciado: rodar `ipconfig` em cada máquina, `ping <ip>` de uma para a outra
   e confirmar que o Wireshark captura na interface de rede. Se não houver comunicação, avisar o professor.
4. Todos os integrantes devem ler e entender os 4 arquivos de `src/` (a apresentação vale 25% e cada um
   precisa saber explicar qualquer parte).

### 2. Evidências da Parte 1 (para o relatório)

Sempre com o servidor numa máquina e os comandos rodando em **outra** máquina.

1. **Tabela de conformidade:** rodar os 6 comandos da tabela "Exemplos com curl" e copiar a resposta de cada um.
2. **Segurança (3 tentativas de travessia, uma com percent-encoding):**

   ```bash
   curl -i --path-as-is http://<IP>:8080/../../Windows/System32/drivers/etc/hosts
   ```

   ```bash
   curl -i http://<IP>:8080/%2e%2e/%2e%2e/Windows/win.ini
   ```

   ```bash
   curl -i http://<IP>:8080/..%2f..%2f..%2fWindows%2fwin.ini
   ```

   Todas devem responder `403 Forbidden`. Copiar requisição e resposta no relatório.
3. **Captura de uma transação completa:** abrir o Wireshark na máquina do servidor com o filtro
   `tcp.port == 8080`, fazer `curl http://<IP>:8080/` da outra máquina, e no relatório marcar:
   o handshake (SYN, SYN-ACK, ACK), o pacote com o `GET`, os pacotes da resposta e o encerramento (FIN).
4. **Atendimento simultâneo:** duas máquinas rodando ao mesmo tempo, por exemplo:

   ```bash
   curl "http://<IP>:8080/texto.txt?[1-50]"
   ```

   Tirar print do terminal do servidor mostrando linhas dos dois IPs
   intercaladas no mesmo horário (ou captura do Wireshark com as duas conexões ao mesmo tempo).

### 3. Medições da Parte 2

1. **RTT:** da máquina cliente, `ping -n 20 <IP>` e anotar a média.
2. **C1 (uma conexão por requisição):** iniciar a captura no Wireshark (`tcp.port == 8080`), rodar:

   ```bash
   curl -H "Connection: close" "http://<IP>:8080/texto.txt?[1-10]"
   ```

   Parar a captura e salvar como `capturas/c1.pcapng`.
3. **C2 (uma conexão para as 10 requisições):** nova captura, rodar:

   ```bash
   curl "http://<IP>:8080/texto.txt?[1-10]"
   ```

   Parar e salvar como `capturas/c2.pcapng`.

   O `?[1-10]` faz o curl pedir o mesmo arquivo 10 vezes em sequência. Em C1 o servidor fecha a conexão
   depois de cada resposta, então o curl abre 10 conexões. Em C2 ele reaproveita uma só.
4. **Extrair as 4 métricas de cada captura:**
   - Handshakes TCP: filtro `tcp.flags.syn == 1 && tcp.flags.ack == 0` e contar os pacotes (cada SYN inicial = 1 handshake).
   - Total de pacotes, bytes e tempo total: menu **Statistics > Capture File Properties** (ou **Statistics > Conversations**, aba TCP).
5. Calcular a economia percentual de pacotes e de bytes de C2 em relação a C1.

### 4. Relatório (PDF, poucas páginas)

Cobrir os 10 itens do enunciado:

1. Arquitetura: estrutura dos 4 arquivos e a concorrência (thread por conexão; justificar: simples, cada
   conexão espera no próprio `recv()` sem travar as outras).
2. Tabela de conformidade (passo 2.1).
3. Demonstração de segurança (passo 2.2).
4. Captura de uma transação completa (passo 2.3).
5. Evidência de atendimento simultâneo (passo 2.4).
6. RTT medido (passo 3.1).
7. Tabela C1 vs C2 com as 4 métricas e a economia percentual.
8. Overhead de conexão em C1: quantos pacotes e bytes são só de abrir (SYN, SYN-ACK, ACK) e fechar (FIN/ACK) as 10 conexões.
9. Análise em função do RTT: cada conexão nova em C1 gasta pelo menos 1 RTT a mais só no handshake;
   comparar a diferença de tempo C1 − C2 com 9 × RTT (ou 10 × RTT).
10. Conclusão: com RTT maior (rede mais distante/lenta) ou com mais requisições por página, a conexão persistente ganha ainda mais.

### 5. Teste de interoperabilidade (em aula)

1. Iniciar o servidor e passar `http://<IP>:8080/` para o outro grupo abrir no navegador.
2. Abrir no nosso navegador o endereço do servidor do outro grupo.
3. Sucesso = página aparece com as duas imagens, o CSS (título azul) e a frase "JavaScript carregado.".

### 6. Entrega (.zip, um integrante só)

- `src/`, `README.md`, `www/`, `capturas/c1.pcapng`, `capturas/c2.pcapng` e o relatório em PDF.
- Não incluir pastas `__pycache__/` nem arquivos temporários.

---

## Checklist

### Implementação (testado localmente, inclusive pelo IP de rede da máquina)

- [x] Argumentos `--port` e `--root`
- [x] Escuta em `0.0.0.0`
- [x] Sockets TCP direto (socket, bind, listen, accept, recv, send), sem biblioteca HTTP
- [x] Parser acumula bytes até a linha em branco e guarda o que sobra para a próxima requisição
      (testado com requisição enviada byte a byte e com duas requisições no mesmo envio)
- [x] Percent-encoding decodificado no caminho (`%20` → espaço)
- [x] GET e HEAD (HEAD com os mesmos cabeçalhos do GET e Content-Length do corpo, sem corpo)
- [x] 405 com `Allow: GET, HEAD` para outros métodos
- [x] Códigos 200, 400, 403, 404, 405
- [x] Content-Length correto em todas as respostas (inclusive erros e HEAD)
- [x] Content-Type para .html, .css, .js, .json, .txt, .png, .jpg, .pdf e `application/octet-stream` para o resto
- [x] Date no formato IMF-fixdate em GMT
- [x] Cabeçalho Server
- [x] 403 para travessia de diretório (testado com `../`, `%2e%2e`, `%2f` e outras variações)
- [x] Concorrência: thread por conexão (testado: uma conexão parada não trava as outras; 10 clientes ao mesmo tempo)
- [x] Conexão persistente por padrão; `Connection: close` responde com o mesmo cabeçalho e fecha
- [x] Timeout de 5 s para conexão ociosa
- [x] Várias requisições em sequência na mesma conexão
- [x] Página de interoperabilidade (`www/index.html` com imagens, CSS e JS) renderiza no navegador
- [x] Comandos de C1 e C2 conferidos (C1 abre 10 conexões, C2 abre 1)

### Falta o grupo fazer

- [ ] Trocar `SERVER_ID` em `src/response.py` pelo nome do grupo
- [ ] Testar na VDI (Python disponível sem admin)
- [ ] Verificação inicial: ipconfig, ping entre as máquinas, Wireshark capturando
- [ ] Testes entre duas máquinas diferentes (tudo acima foi testado só numa máquina)
- [ ] Teste com duas máquinas acessando ao mesmo tempo (print/captura)
- [ ] Captura de uma transação completa feita de outra máquina
- [ ] RTT medido com ping
- [ ] `capturas/c1.pcapng` e `capturas/c2.pcapng`
- [ ] Tabela C1 vs C2 e análises (itens 7 a 10 do relatório)
- [ ] Relatório em PDF
- [ ] Teste de interoperabilidade com outro grupo (em aula)
- [ ] Todos os integrantes estudarem o código para a apresentação
- [ ] Montar o .zip e entregar
