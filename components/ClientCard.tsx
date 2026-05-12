
import React, { useMemo, useState, useEffect } from 'react';
import { ParsedClient, AppConfig, ResultViewMode } from '../types';
import { extractPhone, padZero, formatDate, processSpinSyntax, applyAntiBan, extractCredentials } from '../utils/helpers';
import { Copy, Phone, Edit, MessageSquare, User, CheckCircle, ChevronDown, ChevronUp, PenTool, List, FileText, Link as LinkIcon, Lock, Key, Zap, Bell, Cast } from 'lucide-react';

interface ClientCardProps {
  client: ParsedClient;
  config: AppConfig;
  isExpiredMode: boolean;
  viewMode: ResultViewMode;
  searchQuery: string;
  isSent: boolean;
  hasReminder?: boolean;
  phoneOverride?: string;
  onEdit: (client: ParsedClient) => void;
  onCopy: (text: string) => void;
  onMarkAsSent: (id: string, action: 'whatsapp' | 'copy' | 'receipt') => void;
  onOpenReceipt: (client: ParsedClient) => void;
  onLinkClient: (client: ParsedClient) => void;
  onAddReminder?: (client: ParsedClient) => void;
}

const WhatsappIcon = ({ size = 16, className }: { size?: number, className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
);


const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
};

const getAvatarColor = (name: string) => {
  const colors = [
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',
  ];
  return colors[name.charCodeAt(0) % colors.length];
};

const ClientCard: React.FC<ClientCardProps> = ({
  client, config, isExpiredMode, viewMode, searchQuery, isSent, hasReminder, phoneOverride,
  onEdit, onCopy, onMarkAsSent, onOpenReceipt, onLinkClient, onAddReminder
}) => {
  const isFocusMode = viewMode === 'focus';
  const [isCollapsed, setIsCollapsed] = useState(!isFocusMode);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('auto');
  const [selectedPlanGroupId, setSelectedPlanGroupId] = useState<string>('default');

  const { cleanText, whatsapp: extractedWhatsapp, original: originalPhone } = useMemo(() => extractPhone(client.rawNotes), [client.rawNotes]);
  const { whatsapp: overrideWhatsapp, original: overrideOriginal } = useMemo(() => phoneOverride ? extractPhone(phoneOverride) : { whatsapp: null, original: null }, [phoneOverride]);
  const whatsapp = overrideWhatsapp || extractedWhatsapp;
  const displayPhone = overrideOriginal || originalPhone;
  const hasLinkedClients = client.linked && client.linked.length > 0;
  const credentials = useMemo(() => extractCredentials(cleanText), [cleanText]);

  useEffect(() => {
      if (!config.planGroups) return;
      const totalAccounts = 1 + (client.linked?.length || 0);
      if (totalAccounts > 1) {
          const matchingGroup = config.planGroups.find(g => g.label.includes(`${totalAccounts}`));
          if (matchingGroup) setSelectedPlanGroupId(matchingGroup.id);
      } else {
          setSelectedPlanGroupId('default');
      }
  }, [client.linked, config.planGroups]);

  const activeTags = useMemo(() => {
    if (!client.tags || !config.tags) return [];
    return config.tags.filter(t => client.tags?.includes(t.id));
  }, [client.tags, config.tags]);

  const calculateCardData = () => {
    const diasSemanaPt = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const currentHour = new Date().getHours();
    let saudacao = 'Olá';
    if (currentHour < 12) saudacao = 'Bom dia';
    else if (currentHour < 18) saudacao = 'Boa tarde';
    else saudacao = 'Boa noite';

    const venc = new Date(client.dueDate);
    const vencDateOnly = new Date(venc);
    vencDateOnly.setHours(0, 0, 0, 0);

    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    const depoisDeAmanha = new Date(hoje);
    depoisDeAmanha.setDate(hoje.getDate() + 2);

    let prefixStr = '';
    let colorClass = 'border-l-emerald-500';
    let bgColor = 'bg-white dark:bg-slate-800/90';

    let activeBars = 4;
    let barColor = '#639922';

    if (isExpiredMode || vencDateOnly.getTime() < hoje.getTime()) {
      prefixStr = 'venceu';
      activeBars = 1; barColor = '#E24B4A';
    } else if (vencDateOnly.getTime() === hoje.getTime()) {
      prefixStr = 'vence hoje';
      activeBars = 1; barColor = '#E24B4A';
    } else if (vencDateOnly.getTime() === amanha.getTime()) {
      prefixStr = 'vence amanhã';
      activeBars = 2; barColor = '#EF9F27';
    } else if (vencDateOnly.getTime() === depoisDeAmanha.getTime()) {
      prefixStr = 'vence em';
      activeBars = 3; barColor = '#378ADD';
    } else {
      prefixStr = 'vence em';
      activeBars = 4; barColor = '#639922';
    }

    bgColor = 'bg-white dark:bg-slate-800/90';

    const diaSemana = diasSemanaPt[venc.getDay()];

    let timeStr = config.defaultTime || '20:00';
    if (timeStr.includes(':')) {
        const [h, m] = timeStr.split(':');
        timeStr = m === '00' ? `${h}h` : `${h}h${m}`;
    }

    const dateFormatted = isExpiredMode
      ? `${formatDate(venc)} (expirou às ${timeStr})`
      : `${formatDate(venc)} às ${timeStr}`;

    const vencimentoFinal = isExpiredMode
      ? `venceu em *[${diaSemana} - ${dateFormatted}]*`
      : `${prefixStr}, *[${diaSemana} - ${dateFormatted}]*`;

    let templateToUse = '';
    let isCustom = false;

    if (client.customMessage && client.customMessage.trim().length > 0) {
        templateToUse = client.customMessage;
        isCustom = true;
    } else if (selectedTemplateId !== 'auto') {
        const found = config.templates.additional?.find(t => t.id === selectedTemplateId);
        if (found) templateToUse = found.content;
        else templateToUse = isExpiredMode ? config.templates.expired : config.templates.normal;
    } else {
        templateToUse = isExpiredMode ? config.templates.expired : config.templates.normal;
    }

    const activeGroup = config.planGroups?.find(g => g.id === selectedPlanGroupId) || config.planGroups?.[0];
    const plansToUse = activeGroup?.plans || config.plans || [];

    const baseTitle = config.plansTitle || 'TABELA DE PLANOS';
    let tableTitle = activeGroup?.title;
    if (!tableTitle) {
        if (activeGroup && activeGroup.id !== 'default') tableTitle = `${baseTitle} (${activeGroup.label})`;
        else tableTitle = baseTitle;
    }

    const formatStr = config.priceLineFormat || '{nome} - R$ {valor}';
    const priceTableString = plansToUse.map(p => {
        return formatStr.replace(/{nome}/g, p.label).replace(/{valor}/g, String(p.price));
    }).join('\n');

    let clientNameDisplay = client.name;
    if (hasLinkedClients) {
        const linkedNames = client.linked!.map(l => l.name).join(', ');
        clientNameDisplay = `${client.name}, ${linkedNames}`;
    }

    let msg = templateToUse
        .replace(/{saudacao}/g, saudacao)
        .replace(/{nome}/g, clientNameDisplay)
        .replace(/{vencimento}/g, vencimentoFinal)
        .replace(/{pix}/g, config.pixKey)
        .replace(/{tabela_precos}/g, priceTableString)
        .replace(/{titulo_tabela}/g, tableTitle)
        .replace(/{login}/g, credentials.login || '???')
        .replace(/{senha}/g, credentials.pass || '???');

    if (!msg.includes(tableTitle)) {
        msg = msg.replace(/\*TABELA DE PLANOS(:\*)?/g, `*${tableTitle}$1`);
    }

    if (plansToUse.length > 0) msg = msg.replace(/{plano1}/g, String(plansToUse[0].price));
    if (plansToUse.length > 1) msg = msg.replace(/{plano2}/g, String(plansToUse[1].price));

    return { statusColor: colorClass, bgColor, activeBars, barColor, message: msg, statusText: `${prefixStr} (${formatDate(venc)})`, isCustomMessage: isCustom };
  };

  const { statusColor, bgColor, activeBars, barColor, message, statusText, isCustomMessage } = calculateCardData();

  const HighlightedText = ({ text, query }: { text: string, query: string }) => {
    if (!query.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-white rounded px-0.5">{part}</mark>
          ) : part
        )}
      </>
    );
  };

  const renderMessagePreview = () => {
    const parts = message.split(/(\*[^*]+\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return <strong key={idx} className="font-bold text-gray-900 dark:text-gray-100">{part.slice(1, -1)}</strong>;
      }
      return part;
    });
  };

  const handleAction = (action: 'copy' | 'whatsapp', overrideMsg?: string) => {
    onMarkAsSent(client.id, action);
    const msgToSend = overrideMsg || message;
    const processedMsg = processSpinSyntax(msgToSend);

    if (action === 'copy') {
      onCopy(processedMsg);
    } else {
      if (!whatsapp) return;
      let finalMessage = processedMsg;
      if (config.antiBanMode) finalMessage = applyAntiBan(finalMessage);
      const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(finalMessage)}`;
      window.open(url, '_blank');
    }
  };

  const containerClasses = `
    group transition-all duration-200 ease-in-out
    ${bgColor}
    shadow-sm border border-gray-200/80 dark:border-slate-700/40
    ${isSent ? 'opacity-60' : ''}
    ${viewMode === 'list'
      ? 'flex items-center p-2 rounded-lg'
      : isFocusMode
        ? 'flex flex-col rounded-2xl shadow-2xl'
        : 'flex flex-col rounded-xl overflow-hidden'
    }
  `;

  // --- LIST VIEW ---
  if (viewMode === 'list') {
    return (
      <div className={`${containerClasses} relative overflow-hidden`}>
        <div className="flex-1 min-w-0 flex items-center gap-3 px-1">
          <div className="flex-shrink-0 w-6 flex justify-center">
             {isSent ? (
               <CheckCircle className="text-emerald-600" size={16} />
             ) : (
               <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
             )}
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
             <div className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate flex items-center gap-2">
                <HighlightedText text={client.name} query={searchQuery} />
                {hasLinkedClients && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">+{client.linked?.length}</span>}
                {activeTags.map(tag => (
                    <div key={tag.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} title={tag.label} />
                ))}
             </div>
             <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{formatDate(client.dueDate)}</div>
             <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 font-mono min-w-0">
                {whatsapp ? <Phone size={12} className="text-emerald-600 flex-shrink-0" /> : <span className="w-3 flex-shrink-0"/>}
                <span className="truncate">{displayPhone || '-'}</span>
             </div>
             <div className="text-[10px] text-gray-400 truncate italic">{cleanText || 'Sem notas'}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 pl-2 border-l border-gray-100 dark:border-gray-700">
           <button
             onClick={() => handleAction('whatsapp')}
             disabled={!whatsapp}
             className={`p-1.5 rounded transition-colors ${!whatsapp ? 'text-gray-200 cursor-not-allowed' : 'hover:bg-green-50 dark:hover:bg-emerald-600/30 text-gray-400 hover:text-emerald-600'}`}
           >
             <WhatsappIcon size={14} />
           </button>
        </div>
      </div>
    );
  }

  // --- FOCUS MODE & CARD VIEW ---
  return (
    <div className={`${containerClasses} relative overflow-hidden ${isFocusMode ? 'h-full' : ''}`}>

      {/* Status badges */}
      {isSent && (
        <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 bg-emerald-600/15 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shadow-sm">
            <CheckCircle size={9} /> Enviado
          </div>
        </div>
      )}

      {/* COLLAPSED STATE — clique em qualquer área do card para expandir */}
      {isCollapsed && !isFocusMode ? (
        <div
          className="flex-1 flex items-center gap-3 px-3 py-2.5 min-h-[66px] cursor-pointer select-none"
          onClick={() => setIsCollapsed(false)}
        >
            {/* Sinal de status */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center w-8 gap-0.5">
                <Cast size={20} style={{ color: barColor }} />
                <span className="text-[8px] font-bold leading-none" style={{ color: barColor }}>
                  {activeBars === 1 ? 'vencido' : activeBars === 2 ? 'amanhã' : activeBars === 3 ? '2 dias' : 'ativo'}
                </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-gray-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap leading-tight">
                    <HighlightedText text={client.name} query={searchQuery} />
                    {hasLinkedClients && (
                        <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                            +{client.linked?.length}
                        </span>
                    )}
                    {isCustomMessage && (
                        <span className="text-[9px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                            <PenTool size={8} /> Custom
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-gray-500 dark:text-slate-400">{formatDate(client.dueDate)}</span>
                    {activeTags.map(tag => (
                        <span key={tag.id} className="text-[9px] px-1.5 py-px rounded-full text-white font-medium" style={{ backgroundColor: tag.color }}>
                            {tag.label}
                        </span>
                    ))}
                </div>

                {hasLinkedClients && (
                    <div className="text-[10px] text-blue-500 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                        <LinkIcon size={9} />
                        {client.linked!.map(l => l.name).join(', ')}
                    </div>
                )}

                {client.customNotes && (
                    <div className="mt-1">
                        <span className="inline px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-[10px] text-amber-800 dark:text-amber-300 font-medium leading-snug box-decoration-clone">
                            <HighlightedText text={client.customNotes} query={searchQuery} />
                        </span>
                    </div>
                )}

            </div>

            {/* Ações — stopPropagation para não acionar o expand do card */}
            <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                {(config.templates.additional || []).length > 0 && (
                    <div className="relative hidden sm:block" title="Alterar Modelo">
                        <select
                            value={selectedTemplateId}
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        >
                            <option value="auto">Auto</option>
                            {config.templates.additional?.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                        <div className={`p-1.5 rounded transition-colors ${selectedTemplateId !== 'auto' ? 'text-purple-500' : 'text-gray-400 dark:text-slate-400 hover:text-gray-600'}`}>
                            <List size={15} />
                        </div>
                    </div>
                )}
                <button onClick={() => onLinkClient(client)} className="hidden sm:flex p-1.5 rounded text-gray-400 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" title="Vincular">
                    <LinkIcon size={15} />
                </button>
                <button onClick={() => onOpenReceipt(client)} disabled={!whatsapp} className={`hidden sm:flex p-1.5 rounded transition-colors ${!whatsapp ? 'text-gray-200 dark:text-slate-700 cursor-not-allowed' : 'text-gray-400 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400'}`} title="Recibo">
                    <FileText size={15} />
                </button>
                <button onClick={() => onEdit(client)} className="hidden sm:flex p-1.5 rounded text-gray-400 dark:text-slate-400 hover:text-primary dark:hover:text-emerald-600 transition-colors" title="Editar">
                    <Edit size={15} />
                </button>
                {onAddReminder && (
                  <button onClick={() => onAddReminder(client)} className={`p-1.5 rounded transition-colors ${hasReminder ? 'text-violet-500 dark:text-violet-400' : 'text-gray-400 dark:text-slate-400 hover:text-violet-500 dark:hover:text-violet-400'}`} title="Lembrete">
                    <Bell size={15} />
                  </button>
                )}
                <button onClick={() => handleAction('whatsapp')} disabled={!whatsapp} className={`p-1.5 rounded transition-colors ${!whatsapp ? 'text-gray-200 dark:text-slate-700 cursor-not-allowed' : 'text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-100'}`} title="WhatsApp">
                    <WhatsappIcon size={15} />
                </button>
                <div className="p-1.5 text-gray-400 dark:text-slate-400 pointer-events-none">
                    <ChevronDown size={14} />
                </div>
            </div>
        </div>
      ) : (
        // --- EXPANDED / FOCUS STATE ---
        <>
            {/* Header clicável para recolher (apenas no modo grid, não no focus) */}
            {!isFocusMode && (
              <div
                className="flex items-center justify-between px-4 py-2.5 cursor-pointer border-b border-black/5 dark:border-white/5 select-none"
                onClick={() => setIsCollapsed(true)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Cast size={16} style={{ color: barColor }} />
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">{statusText.split('(')[0].trim()}</span>
                </div>
                <ChevronUp size={14} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
              </div>
            )}

            <div className={`flex-1 flex flex-col ${isFocusMode ? 'p-3 sm:p-10 justify-center' : 'p-4'} text-xs sm:text-sm leading-relaxed whitespace-pre-wrap relative ${isCustomMessage ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-300'}`}>

                {isFocusMode && (
                    <div className="mb-2 sm:mb-6 flex flex-col items-center justify-center text-center">
                         <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 justify-center">
                            {client.name}
                            {activeTags.map(tag => (
                                <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full text-white font-medium align-middle" style={{ backgroundColor: tag.color }}>
                                    {tag.label}
                                </span>
                            ))}
                         </h2>
                         {hasLinkedClients && (
                            <div className="text-sm text-blue-500 mt-1 flex items-center gap-1">
                                <LinkIcon size={12} />
                                {client.linked!.map(l => l.name).join(', ')}
                            </div>
                         )}
                         <p className="text-sm sm:text-lg text-gray-500">{statusText}</p>
                         <div className="font-mono text-gray-400 mt-1">
                           <span>{displayPhone || (whatsapp ? formatPhone(whatsapp) : <span className="italic opacity-50 text-sm">sem telefone</span>)}</span>
                         </div>
                    </div>
                )}

                {!isFocusMode && (
                    <div className="mb-2 flex flex-col gap-1">
                        {activeTags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {activeTags.map(tag => (
                                    <span key={tag.id} className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: tag.color }}>
                                        {tag.label}
                                    </span>
                                ))}
                            </div>
                        )}
                        {hasLinkedClients && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-800/50">
                                <div className="font-bold flex items-center gap-1 mb-1">
                                    <LinkIcon size={12} /> Contas Vinculadas ({client.linked!.length})
                                </div>
                                <ul className="list-disc list-inside pl-1 text-[11px] opacity-80">
                                    {client.linked!.map(l => (
                                        <li key={l.id}>{l.name} - Vence: {formatDate(l.dueDate)}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {isCustomMessage && (
                    <div className="absolute top-3 right-4 flex items-center gap-1 text-[10px] text-purple-500 font-bold uppercase tracking-wider opacity-60">
                        <PenTool size={10} /> Mensagem Personalizada
                    </div>
                )}

                {(config.planGroups || []).length > 1 && (
                    <div className="mb-2 flex flex-wrap gap-1 justify-center sm:justify-start">
                        {config.planGroups?.map(group => (
                            <button
                                key={group.id}
                                onClick={() => setSelectedPlanGroupId(group.id)}
                                className={`px-2 py-0.5 text-[10px] rounded-full border transition-all ${
                                    selectedPlanGroupId === group.id
                                    ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700 font-bold'
                                    : 'bg-white text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                {group.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className={`mb-4 p-4 rounded-lg border select-text shadow-inner overflow-y-auto ${isFocusMode ? 'text-sm sm:text-base max-h-[30vh] sm:max-h-[40vh]' : ''} ${isCustomMessage ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30' : 'bg-gray-100 dark:bg-slate-900 border-gray-200 dark:border-slate-700/40'}`}>
                    {renderMessagePreview()}
                </div>

                <div className="space-y-2">
                    {(credentials.login || credentials.pass) && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-300 p-2 rounded border border-indigo-100 dark:border-indigo-900/30 text-[11px] sm:text-xs flex gap-4 items-center">
                            <div className="flex items-center gap-1 font-mono">
                                <Lock size={10} />
                                <span className="opacity-70">User:</span>
                                <span className="font-bold select-all">{credentials.login || '-'}</span>
                            </div>
                            <div className="flex items-center gap-1 font-mono">
                                <Key size={10} />
                                <span className="opacity-70">Pass:</span>
                                <span className="font-bold select-all">{credentials.pass || '-'}</span>
                            </div>
                        </div>
                    )}

                    {cleanText && (
                    <div className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-300 p-2 rounded border border-red-100 dark:border-red-900/30 text-[11px] sm:text-xs">
                        <strong className="block font-bold mb-0.5 text-red-700 dark:text-red-200">Obs:</strong>
                        <HighlightedText text={cleanText} query={searchQuery} />
                    </div>
                    )}

                    {client.customNotes && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 text-yellow-700 dark:text-yellow-300 p-2 rounded border border-yellow-100 dark:border-yellow-900/30 text-[11px] sm:text-xs">
                        <strong className="block font-bold mb-0.5 text-yellow-800 dark:text-yellow-200">Obs. Adicional:</strong>
                        <HighlightedText text={client.customNotes} query={searchQuery} />
                    </div>
                    )}
                </div>
            </div>

            {/* BARRA DE AÇÕES — focus mode mantém layout diferente */}
            {isFocusMode ? (
              <div className="flex flex-row items-center justify-center gap-2 p-3 py-4 bg-black/5 dark:bg-black/20 border-t border-black/5 dark:border-white/5">
                {(config.templates.additional || []).length > 0 && (
                  <div className="relative">
                    <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10">
                      <option value="auto">Auto</option>
                      {config.templates.additional?.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    <button className={`px-3 py-2.5 rounded-xl flex items-center gap-1.5 text-xs ${selectedTemplateId !== 'auto' ? 'bg-purple-600/15 text-purple-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                      <List size={13} /><span className="hidden sm:inline">{config.templates.additional?.find(t=>t.id===selectedTemplateId)?.label || 'Auto'}</span>
                    </button>
                  </div>
                )}
                <button onClick={() => onLinkClient(client)} className="px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-500 dark:text-slate-400 hover:text-blue-600 transition-all" title="Vincular"><LinkIcon size={13} /></button>
                <button onClick={() => onOpenReceipt(client)} disabled={!whatsapp} className="px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-orange-500 hover:text-orange-600 transition-all" title="Recibo"><FileText size={13} /></button>
                <button onClick={() => onEdit(client)} className="px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-500 dark:text-slate-400 transition-all" title="Editar"><Edit size={13} /></button>
                <button onClick={() => handleAction('copy')} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-500 dark:text-slate-400 text-xs transition-all" title="Copiar"><Copy size={13} /><span className="hidden sm:inline">Copiar</span></button>
                <button onClick={() => handleAction('whatsapp')} disabled={!whatsapp} className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs text-white transition-all ${!whatsapp ? 'opacity-30 cursor-not-allowed bg-gray-400' : 'bg-emerald-600 hover:bg-emerald-500'}`} title="WhatsApp">
                  <WhatsappIcon size={13} /><span className="hidden sm:inline">Enviar</span>
                </button>
              </div>
            ) : (
              /* GRID MODE — linha horizontal compacta no fundo do card */
              <div className="flex items-center gap-1 px-3 py-2 border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/10 flex-wrap">
                {(config.templates.additional || []).length > 0 && (
                  <div className="relative" title="Modelo">
                    <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10">
                      <option value="auto">Auto</option>
                      {config.templates.additional?.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    <button className={`p-1.5 rounded transition-colors ${selectedTemplateId !== 'auto' ? 'text-purple-500' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600'}`}><List size={15} /></button>
                  </div>
                )}
                <button onClick={() => onLinkClient(client)} className="p-1.5 rounded text-gray-400 dark:text-slate-500 hover:text-blue-500 transition-colors" title="Vincular"><LinkIcon size={15} /></button>
                <button onClick={() => onOpenReceipt(client)} disabled={!whatsapp} className={`p-1.5 rounded transition-colors ${!whatsapp ? 'opacity-30 cursor-not-allowed text-gray-300' : 'text-gray-400 dark:text-slate-500 hover:text-orange-500'}`} title="Recibo"><FileText size={15} /></button>
                <button onClick={() => onEdit(client)} className="p-1.5 rounded text-gray-400 dark:text-slate-500 hover:text-emerald-600 transition-colors" title="Editar"><Edit size={15} /></button>
                <button onClick={() => onCopy(displayPhone || '')} disabled={!displayPhone} className={`p-1.5 rounded transition-colors ${!displayPhone ? 'opacity-30 cursor-not-allowed text-gray-300' : 'text-gray-400 dark:text-slate-500 hover:text-indigo-500'}`} title="Copiar Tel"><Phone size={15} /></button>
                <button onClick={() => onCopy(client.name)} className="p-1.5 rounded text-gray-400 dark:text-slate-500 hover:text-orange-500 transition-colors" title="Copiar Nome"><User size={15} /></button>
                {onAddReminder && (
                  <button onClick={() => onAddReminder(client)} className={`p-1.5 rounded transition-colors ${hasReminder ? 'text-violet-500' : 'text-gray-400 dark:text-slate-500 hover:text-violet-500'}`} title="Lembrete"><Bell size={15} /></button>
                )}
                <div className="flex-1" />
                <button onClick={() => handleAction('copy')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/70 dark:bg-slate-700/60 text-gray-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 text-xs font-medium transition-all" title="Copiar mensagem">
                  <Copy size={13} /> Copiar
                </button>
                <button onClick={() => handleAction('whatsapp')} disabled={!whatsapp} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!whatsapp ? 'opacity-30 cursor-not-allowed bg-gray-200 text-gray-400' : 'bg-[#25D366] hover:bg-[#1DAD57] text-white shadow-sm'}`} title="Enviar WhatsApp">
                  <WhatsappIcon size={13} /> Enviar
                </button>
              </div>
            )}
        </>
      )}
    </div>
  );
};

function formatPhone(num: string) {
    if (num.length === 11) {
        return `(${num.substring(0,2)}) ${num.substring(2,7)}-${num.substring(7)}`;
    }
    return num;
}

export default React.memo(ClientCard);
