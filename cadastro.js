/* Envia o formulário de cadastro para a planilha Google (via Apps Script).
   Troque GOOGLE_SCRIPT_URL pela URL da implantação do Apps Script quando estiver pronta. */

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx2gIS7AuQv4qSn-0D8FtHNMS1jlMKVNDQ2MLbb2J3vKqgm7hXk_bhXWG-mMtpvDqJD/exec";
const NUMERO_WHATSAPP = "5543999937211";

function validarCPF(cpf) {
  const digitos = (cpf || "").replace(/\D/g, "");
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDigito = (fatiaTamanho) => {
    let soma = 0;
    for (let i = 0; i < fatiaTamanho; i++) {
      soma += parseInt(digitos[i], 10) * (fatiaTamanho + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return (
    calcularDigito(9) === parseInt(digitos[9], 10) &&
    calcularDigito(10) === parseInt(digitos[10], 10)
  );
}

function mascararCPF(valor) {
  return valor
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function mascararTelefone(valor) {
  let digitos = valor.replace(/\D/g, "");
  // Se a pessoa digitou o +55 (ou 0055) na frente, tira — o campo é só DDD + número.
  if (digitos.length > 11 && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }
  digitos = digitos.slice(0, 11);
  if (digitos.length <= 10) {
    return digitos.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digitos.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function mascararCEP(valor) {
  return valor.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

function mascararMoeda(valor) {
  let digitos = valor.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digitos) return "";
  digitos = digitos.padStart(3, "0");
  const centavos = digitos.slice(-2);
  const inteiros = digitos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${inteiros},${centavos}`;
}

function aplicarMascara(input, funcaoMascara) {
  if (!input) return;
  input.addEventListener("input", () => {
    input.value = funcaoMascara(input.value);
  });
}

function limparCampo(campo) {
  campo.required = false;
  if (campo.type === "radio" || campo.type === "checkbox") {
    campo.checked = false;
  } else {
    campo.value = "";
  }
}

function atualizarSituacaoMoradia(form) {
  const valor = form.situacaoMoradia.value;
  const bloco = document.getElementById("campo-valor-aluguel");
  const mostrar = valor === "Alugada";
  bloco.hidden = !mostrar;
  form.valorAluguel.required = mostrar;
  if (!mostrar) form.valorAluguel.value = "";
}

function atualizarSituacaoTrabalho(form) {
  const valor = form.situacaoTrabalho.value;
  const blocos = {
    "Registrado (CLT)": { id: "bloco-clt", obrigatorios: ["nomeEmpresa", "cargoClt"] },
    "Benefício/Aposentadoria": { id: "bloco-beneficio", obrigatorios: ["tipoBeneficio"] },
    "Diarista/Informal": { id: "bloco-diarista", obrigatorios: ["ocupacaoDiarista", "frequenciaPagamento"] },
    "Do lar": { id: "bloco-dolar", obrigatorios: ["ocupacaoConjuge"] },
  };

  Object.entries(blocos).forEach(([chave, { id, obrigatorios }]) => {
    const bloco = document.getElementById(id);
    const ativo = valor === chave;
    bloco.hidden = !ativo;
    bloco.querySelectorAll("input, select").forEach((campo) => {
      if (ativo && obrigatorios.includes(campo.name)) {
        campo.required = true;
      } else if (!ativo) {
        limparCampo(campo);
      }
    });
  });
}

function atualizarComoConheceu(form) {
  const ehIndicacao = form.comoConheceu.value === "Indicação";
  form.quemIndicou.required = ehIndicacao;
  document.querySelectorAll(".campo-indicacao-obrigatorio").forEach((span) => {
    span.hidden = !ehIndicacao;
  });
}

function mostrarErroCampo(input, erroEl, mensagem) {
  input.classList.add("campo-invalido");
  if (erroEl) {
    erroEl.textContent = mensagem;
    erroEl.classList.add("mostrar");
  }
}

function limparErroCampo(input, erroEl) {
  input.classList.remove("campo-invalido");
  if (erroEl) {
    erroEl.textContent = "";
    erroEl.classList.remove("mostrar");
  }
}

async function verificarCpfExistente(cpfDigitos) {
  const aviso = document.getElementById("aviso-cpf-existente");
  if (!aviso) return;

  if (cpfDigitos.length !== 11 || !validarCPF(cpfDigitos)) {
    aviso.classList.remove("mostrar");
    return;
  }

  try {
    const resposta = await fetch(`${GOOGLE_SCRIPT_URL}?cpf=${cpfDigitos}`);
    if (!resposta.ok) return;
    const dados = await resposta.json();
    if (dados && dados.existe) {
      aviso.textContent = `Já existe um cadastro com esse CPF (status: ${dados.status || "Pendente"}). Pode continuar enviando se for atualizar seus dados.`;
      aviso.classList.add("mostrar");
    } else {
      aviso.classList.remove("mostrar");
    }
  } catch (erro) {
    // Falha silenciosa: não bloqueia o cadastro se a checagem não puder ser feita.
  }
}

let ultimoMatchClienteOpy = null;

async function verificarClienteExistente(nome, endereco, numero) {
  const aviso = document.getElementById("aviso-cliente-existente");
  ultimoMatchClienteOpy = null;
  if (!aviso) return;

  if (!nome.trim() || !endereco.trim()) {
    aviso.classList.remove("mostrar");
    return;
  }

  try {
    const parametros = new URLSearchParams({
      acao: "cliente",
      nome: nome.trim(),
      endereco: endereco.trim(),
      numero: numero.trim(),
    });
    const resposta = await fetch(`${GOOGLE_SCRIPT_URL}?${parametros.toString()}`);
    if (!resposta.ok) return;
    const dados = await resposta.json();
    if (dados && dados.existe && dados.cliente) {
      const c = dados.cliente;
      // Aviso pro cliente é neutro de propósito — endereço antigo no Opy pode estar
      // desatualizado (pessoas mudam de casa), então não afirmamos "você já é cliente".
      // O detalhe do que bateu (nome/endereço/situação) só aparece no painel interno.
      aviso.textContent = "Confira se esse é o seu endereço atual antes de continuar.";
      aviso.classList.add("mostrar");
      ultimoMatchClienteOpy = `${c.nome} | ${c.endereco}, ${c.bairro}, ${c.cidade} | situação: ${c.situacao || "-"} | confiança: ${dados.confianca || "-"}`;
    } else {
      aviso.classList.remove("mostrar");
    }
  } catch (erro) {
    // Falha silenciosa: não bloqueia o cadastro se a checagem não puder ser feita.
  }
}

function montarMensagemWhatsapp(dados) {
  const linhas = [
    "Olá! Quero fazer meu cadastro:",
    "",
    `Nome: ${dados.nome}`,
    `CPF: ${dados.cpf}`,
    dados.rg ? `RG: ${dados.rg}` : null,
    dados.nascimento ? `Data de Nascimento: ${dados.nascimento}` : null,
    dados.estadoCivil ? `Estado Civil: ${dados.estadoCivil}` : null,
    `Endereço: ${dados.endereco}, ${dados.numero}${dados.complemento ? " - " + dados.complemento : ""}`,
    `CEP: ${dados.cep}`,
    `Bairro: ${dados.bairro}`,
    `Cidade: ${dados.cidade} - ${dados.estado}`,
    dados.situacaoMoradia ? `Situação da Moradia: ${dados.situacaoMoradia}${dados.valorAluguel ? " (aluguel: " + dados.valorAluguel + ")" : ""}` : null,
    dados.tempoMoradia ? `Tempo neste endereço: ${dados.tempoMoradia}` : null,
    dados.situacaoTrabalho ? `Situação de Trabalho: ${dados.situacaoTrabalho}` : null,
    dados.renda ? `Renda total da casa: ${dados.renda}` : null,
    `Celular 1: ${dados.celular1}`,
    dados.celular2 ? `Celular 2: ${dados.celular2}` : null,
    dados.telefone1 ? `Telefone 1: ${dados.telefone1}` : null,
    dados.telefone2 ? `Telefone 2: ${dados.telefone2}` : null,
    `Cesta desejada: ${dados.cesta}`,
    `Forma de pagamento: ${dados.pagamento}`,
    dados.horario ? `Melhor horário: ${dados.horario}` : null,
    dados.observacoes ? `Observações: ${dados.observacoes}` : null,
  ].filter(Boolean);

  return linhas.join("\n");
}

function mostrarStatus(elemento, tipo, mensagemHtml) {
  elemento.className = `cadastro-status status-${tipo}`;
  elemento.innerHTML = mensagemHtml;
}

function mostrarModalSucesso(cestaEscolhida) {
  const modal = document.getElementById("modal-sucesso");
  const texto = document.getElementById("modal-sucesso-texto");
  const botaoFechar = document.getElementById("btn-fechar-modal");
  if (!modal) return;

  const vaiMontarCesta = cestaEscolhida === "Personalizada";
  texto.textContent = vaiMontarCesta
    ? "Entraremos em contato em breve. Agora vamos te levar pra montar sua cesta do seu jeito."
    : "Entraremos em contato em breve.";
  botaoFechar.textContent = vaiMontarCesta ? "Fechar e montar minha cesta" : "Fechar";

  modal.hidden = false;

  const aoFechar = () => {
    modal.hidden = true;
    botaoFechar.removeEventListener("click", aoFechar);
    if (vaiMontarCesta) {
      window.location.href = "montar-cesta.html";
    }
  };
  botaoFechar.addEventListener("click", aoFechar);
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-cadastro");
  const statusEl = document.getElementById("cadastro-status");
  if (!form) return;

  aplicarMascara(form.cpf, mascararCPF);
  aplicarMascara(form.celular1, mascararTelefone);
  aplicarMascara(form.celular2, mascararTelefone);
  aplicarMascara(form.telefone1, mascararTelefone);
  aplicarMascara(form.telefone2, mascararTelefone);
  aplicarMascara(form.cep, mascararCEP);
  aplicarMascara(form.renda, mascararMoeda);
  aplicarMascara(form.valorAluguel, mascararMoeda);

  document.querySelectorAll('input[name="situacaoMoradia"]').forEach((radio) => {
    radio.addEventListener("change", () => atualizarSituacaoMoradia(form));
  });
  document.querySelectorAll('input[name="situacaoTrabalho"]').forEach((radio) => {
    radio.addEventListener("change", () => atualizarSituacaoTrabalho(form));
  });
  form.comoConheceu.addEventListener("change", () => atualizarComoConheceu(form));

  atualizarSituacaoMoradia(form);
  atualizarSituacaoTrabalho(form);
  atualizarComoConheceu(form);

  const erroCpf = document.getElementById("erro-cpf");
  const erroCep = document.getElementById("erro-cep");
  const erroCelular1 = document.getElementById("erro-celular1");

  form.cpf.addEventListener("input", () => limparErroCampo(form.cpf, erroCpf));
  form.cep.addEventListener("input", () => limparErroCampo(form.cep, erroCep));
  form.celular1.addEventListener("input", () => limparErroCampo(form.celular1, erroCelular1));

  form.cpf.addEventListener("blur", () => {
    const digitos = form.cpf.value.replace(/\D/g, "");
    if (digitos.length === 11) {
      verificarCpfExistente(digitos);
    }
  });

  form.numero.addEventListener("blur", () => {
    verificarClienteExistente(form.nome.value, form.endereco.value, form.numero.value);
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    // Honeypot: se o campo invisível veio preenchido, é bot — não envia nada.
    if (form.informacao_extra.value.trim() !== "") return;

    let valido = form.checkValidity();
    let primeiroInvalido = null;

    const cpfDigitos = form.cpf.value.replace(/\D/g, "");
    if (!validarCPF(cpfDigitos)) {
      mostrarErroCampo(form.cpf, erroCpf, "CPF inválido. Confira os números digitados.");
      valido = false;
      primeiroInvalido = primeiroInvalido || form.cpf;
    } else {
      limparErroCampo(form.cpf, erroCpf);
    }

    // CEP é opcional, mas se a pessoa começou a digitar, tem que ficar completo ou vazio.
    const cepDigitos = form.cep.value.replace(/\D/g, "");
    if (cepDigitos.length > 0 && cepDigitos.length !== 8) {
      mostrarErroCampo(form.cep, erroCep, "CEP incompleto. Deixe em branco se não souber, ou digite os 8 números.");
      valido = false;
      primeiroInvalido = primeiroInvalido || form.cep;
    } else {
      limparErroCampo(form.cep, erroCep);
    }

    const celular1Digitos = form.celular1.value.replace(/\D/g, "");
    if (celular1Digitos.length < 10 || celular1Digitos.length > 11) {
      mostrarErroCampo(form.celular1, erroCelular1, "Celular inválido. Digite DDD + número (10 ou 11 dígitos).");
      valido = false;
      primeiroInvalido = primeiroInvalido || form.celular1;
    } else {
      limparErroCampo(form.celular1, erroCelular1);
    }

    if (!valido) {
      if (primeiroInvalido) {
        primeiroInvalido.scrollIntoView({ behavior: "smooth", block: "center" });
        primeiroInvalido.focus();
      }
      form.reportValidity();
      return;
    }

    const dados = {
      nome: form.nome.value.trim(),
      cpf: form.cpf.value.trim(),
      rg: form.rg.value.trim(),
      nascimento: form.nascimento.value,
      estadoCivil: form.estadoCivil.value,
      pai: form.pai.value.trim(),
      mae: form.mae.value.trim(),
      endereco: form.endereco.value.trim(),
      numero: form.numero.value.trim(),
      complemento: form.complemento.value.trim(),
      cep: form.cep.value.trim(),
      bairro: form.bairro.value.trim(),
      cidade: form.cidade.value.trim(),
      estado: form.estado.value.trim().toUpperCase(),
      situacaoMoradia: form.situacaoMoradia.value,
      valorAluguel: form.valorAluguel.value.trim(),
      tempoMoradia: form.tempoMoradia.value,
      situacaoTrabalho: form.situacaoTrabalho.value,
      nomeEmpresa: form.nomeEmpresa.value.trim(),
      cargoClt: form.cargoClt.value.trim(),
      dataAdmissao: form.dataAdmissao.value,
      enderecoEmpresa: form.enderecoEmpresa.value.trim(),
      telefoneEmpresa: form.telefoneEmpresa.value.trim(),
      tipoBeneficio: form.tipoBeneficio.value,
      ocupacaoDiarista: form.ocupacaoDiarista.value.trim(),
      frequenciaPagamento: form.frequenciaPagamento.value,
      ocupacaoConjuge: form.ocupacaoConjuge.value.trim(),
      renda: form.renda.value.trim(),
      pessoasCasa: form.pessoasCasa.value.trim(),
      pessoasComRenda: form.pessoasComRenda.value.trim(),
      possuiVeiculo: form.possuiVeiculo.value,
      celular1: form.celular1.value.trim(),
      celular2: form.celular2.value.trim(),
      telefone1: form.telefone1.value.trim(),
      telefone2: form.telefone2.value.trim(),
      cesta: form.cesta.value,
      pagamento: form.pagamento.value,
      horario: form.horario.value.trim(),
      comoConheceu: form.comoConheceu.value,
      quemIndicou: form.quemIndicou.value.trim(),
      observacoes: form.observacoes.value.trim(),
      possivelClienteOpy: ultimoMatchClienteOpy || "",
    };

    const botao = form.querySelector(".btn-enviar-cadastro");
    botao.disabled = true;
    botao.textContent = "Enviando...";

    try {
      if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.startsWith("COLE_AQUI")) {
        throw new Error("Configuração pendente");
      }

      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(dados),
      });

      if (dados.cesta === "Personalizada") {
        sessionStorage.setItem(
          "clienteCestaPersonalizada",
          JSON.stringify({ nome: dados.nome, cpf: dados.cpf, celular1: dados.celular1 })
        );
      }

      mostrarModalSucesso(dados.cesta);
      form.reset();
      form.estado.value = "PR";
      document.getElementById("aviso-cpf-existente").classList.remove("mostrar");
      document.getElementById("aviso-cliente-existente").classList.remove("mostrar");
      ultimoMatchClienteOpy = null;
      atualizarSituacaoMoradia(form);
      atualizarSituacaoTrabalho(form);
      atualizarComoConheceu(form);
    } catch (erro) {
      const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(montarMensagemWhatsapp(dados))}`;
      mostrarStatus(
        statusEl,
        "erro",
        `Não conseguimos enviar seu cadastro agora.<br>
         <a class="btn btn-whatsapp" href="${url}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>`
      );
    } finally {
      botao.disabled = false;
      botao.textContent = "Enviar Cadastro";
    }
  });
});
