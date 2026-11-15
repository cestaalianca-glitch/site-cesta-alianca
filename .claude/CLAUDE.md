# site-cesta-alianca — site de vendas do cliente (repositório PÚBLICO, publicado pelo GitHub Pages)

Responder sempre em português. Este repositório é **público** e o `master` vai direto para o ar: nunca colocar dado de cliente (nome, CPF, telefone, endereço, pedido), senha, token ou chave de serviço em nenhum arquivo. Preço das cestas e telefone da própria empresa são públicos. Nunca escrever o nome do sistema de gestão interno em texto que o cliente lê.

Este manual fica em `.claude/` de propósito: na raiz ele seria publicado junto com o site.

## Para quem é o site
Cliente de baixa renda, no celular, com internet pré-paga. Toda tela precisa ser leve (sem biblioteca pesada, imagem comprimida), ter texto simples, mostrar o valor da parcela bem claro e ter um botão grande de WhatsApp. Antes de aceitar uma mudança, olhar o tamanho da versão limpa que a esteira mostra.

## Mapa: o que mora onde (abra só o arquivo da tela em que vai mexer)

| Tela ou assunto | Arquivos |
|---|---|
| Página inicial (vitrine, preços, chamadas) | `index.html`, `estilo.css`, `estilo-bloco11.css`, `menu.js` |
| Cadastro rápido em 2 etapas (CEP automático, link de indicação e de renovação) | `cadastro.html`, `cadastro-rapido.js`, `config-site.js` (endereço do servidor que recebe o cadastro) |
| Cadastro completo | `cadastro-completo.html`, `cadastro.js` |
| Monte sua cesta (simulador de trocas) | `montar-cesta.html`, `simulador.js`, `dados-itens.js` (itens e pontos de troca; ponto não é preço) |
| Origem do tráfego e código de indicação | `origem.js` (guarda `utm_*` e `?ref=`) |
| Imagens | `imagens/` |
| Esteiras e governança | `.github/workflows/esteira.yml`, `.github/workflows/saude.yml`, `.github/ci/` |

Para onde vai o cadastro: o formulário envia para o servidor da empresa (o recebimento e a análise de crédito ficam no repositório privado do ecossistema: `ecossistema/webhook-cadastro.js`, `cadastro-site.js`, `credito-alianca.js`). Mudou um campo do formulário aqui, conferir lá o nome exato do campo antes de publicar.

## Economia de tokens (vale para toda sessão)
- Não reler o repositório: o mapa acima diz o arquivo. `estilo.css` tem mais de mil linhas: procurar a regra com `grep -n` e ler só a faixa.
- Para saber o que mudou: `git log --oneline -10`, depois `git diff master...HEAD --stat` e só então o diff do arquivo que interessa.
- Uma tarefa, uma branch curta (`feat/...` ou `fix/...`) saída do `master` atualizado. Depois do merge, a limpeza semanal apaga a branch.
- Estado do repositório em um comando (branches, esteiras, site no ar): `node .github/ci/saude-repo.js`.
- Pendências e ideias não ficam em arquivo: o backlog oficial são as Issues do repositório privado do ecossistema (rótulos `Vendas` e `Público Baixa Renda`).

## Esteiras do GitHub
- **`esteira.yml`**, em todo push e todo pull request, em qualquer branch: trava da linha pública (`.github/ci/conferir-publico.js`), sintaxe de todo `.js` e de todo script embutido nas páginas (`conferir-sintaxe.js`), versão limpa (`montar-site.js`) e **prévia baixável** (artefato `previa-site-<commit>`, 14 dias).
- **Publicação**: não passa pela esteira. O GitHub Pages publica sozinho o que entra no `master`. Por isso: nunca trabalhar direto no `master`.
- **`saude.yml`**, toda segunda-feira: audita branches, esteiras e se o site está no ar; apaga as branches já incorporadas ao `master` e paradas há mais de 7 dias.
- **Ganchos locais** (ligar uma vez por computador: `node .github/ci/instalar-ganchos.js`): a mesma trava roda antes de cada commit e de cada envio.
- Exceções da trava (telefone da empresa, exemplos de preenchimento, preços): `.github/ci/permitidos.json`, cada uma com o motivo.

## Fluxo oficial para mudar o site
1. Criar uma branch `feat/...` a partir do `master` atualizado.
2. Prévia local: na pasta do repositório, `npx --yes http-server -p 8080 -c-1 .` e abrir `http://localhost:8080/`.
3. Enviar a branch: a esteira confere e guarda a prévia (aba Actions, artefato `previa-site-<commit>`). Branch criada antes de a esteira existir: botão "Run workflow" com o nome da branch no campo "ramo".
4. Abrir um pull request para o `master`. A esteira tem de passar.
5. O Gestor confere a prévia no celular e aprova. Só o merge no `master` publica.
