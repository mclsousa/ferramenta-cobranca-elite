
import { AppConfig } from './types';

export const DEFAULT_TEMPLATE_NORMAL = `{saudacao}, *{nome}*.
----------------------------------------
Sua assinatura {vencimento} 

para renovação, por favor, nos envie seu comprovante de pagamento.
----------------------------------------
*{titulo_tabela}:*

{tabela_precos}

*Chave PIX para renovar:* 
{pix}`;

export const DEFAULT_TEMPLATE_EXPIRED = `{saudacao}, *{nome}*.
----------------------------------------
Sua assinatura {vencimento}. 

Notamos que seu pagamento está pendente. Para continuar utilizando nossos serviços sem interrupção, por favor, regularize sua situação enviando o comprovante.
----------------------------------------
*{titulo_tabela}:*

{tabela_precos}

*Chave PIX para renovar:* 
{pix}`;

export const DEFAULT_TEMPLATE_RECEIPT = `✅ *COMPROVANTE DE RENOVAÇÃO*
----------------------------------------
CLIENTE: *{nome}*
VENCIMENTO: *{data_vencimento}*
STATUS: *ATIVO*
----------------------------------------
Obrigado pela preferência! 
Seu acesso está liberado. 😃👍`;

export const DEFAULT_CONFIG: AppConfig = {
  pixKey: 'tec.br@hotmail.com',
  defaultTime: '20:00', // Default business rule time
  antiBanMode: false, // Default off
  priceLineFormat: '{nome} - R$ {valor}', // Default format
  plansTitle: 'TABELA DE PLANOS', // Default title
  plans: [
    { id: 'p1', label: '1 Mês', price: 35 },
    { id: 'p2', label: '2 Meses', price: 70 },
    { id: 'p3', label: '3 Meses', price: 105 },
    { id: 'p4', label: '4 Meses', price: 140 },
    { id: 'p5', label: '5 Meses', price: 175 },
    { id: 'p6', label: '6 Meses', price: 210 },
  ],
  planGroups: [
    {
        id: 'default',
        label: '1 Tela (Padrão)',
        plans: [
            { id: 'p1', label: '1 Mês', price: 35 },
            { id: 'p3', label: '3 Meses', price: 105 },
            { id: 'p6', label: '6 Meses', price: 210 },
        ]
    },
    {
        id: '2screens',
        label: '2 Telas',
        plans: [
            { id: '2t_p1', label: '1 Mês (2 Telas)', price: 60 },
            { id: '2t_p3', label: '3 Meses (2 Telas)', price: 180 },
        ]
    },
    {
        id: '3screens',
        label: '3 Telas',
        plans: [
            { id: '3t_p1', label: '1 Mês (3 Telas)', price: 85 },
            { id: '3t_p3', label: '3 Meses (3 Telas)', price: 250 },
        ]
    }
  ],
  quickLinks: [
    { id: 'l1', label: 'App Android', url: 'https://bit.ly/exemplo-app' },
    { id: 'l2', label: 'App iOS', url: 'https://bit.ly/exemplo-ios' },
    { id: 'l3', label: 'Tutorial de Instalação', url: 'https://youtube.com/...' },
  ],
  templates: {
    normal: DEFAULT_TEMPLATE_NORMAL,
    expired: DEFAULT_TEMPLATE_EXPIRED,
    receipt: DEFAULT_TEMPLATE_RECEIPT,
    additional: [
      {
        id: 'friendly',
        label: 'Amigável',
        content: `Oi *{nome}*, tudo bem? 😊\n\nPassando só pra lembrar que sua assinatura vence em *{vencimento}*.\n\nQuando puder, me envia o comprovante pra gente renovar? Qualquer dúvida estou à disposição!\n\nPix: {pix}`
      },
      {
        id: 'strict',
        label: 'Aviso Formal',
        content: `Prezado(a) *{nome}*,\n\nConsta em nosso sistema que sua assinatura expirou em *{vencimento}*.\n\nPara evitar o cancelamento definitivo e perda das configurações, solicitamos a regularização imediata.\n\nAguardo seu retorno.`
      }
    ]
  },
  tags: [
    { id: 'vip', label: 'VIP', color: '#FFD700' }, // Gold
    { id: 'reseller', label: 'Revenda', color: '#3182CE' }, // Blue
    { id: 'family', label: 'Família', color: '#38A169' }, // Green
    { id: 'problem', label: 'Problemático', color: '#E53E3E' }, // Red
    { id: '2screens', label: '2 Telas', color: '#805AD5' }, // Purple
  ]
};
