/* Lógica do simulador de montagem de cestas. Não calcula preços —
   só ajuda a montar a lista de itens que vai para o WhatsApp. */

const NUMERO_WHATSAPP = "5543999937211";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx2gIS7AuQv4qSn-0D8FtHNMS1jlMKVNDQ2MLbb2J3vKqgm7hXk_bhXWG-mMtpvDqJD/exec";

let carrinho = {}; // { id: quantidade }

function buscarItem(id) {
  return CATALOGO_ITENS.find((item) => item.id === id);
}

function pontosDoCarrinho() {
  return Object.entries(carrinho).reduce((total, [id, qtd]) => {
    const item = buscarItem(id);
    return total + (item ? item.pontos * qtd : 0);
  }, 0);
}

function pontosDaCesta(lista) {
  return lista.reduce((total, entrada) => {
    const item = buscarItem(entrada.id);
    return total + (item ? item.pontos * entrada.quantidade : 0);
  }, 0);
}

function adicionarItem(id, quantidade = 1) {
  carrinho[id] = (carrinho[id] || 0) + quantidade;
  if (carrinho[id] <= 0) delete carrinho[id];
  renderizarCarrinho();
}

function definirQuantidade(id, quantidade) {
  if (quantidade <= 0) {
    delete carrinho[id];
  } else {
    carrinho[id] = quantidade;
  }
  renderizarCarrinho();
}

function carregarCestaBase(lista) {
  carrinho = {};
  lista.forEach((entrada) => {
    carrinho[entrada.id] = entrada.quantidade;
  });
  renderizarCarrinho();
}

function limparCarrinho() {
  carrinho = {};
  renderizarCarrinho();
}

function montarListaCategorias() {
  const categorias = {};
  CATALOGO_ITENS.forEach((item) => {
    if (!categorias[item.categoria]) categorias[item.categoria] = [];
    categorias[item.categoria].push(item);
  });
  return categorias;
}

function renderizarCatalogo() {
  const container = document.getElementById("catalogo-itens");
  if (!container) return;
  const categorias = montarListaCategorias();
  container.innerHTML = "";

  Object.entries(categorias).forEach(([categoria, itens]) => {
    const bloco = document.createElement("div");
    bloco.className = "catalogo-categoria";

    const titulo = document.createElement("h3");
    titulo.textContent = categoria;
    bloco.appendChild(titulo);

    itens.forEach((item) => {
      const linha = document.createElement("div");
      linha.className = "catalogo-item";
      linha.innerHTML = `
        <span class="catalogo-item-nome">${item.nome}</span>
        <div class="catalogo-item-controles">
          <button type="button" class="btn-qtd" onclick="adicionarItem('${item.id}', -1)">-</button>
          <span class="catalogo-item-qtd" id="qtd-${item.id}">${carrinho[item.id] || 0}</span>
          <button type="button" class="btn-qtd" onclick="adicionarItem('${item.id}', 1)">+</button>
        </div>
      `;
      bloco.appendChild(linha);
    });

    container.appendChild(bloco);
  });
}

function renderizarCarrinho() {
  const listaEl = document.getElementById("resumo-lista");
  const pontosEl = document.getElementById("resumo-pontos");
  const comparativoEl = document.getElementById("resumo-comparativo");

  CATALOGO_ITENS.forEach((item) => {
    const el = document.getElementById(`qtd-${item.id}`);
    if (el) el.textContent = carrinho[item.id] || 0;
  });

  if (listaEl) {
    const entradas = Object.entries(carrinho).filter(([, qtd]) => qtd > 0);
    if (entradas.length === 0) {
      listaEl.innerHTML = '<li class="resumo-vazio">Nenhum item selecionado ainda.</li>';
    } else {
      listaEl.innerHTML = entradas
        .map(([id, qtd]) => {
          const item = buscarItem(id);
          return `<li>${qtd}x ${item.nome}</li>`;
        })
        .join("");
    }
  }

  const totalPontos = pontosDoCarrinho();
  if (pontosEl) pontosEl.textContent = totalPontos;

  if (comparativoEl) {
    const pontosPadrao = pontosDaCesta(CESTA_PADRAO);
    const pontosGrande = pontosDaCesta(CESTA_GRANDE);
    let referencia = "abaixo da Cesta Padrão";
    if (totalPontos >= pontosGrande) referencia = "no nível da Cesta Grande ou acima";
    else if (totalPontos >= pontosPadrao) referencia = "entre a Cesta Padrão e a Cesta Grande";
    comparativoEl.textContent = `Nível estimado: ${referencia}.`;
  }
}

function sincronizarItensComPainel(entradas) {
  const dadosCliente = sessionStorage.getItem("clienteCestaPersonalizada");
  if (!dadosCliente) return;

  let cliente;
  try {
    cliente = JSON.parse(dadosCliente);
  } catch (erro) {
    return;
  }
  if (!cliente.cpf) return;

  const itensTexto = entradas
    .map(([id, qtd]) => {
      const item = buscarItem(id);
      return `${qtd}x ${item.nome}`;
    })
    .join(" | ");

  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      acao: "itensPersonalizados",
      cpf: cliente.cpf,
      itensPersonalizados: itensTexto,
    }),
  }).catch(() => {});
}

function gerarMensagemWhatsapp() {
  const entradas = Object.entries(carrinho).filter(([, qtd]) => qtd > 0);
  if (entradas.length === 0) {
    alert("Adicione ao menos um item antes de enviar.");
    return;
  }

  const linhas = entradas.map(([id, qtd]) => {
    const item = buscarItem(id);
    return `- ${qtd}x ${item.nome}`;
  });

  const mensagem =
    "Olá! Gostaria de fazer um pedido de cesta personalizada com os seguintes itens:\n\n" +
    linhas.join("\n") +
    "\n\nAguardo a confirmação de valores e disponibilidade. Obrigado!";

  sincronizarItensComPainel(entradas);

  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
}

function verificarAcessoCadastro() {
  const modal = document.getElementById("modal-gate-cadastro");
  if (!modal) return;

  const veioDoCadastro = sessionStorage.getItem("clienteCestaPersonalizada");
  if (veioDoCadastro) return;

  modal.hidden = false;
  document.getElementById("btn-gate-sim").addEventListener("click", () => {
    modal.hidden = true;
  });
  document.getElementById("btn-gate-nao").addEventListener("click", () => {
    window.location.href = "cadastro.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  verificarAcessoCadastro();
  renderizarCatalogo();
  renderizarCarrinho();

  const btnZero = document.getElementById("btn-modo-zero");
  const btnPadrao = document.getElementById("btn-modo-padrao");
  const btnGrande = document.getElementById("btn-modo-grande");
  const btnLimpar = document.getElementById("btn-limpar");
  const btnEnviar = document.getElementById("btn-enviar-whatsapp");

  if (btnZero) btnZero.addEventListener("click", limparCarrinho);
  if (btnPadrao) btnPadrao.addEventListener("click", () => carregarCestaBase(CESTA_PADRAO));
  if (btnGrande) btnGrande.addEventListener("click", () => carregarCestaBase(CESTA_GRANDE));
  if (btnLimpar) btnLimpar.addEventListener("click", limparCarrinho);
  if (btnEnviar) btnEnviar.addEventListener("click", gerarMensagemWhatsapp);
});
