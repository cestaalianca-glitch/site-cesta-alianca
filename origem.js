/* Origem do tráfego (Bloco 12): guarda no localStorage os parâmetros utm_source, utm_medium, utm_campaign e utm_content (primeiro toque, vale 30 dias)
   e o código do padrinho VIP (?ref=CODIGO). O cadastro envia tudo junto, e o HQ mostra o funil por origem. Nada sensível é guardado. */
(function () {
  var CHAVES = ["utm_source", "utm_medium", "utm_campaign", "utm_content"], VALIDO = /^[A-Za-z0-9 _.+%:-]{1,60}$/, REF = /^[A-Za-z0-9_-]{1,24}$/, TRINTA_DIAS = 30 * 864e5;
  function ler() { try { return JSON.parse(localStorage.getItem("aliancaOrigem") || "null") || {}; } catch (e) { return {}; } }
  function gravar(o) { try { localStorage.setItem("aliancaOrigem", JSON.stringify(o)); } catch (e) { /* armazenamento bloqueado */ } }
  try {
    var p = new URLSearchParams(window.location.search), o = ler(), novo = {};
    CHAVES.forEach(function (n) { var v = (p.get(n) || "").trim(); if (VALIDO.test(v)) novo[n] = v; });
    var velho = o.primeiraVisita && Date.now() - Date.parse(o.primeiraVisita) > TRINTA_DIAS;
    if (Object.keys(novo).length && (!o.utm || velho)) { o = { utm: novo, primeiraVisita: new Date().toISOString(), landing: window.location.pathname.slice(0, 80) }; gravar(o); }
    var ref = (p.get("ref") || "").trim(); if (REF.test(ref)) { try { localStorage.setItem("aliancaRef", ref); } catch (e) { /* sem armazenamento */ } }
    if (p.get("renovacao") === "1" && REF.test(ref)) { try { localStorage.setItem("aliancaRenovacao", String(Date.now())); } catch (e) { /* sem armazenamento */ } }   // link de renovação (vale 7 dias, só com ?ref=)
  } catch (e) { /* sem URLSearchParams */ }
  /* o que vai junto no cadastro */
  window.aliancaOrigem = function () {
    var o = ler(), r = {}; CHAVES.forEach(function (n) { if (o.utm && o.utm[n]) r[n] = o.utm[n]; }); if (o.landing) r.landing = o.landing; return r;
  };
})();
