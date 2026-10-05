# Trabalho 1 — Servidor HTTP/1.1 sobre sockets TCP

Servidor HTTP/1.1 em Python usando sockets TCP diretamente (módulo `socket`).
O parsing e a geração das mensagens HTTP são feitos pelo grupo. Nenhuma biblioteca HTTP é usada.

## O que precisa

- Python 3 (testado no 3.9 no Mac e no 3.14 no Windows). Não precisa instalar nenhuma biblioteca.
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
No Mac, veja também [Problemas comuns](#problemas-comuns) (permissão de Rede Local).

### Argumentos

| Argumento | O que é |
|---|---|
| `--port <n>` | Porta onde o servidor escuta. Use um número acima de 1024 (ex: 8080). |
| `--root <pasta>` | Pasta com os arquivos que o servidor vai entregar (ex: `./www`). |

O servidor escuta em `0.0.0.0` (todas as interfaces de rede), então outras máquinas conseguem acessar.

## Como usar

1. Descubra o IP da máquina onde o servidor está rodando: no Windows, `ipconfig` (campo "Endereço IPv4");
   no Mac, `ipconfig getifaddr en0` (Wi-Fi).
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

Atenção: no 403 use `--path-as-is`. Sem ele, o próprio curl apaga os `../` (e, dependendo da versão, também os `%2e%2e`) antes de enviar e a tentativa nem chega ao servidor.

## Estrutura

- `src/main.py`: lê os argumentos, cria o socket de escuta (socket, bind, listen, accept) e abre uma thread por conexão
- `src/connection.py`: atende uma conexão (buffer de bytes, respostas, conexão persistente, timeout de 5 s, proteção contra travessia)
- `src/request_parser.py`: parsing da requisição (linha de requisição, cabeçalhos, percent-encoding)
- `src/response.py`: monta a linha de status e os cabeçalhos (Date, Server, Content-Type)
- `www/`: site de teste (inclui a página do teste de interoperabilidade)
- `capturas/`: capturas do Wireshark (`.pcapng`)

## Problemas comuns

Teste rápido do cliente, antes de culpar o servidor: `curl.exe -v --max-time 10 http://<IP>:8080/`.

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `Failed to connect` / timeout | IP digitado errado (ex: `192.0.108` no lugar de `192.168.0.108`) | Conferir o IP; com `curl -v` a linha `Trying ...` mostra o endereço usado |
| `Connection refused` | Servidor não está rodando, ou está em outra porta | Conferir o terminal do servidor e o `--port` |
| Conexão TCP abre, mas o HTTP fica carregando para sempre (Mac como servidor) | macOS 15+: o app de terminal não tem permissão de **Rede Local** | Ajustes do Sistema → Privacidade e Segurança → Rede Local → ativar o terminal usado (Terminal, Ghostty, VS Code...) e reabrir o terminal |
| Timeout com o servidor no Windows | Firewall do Windows bloqueando o Python | Permitir o Python em rede privada |

Para testar só a porta, sem HTTP: no Windows `Test-NetConnection <IP> -Port 8080` (vale a linha
`TcpTestSucceeded`; o aviso de ping falho pode ser ignorado); no Mac/Linux `nc -vz <IP> 8080`.

---

## Passo a passo para o grupo cumprir 100% do enunciado

### 1. Antes de tudo

1. ~~Trocar o identificador do grupo~~ (feito: `SERVER_ID = 'TrabRedes-Grupo9/1.0'` em `src/response.py`).
2. Na VDI, confirmar que o Python roda sem admin: `python --version` e depois iniciar o servidor.
3. ~~Verificação inicial do enunciado~~ (feita entre Mac e Windows na rede de casa; repetir na VDI se for usá-la):
   rodar `ipconfig` em cada máquina, `ping <ip>` de uma para a outra
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
   curl -i --path-as-is http://<IP>:8080/%2e%2e/%2e%2e/Windows/win.ini
   ```

   ```bash
   curl -i http://<IP>:8080/..%2f..%2f..%2fWindows%2fwin.ini
   ```

   Todas devem responder `403 Forbidden`. Copiar requisição e resposta no relatório.
   O `--path-as-is` é obrigatório na primeira e recomendado na segunda: sem ele o curl apaga os `../` e, em algumas versões (ex: 8.19 no Windows), também os `%2e%2e` antes de enviar (manda só `GET /Windows/win.ini`, que dá 404). Na terceira não precisa, porque o curl não mexe no `%2f`. Use `curl -v` para conferir na linha `> GET` o que realmente foi enviado.
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

### Implementação (testado localmente e entre duas máquinas: servidor no Mac, cliente no Windows)

- [x] Argumentos `--port` e `--root`
- [x] Escuta em `0.0.0.0`
- [x] Sockets TCP direto (socket, bind, listen, accept, recv, send), sem biblioteca HTTP
- [x] Parser acumula bytes até a linha em branco e guarda o que sobra para a próxima requisição
      (testado com requisição enviada byte a byte, com duas requisições no mesmo envio e com uma requisição
      seguida da metade da próxima)
- [x] Corpo da requisição (ex: POST com `Content-Length`) consumido junto, para não virar a próxima requisição
- [x] 400 também para versão fora do formato `HTTP/x.y`
- [x] Percent-encoding decodificado no caminho (`%20` → espaço)
- [x] GET e HEAD (HEAD com os mesmos cabeçalhos do GET e Content-Length do corpo, sem corpo)
- [x] 405 com `Allow: GET, HEAD` para outros métodos
- [x] Códigos 200, 400, 403, 404, 405
- [x] Content-Length correto em todas as respostas (inclusive erros e HEAD)
- [x] Content-Type para .html, .css, .js, .json, .txt, .png, .jpg, .pdf e `application/octet-stream` para o resto
- [x] Date no formato IMF-fixdate em GMT
- [x] Cabeçalho Server (`TrabRedes-Grupo9/1.0`)
- [x] 403 para travessia de diretório (testado com `../`, `%2e%2e`, `%2f` e outras variações)
- [x] Concorrência: thread por conexão (testado: uma conexão parada não trava as outras; 10 clientes ao mesmo tempo)
- [x] Conexão persistente por padrão; `Connection: close` responde com o mesmo cabeçalho e fecha
- [x] Cliente HTTP/1.0 fecha por padrão (só mantém aberta com `Connection: keep-alive`)
- [x] Timeout de 5 s para conexão ociosa
- [x] Várias requisições em sequência na mesma conexão
- [x] Página de interoperabilidade (`www/index.html` com imagens, CSS e JS) renderiza no navegador,
      inclusive aberta de outra máquina (navegador e `curl.exe` no Windows, todas as respostas 200)
- [x] Log do servidor sem linhas misturadas quando várias threads respondem ao mesmo tempo
- [x] Comandos de C1 e C2 conferidos (C1 abre 10 conexões, C2 abre 1)

### Falta o grupo fazer

- [ ] Testar na VDI (Python disponível sem admin)
- [x] Verificação inicial: ipconfig, ping entre as máquinas (49/49 respostas, RTT médio ~6,5 ms), Wireshark capturando
- [x] Acesso entre duas máquinas diferentes (Mac servidor, Windows cliente)
- [x] Tabela de conformidade e testes de segurança rodados de outra máquina (passos 2.1 e 2.2; saídas em `evidencias/evidencias-windows.txt`)
- [x] Teste com duas máquinas acessando ao mesmo tempo (Windows + celular; trecho do log em `evidencias/simultaneo.log`)
- [x] Captura de uma transação completa feita de outra máquina (primeira conexão de `c1.pcapng`, filtro `tcp.stream eq 0`)
- [x] RTT medido com ping (média 39 ms, mín 1, máx 124; ver [Resultados das medições](#resultados-das-medições))
- [x] `capturas/c1.pcapng` e `capturas/c2.pcapng`
- [ ] Análises dos itens 8 a 10 no relatório (tabela C1 vs C2 já em [Resultados das medições](#resultados-das-medições))
- [ ] Relatório em PDF
- [ ] Teste de interoperabilidade com outro grupo (em aula)
- [ ] Todos os integrantes estudarem o código para a apresentação
- [ ] Montar o .zip e entregar

## Resultados das medições

Feitas em 2026-10-05: servidor no Mac (`192.168.0.108`), cliente Windows (`192.168.0.105`), Wi-Fi da mesma rede.
Saídas e logs em `evidencias/` (pasta de apoio para o relatório, não vai no .zip).

| Métrica | C1 | C2 | Economia |
|---|---|---|---|
| Handshakes TCP | 10 | 1 | |
| Pacotes | 109 | 38 | 65,1% |
| Bytes | 9207 | 4855 | 47,3% |
| Tempo total | 54,4 ms | 39,9 ms | 14,5 ms |

- **RTT pelo ping** (`ping -n 20`): média 39 ms, mín 1 ms, máx 124 ms. A variação vem da economia de energia
  do Wi-Fi: com 1 s entre pings, a placa "dorme" e o primeiro pacote demora.
- **RTT pelo handshake TCP** (campo `tcp.analysis.initial_rtt` em `c1.pcapng`): média 1,85 ms (1,51 a 2,25 ms)
  nas 10 conexões. É o valor que explica a diferença C1 − C2: 9 conexões a mais × 1,85 ms ≈ 16,7 ms,
  perto dos 14,5 ms medidos.
- O C2 foi repetido 3 vezes (39,9 / 40,9 / 41,5 ms); a primeira execução teve uma pausa de ~32 ms do
  curl entre a 5ª e a 6ª requisição e foi descartada.
