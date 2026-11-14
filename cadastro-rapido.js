/* Cadastro rápido em 2 etapas (Bloco 11).
   Etapa 1: nome, WhatsApp e CEP (rua, bairro e cidade preenchidos pelo ViaCEP/BrasilAPI) — o lead parcial é salvo mesmo que a pessoa pare aqui.
   Etapa 2: dados REAIS do crediário (nenhum valor é estimado) — o servidor roda a análise de crédito na hora.
   O link VIP (?ref=CODIGO) é guardado e enviado junto como padrinho. A planilha (Apps Script) continua recebendo o cadastro, como antes. */

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx2gIS7AuQv4qSn-0D8FtHNMS1jlMKVNDQ2MLbb2J3vKqgm7hXk_bhXWG-mMtpvDqJD/exec";
const NUMERO_WHATSAPP = "5543999937211";
const CFG = window.ALIANCA || {};
const WEBHOOK_URL = CFG.WEBHOOK_URL || "";

/* Cidades com rota ativa (mesma lista que o servidor usa; o servidor é quem decide de verdade). */
const CIDADES_ATENDIDAS = ["londrina", "cambe", "rolandia", "jaguapita", "ibipora", "apucarana", "arapongas", "bela vista do paraiso", "sertanopolis", "florestopolis", "alvorada do sul", "primeiro de maio", "porecatu", "marilandia do sul", "tamarana", "sao martinho", "jataizinho", "prado ferreira", "centenario do sul", "guaravera", "guaraci", "bentopolis", "california"];
const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const cidadeAtendida = (c) => CIDADES_ATENDIDAS.includes(semAcento(c));

/* ---------- ?ref= (link VIP) ---------- */
function capturarRef() {
  let ref = "";
  try { ref = new URLSearchParams(window.location.search).get("ref") || ""; } catch (e) { /* sem URLSearchParams */ }
  ref = ref.trim();
  if (!/^[A-Za-z0-9_-]{1,24}$/.test(ref)) ref = "";
  try {
    if (ref) localStorage.setItem("aliancaRef", ref);
    else ref = localStorage.getItem("aliancaRef") || "";
  } catch (e) { /* armazenamento bloqueado */ }
  return /^[A-Za-z0-9_-]{1,24}$/.test(ref) ? ref : "";
}
const REF = capturarRef();

/* ---------- utilidades ---------- */
function novoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "lead-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
const LEAD_ID = novoId();
function origemTrafego() { try { return typeof window.aliancaOrigem === "function" ? window.aliancaOrigem() : {}; } catch (e) { return {}; } }
const digitos = (v) => String(v || "").replace(/\D/g, "");
function validarCPF(cpf) {
  const d = digitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += parseInt(d[i], 10) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === parseInt(d[9], 10) && dv(10) === parseInt(d[10], 10);
}
const mascaraCPF = (v) => digitos(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const mascaraCEP = (v) => digitos(v).slice(0, 8).replace(/(\d{5})(\d{1,3})$/, "$1-$2");
function mascaraTelefone(v) {
  let d = digitos(v);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}
function mascaraMoeda(v) {
  let d = digitos(v).replace(/^0+(?=\d)/, "");
  if (!d) return "";
  d = d.padStart(3, "0");
  return "R$ " + d.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d.slice(-2);
}
function valorMoeda(v) {
  const d = digitos(v);
  return d ? parseInt(d, 10) / 100 : null;
}
function mascarar(input, fn) { if (input) input.addEventListener("input", () => { input.value = fn(input.value); }); }
function erro(id, msg) { const e = document.getElementById(id); if (e) { e.textContent = msg || ""; e.classList.toggle("mostrar", !!msg); } }
const el = (id) => document.getElementById(id);

async function pedir(url, ms) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms || 6000);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error("http " + r.status); return await r.json(); } finally { clearTimeout(t); }
}
/* CEP → rua, bairro, cidade (ViaCEP; se falhar, BrasilAPI) */
async function buscarCEP(cep) {
  try {
    const j = await pedir("https://viacep.com.br/ws/" + cep + "/json/");
    if (j && !j.erro) return { rua: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", uf: j.uf || "PR" };
  } catch (e) { /* tenta a BrasilAPI */ }
  try {
    const j = await pedir("https://brasilapi.com.br/api/cep/v2/" + cep);
    if (j && j.city) return { rua: j.street || "", bairro: j.neighborhood || "", cidade: j.city || "", uf: j.state || "PR" };
  } catch (e) { /* sem resposta */ }
  return null;
}

/* ---------- envio ---------- */
async function enviarWebhook(corpo, esperar) {
  if (!WEBHOOK_URL) return { ok: false, semUrl: true };
  const c = new AbortController(); const t = setTimeout(() => c.abort(), esperar || 8000);
  try {
    const r = await fetch(WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Site-Token": CFG.SITE_TOKEN || "" }, body: JSON.stringify(corpo), signal: c.signal, keepalive: true });
    return { ok: r.ok, cod: r.status };
  } catch (e) { return { ok: false, erro: String(e && e.message) }; } finally { clearTimeout(t); }
}
/* a planilha antiga continua recebendo (mesmos nomes de campo do cadastro completo) */
function paraPlanilha(d) {
  const trabalho = { inss: "Benefício/Aposentadoria", clt: "Registrado (CLT)", autonomo: "Diarista/Informal" }[d.vinculo];
  const anos = d.tempoMoradiaMeses / 12;
  const obs = ["Cadastro rápido (2 etapas).", "Cesta " + (d.cesta === "padrao" ? "Padrão R$ 530 (2x R$ 265)" : "Grande R$ 640 (2x R$ 320)") + ", 30 e 60 dias.",
    "Renda comprovada: " + (d.rendaComprovada ? "sim" : "não") + ". Água+luz: " + d.aguaLuz.toFixed(2) + ". Filhos/dependentes: " + d.filhos + (d.filhos > 0 ? " (gasto " + d.gastoFilhos.toFixed(2) + ")" : "") + ".", REF ? "Link VIP, padrinho código " + REF + "." : ""].filter(Boolean).join(" ");
  return { nome: d.nome, cpf: mascaraCPF(d.cpf), rg: "", nascimento: d.nascimento || "", estadoCivil: "", pai: "", mae: "", endereco: d.rua, numero: d.numero, complemento: d.complemento, cep: mascaraCEP(d.cep), bairro: d.bairro, cidade: d.cidade, estado: d.uf || "PR",
    situacaoMoradia: d.pagaAluguel ? "Alugada" : "Própria", valorAluguel: d.pagaAluguel ? mascaraMoeda(String(Math.round(d.aluguelValor * 100))) : "", tempoMoradia: anos < 1 ? "Menos de 1 ano" : anos < 3 ? "1 a 3 anos" : anos < 5 ? "3 a 5 anos" : "Mais de 5 anos",
    situacaoTrabalho: trabalho, nomeEmpresa: "", cargoClt: d.vinculo === "clt" ? d.profissao : "", dataAdmissao: "", enderecoEmpresa: "", telefoneEmpresa: "", tipoBeneficio: "", ocupacaoDiarista: d.vinculo === "autonomo" ? d.profissao : "", frequenciaPagamento: "", ocupacaoConjuge: "",
    renda: mascaraMoeda(String(Math.round(d.renda * 100))), pessoasCasa: "", pessoasComRenda: "", possuiVeiculo: "", celular1: mascaraTelefone(d.whatsapp), celular2: "", telefone1: "", telefone2: "", cesta: d.cesta === "padrao" ? "Padrão" : "Grande",
    pagamento: "A prazo (promissória 30/60 dias)", horario: "", comoConheceu: REF ? "Indicação" : "Site", quemIndicou: REF, observacoes: obs, possivelClienteOpy: "" };
}
async function enviarPlanilha(d) {
  try { await fetch(GOOGLE_SCRIPT_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(paraPlanilha(d)) }); return true; } catch (e) { return false; }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = el("form-rapido"); if (!form) return;
  const status = el("cadastro-status");
  /* ?cesta=padrao|grande (vem dos botões do site) já deixa a cesta marcada */
  try { const c = new URLSearchParams(window.location.search).get("cesta"); const r = c && form.querySelector('input[name="cesta"][value="' + (c === "padrao" ? "padrao" : c === "grande" ? "grande" : "") + '"]'); if (r) r.checked = true; } catch (e) { /* sem parâmetro */ }
  mascarar(form.whatsapp, mascaraTelefone); mascarar(form.cep, mascaraCEP); mascarar(form.cpf, mascaraCPF);
  ["renda", "aluguelValor", "aguaLuz", "gastoFilhos"].forEach((n) => mascarar(form[n], mascaraMoeda));

  function irParaEtapa(n) {
    el("etapa-1").hidden = n !== 1; el("etapa-2").hidden = n !== 2;
    el("barra-1").classList.toggle("ativo", n === 1); el("barra-2").classList.toggle("ativo", n === 2); el("barra-1").classList.toggle("feito", n === 2);
    if (n === 1) el("barra-1").setAttribute("aria-current", "step"); else el("barra-1").removeAttribute("aria-current");
    if (n === 2) el("barra-2").setAttribute("aria-current", "step"); else el("barra-2").removeAttribute("aria-current");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* CEP automático */
  let ultimoCep = "";
  async function aoDigitarCEP() {
    const cep = digitos(form.cep.value); erro("erro-cep", "");
    if (cep.length !== 8 || cep === ultimoCep) return; ultimoCep = cep;
    el("ajuda-cep").textContent = "Buscando o endereço…";
    const r = await buscarCEP(cep);
    el("cep-resultado").hidden = false;
    if (r) {
      form.rua.value = r.rua; form.bairro.value = r.bairro; form.cidade.value = r.cidade; form.uf.value = r.uf;
      el("ajuda-cep").textContent = "Confira o endereço abaixo. Se faltar algo, pode completar.";
    } else {
      el("ajuda-cep").textContent = "Não achamos esse CEP. Preencha a rua, o bairro e a cidade abaixo.";
    }
    avisoRegiao();
  }
  function avisoRegiao() {
    const aviso = el("aviso-regiao"), cidade = form.cidade.value.trim();
    if (!cidade) { aviso.hidden = true; return null; }
    const ok = cidadeAtendida(cidade);
    aviso.hidden = false; aviso.className = "aviso-regiao " + (ok ? "ok" : "fora");
    aviso.innerHTML = ok ? "✓ Atendemos a sua região (" + cidade.replace(/</g, "") + ")!" :
      "Ainda não temos rota ativa em " + cidade.replace(/</g, "") + ". Fale com a gente no <a href=\"https://wa.me/" + NUMERO_WHATSAPP + "\" target=\"_blank\" rel=\"noopener\">WhatsApp</a> — talvez a gente atenda a sua região.";
    return ok;
  }
  form.cep.addEventListener("input", aoDigitarCEP);
  form.cidade.addEventListener("input", avisoRegiao);

  function corpoEtapa1() {
    return { etapa: 1, leadId: LEAD_ID, nome: form.nome.value.trim(), whatsapp: digitos(form.whatsapp.value), cep: digitos(form.cep.value), rua: form.rua.value.trim(), bairro: form.bairro.value.trim(), cidade: form.cidade.value.trim(), uf: form.uf.value || "PR", ref: REF, origem: "site", ...origemTrafego() };
  }
  /* salva o lead parcial assim que a etapa 1 estiver completa (mesmo que a pessoa não clique em Continuar) */
  let parcialEnviado = false;
  async function salvarParcial() {
    const c = corpoEtapa1(); const tel = c.whatsapp.length === 11 && c.whatsapp.startsWith("55") ? c.whatsapp.slice(2) : c.whatsapp;
    if (parcialEnviado || c.nome.length < 3 || tel.length < 10 || c.cep.length !== 8 || !c.cidade) return;
    parcialEnviado = true; await enviarWebhook(c, 6000);
  }
  ["blur", "change"].forEach((ev) => { form.cidade.addEventListener(ev, salvarParcial); form.nome.addEventListener(ev, salvarParcial); form.whatsapp.addEventListener(ev, salvarParcial); });

  el("btn-continuar").addEventListener("click", async () => {
    if (form.informacao_extra.value.trim() !== "") return;
    let ok = true, primeiro = null; const falha = (campo, id, msg) => { if (id) erro(id, msg); ok = false; primeiro = primeiro || campo; campo.classList.add("campo-invalido"); };
    [form.nome, form.whatsapp, form.cep, form.rua, form.bairro, form.cidade].forEach((c) => c.classList.remove("campo-invalido"));
    if (form.nome.value.trim().length < 3) falha(form.nome);
    let tel = digitos(form.whatsapp.value); if (tel.length > 11 && tel.startsWith("55")) tel = tel.slice(2);
    if (tel.length < 10 || tel.length > 11) falha(form.whatsapp, "erro-whatsapp", "WhatsApp inválido. Digite DDD + número."); else erro("erro-whatsapp", "");
    if (digitos(form.cep.value).length !== 8) falha(form.cep, "erro-cep", "CEP incompleto. Digite os 8 números."); else erro("erro-cep", "");
    if (!el("cep-resultado").hidden) { if (!form.rua.value.trim()) falha(form.rua); if (!form.bairro.value.trim()) falha(form.bairro); if (!form.cidade.value.trim()) falha(form.cidade); }
    else { await aoDigitarCEP(); if (el("cep-resultado").hidden) falha(form.cep, "erro-cep", "Confira o CEP."); }
    if (!ok) { if (primeiro) { primeiro.scrollIntoView({ behavior: "smooth", block: "center" }); primeiro.focus(); } return; }
    const botao = el("btn-continuar"); botao.disabled = true; botao.textContent = "Salvando…";
    parcialEnviado = true; await enviarWebhook(corpoEtapa1(), 6000);   // o lead fica salvo mesmo se parar aqui
    botao.disabled = false; botao.textContent = "Continuar";
    if (avisoRegiao() === false) { return; }   // sem rota ativa: o lead está salvo e o aviso mostra o WhatsApp
    irParaEtapa(2);
  });
  el("btn-voltar").addEventListener("click", () => irParaEtapa(1));

  /* campos condicionais da etapa 2 */
  document.querySelectorAll('input[name="moradia"]').forEach((r) => r.addEventListener("change", () => {
    const alugada = form.moradia.value === "alugada"; el("campo-aluguel").hidden = !alugada; form.aluguelValor.required = alugada; if (!alugada) form.aluguelValor.value = "";
  }));
  form.filhos.addEventListener("input", () => {
    const n = parseInt(form.filhos.value, 10) || 0; el("campo-gasto-filhos").hidden = n <= 0; form.gastoFilhos.required = n > 0; if (n <= 0) form.gastoFilhos.value = "";
  });
  form.querySelectorAll('input[name="vinculo"]').forEach((r) => r.addEventListener("change", () => {
    el("campo-registro").hidden = form.vinculo.value !== "clt"; form.registroMeses.required = form.vinculo.value === "clt"; if (form.vinculo.value !== "clt") form.registroMeses.value = "";
    if (!form.profissao.value) form.profissao.placeholder = r.value === "inss" ? "Ex.: aposentada, pensionista" : r.value === "clt" ? "Ex.: auxiliar de limpeza, caixa" : "Ex.: pedreiro, diarista, motorista de aplicativo";
  }));
  form.cpf.addEventListener("input", () => erro("erro-cpf", ""));

  /* envio final (etapa 2) */
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (form.informacao_extra.value.trim() !== "") return;
    let ok = form.checkValidity(); let primeiro = null;
    if (!validarCPF(form.cpf.value)) { erro("erro-cpf", "CPF inválido. Confira os números."); ok = false; primeiro = form.cpf; }
    const renda = valorMoeda(form.renda.value), aguaLuz = valorMoeda(form.aguaLuz.value), filhos = parseInt(form.filhos.value, 10);
    const alugada = form.moradia.value === "alugada", aluguel = alugada ? valorMoeda(form.aluguelValor.value) : 0, gasto = filhos > 0 ? valorMoeda(form.gastoFilhos.value) : 0;
    if (!(renda > 0)) { ok = false; primeiro = primeiro || form.renda; }
    if (aguaLuz === null) { ok = false; primeiro = primeiro || form.aguaLuz; }
    if (alugada && !(aluguel > 0)) { ok = false; primeiro = primeiro || form.aluguelValor; }
    if (!(filhos >= 0)) { ok = false; primeiro = primeiro || form.filhos; }
    if (filhos > 0 && gasto === null) { ok = false; primeiro = primeiro || form.gastoFilhos; }
    const tv = parseInt(form.tempoMoradia.value, 10), meses = form.tempoUnidade.value === "anos" ? tv * 12 : tv;
    if (!(tv >= 0)) { ok = false; primeiro = primeiro || form.tempoMoradia; }
    if (form.vinculo.value === "clt" && !(parseInt(form.registroMeses.value, 10) >= 0)) { ok = false; primeiro = primeiro || form.registroMeses; }
    if (!ok) { if (primeiro) { primeiro.scrollIntoView({ behavior: "smooth", block: "center" }); primeiro.focus(); } form.reportValidity(); return; }

    const d = { etapa: 2, leadId: LEAD_ID, nome: form.nome.value.trim(), whatsapp: digitos(form.whatsapp.value).replace(/^55(?=\d{10,11}$)/, ""), cep: digitos(form.cep.value), rua: form.rua.value.trim(), bairro: form.bairro.value.trim(), cidade: form.cidade.value.trim(), uf: form.uf.value || "PR",
      numero: form.numero.value.trim(), complemento: form.complemento.value.trim(), cpf: digitos(form.cpf.value), nascimento: form.nascimento.value, cesta: form.cesta.value, vinculo: form.vinculo.value, profissao: form.profissao.value.trim(),
      renda: renda, rendaComprovada: form.rendaComprovada.checked, pagaAluguel: alugada, aluguelValor: aluguel, aguaLuz: aguaLuz, filhos: filhos, gastoFilhos: gasto || 0, tempoMoradiaMeses: meses, registroMeses: form.vinculo.value === "clt" ? parseInt(form.registroMeses.value, 10) : null, ref: REF, origem: "site", ...origemTrafego() };
    const botao = el("btn-enviar"); botao.disabled = true; botao.textContent = "Enviando…"; status.className = "cadastro-status";
    const [web, planilha] = await Promise.all([enviarWebhook(d, 9000), enviarPlanilha(d)]);
    botao.disabled = false; botao.textContent = "Enviar Cadastro";
    if (web.ok || planilha) {
      el("modal-sucesso-texto").textContent = web.ok ? "Você vai receber uma mensagem da gente no WhatsApp para enviar a foto dos comprovantes." : "Entraremos em contato em breve pelo WhatsApp.";
      el("modal-sucesso").hidden = false; el("btn-fechar-modal").focus();
      el("btn-fechar-modal").onclick = () => { el("modal-sucesso").hidden = true; window.location.href = "index.html"; };
    } else {
      const msg = "Olá! Quero fazer meu cadastro:\nNome: " + d.nome + "\nCPF: " + mascaraCPF(d.cpf) + "\nEndereço: " + d.rua + ", " + d.numero + " - " + d.bairro + ", " + d.cidade + "\nCesta: " + (d.cesta === "padrao" ? "Padrão R$ 530 (2x R$ 265)" : "Grande R$ 640 (2x R$ 320)");
      status.className = "cadastro-status status-erro";
      status.innerHTML = "Não conseguimos enviar agora. <a class=\"btn btn-whatsapp\" href=\"https://wa.me/" + NUMERO_WHATSAPP + "?text=" + encodeURIComponent(msg) + "\" target=\"_blank\" rel=\"noopener\">Enviar pelo WhatsApp</a>";
    }
  });
});
