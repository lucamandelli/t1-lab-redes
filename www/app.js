// Busca dados.json e mostra na página (mais uma requisição feita pelo navegador)
const status = document.getElementById('status');
status.textContent = 'JavaScript carregou, buscando dados.json...';

fetch('/dados.json')
  .then((resposta) => resposta.json())
  .then((dados) => {
    const lista = document.getElementById('dados');
    for (const item of dados.itens) {
      const li = document.createElement('li');
      li.textContent = item;
      lista.appendChild(li);
    }
    status.textContent = 'JavaScript e JSON carregados.';
    status.className = 'ok';
  })
  .catch((erro) => {
    status.textContent = 'Falha ao carregar dados.json: ' + erro;
  });
