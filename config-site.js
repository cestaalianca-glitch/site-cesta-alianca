/* Configuração do cadastro rápido (Bloco 11).
   WEBHOOK_URL: endereço HTTPS do servidor (VPS). Fica vazio até o domínio estar apontado e o HTTPS ativo
   (ecossistema/webhook-nginx/ativar-dominio.sh). Enquanto estiver vazio, o cadastro segue só para a planilha, como antes.
   SITE_TOKEN: identifica o site para o servidor. É PÚBLICO por natureza (qualquer um vê no código da página); a proteção real
   está no servidor (origem permitida, limite por IP/CPF e validação rígida). */
window.ALIANCA = {
  WEBHOOK_URL: "https://grupoalianca.cloud/webhook/novo-cadastro",
  SITE_TOKEN: "246fed139ff0d300dd6881e8eb55748bf474dd60755bf09b"
};
