
import React, { useMemo, useState, useEffect } from 'react';
import { ParsedClient, AppConfig, ResultViewMode } from '../types';
import { extractPhone, padZero, formatDate, processSpinSyntax, applyAntiBan, extractCredentials } from '../utils/helpers';
import { Copy, Phone, Edit, MessageSquare, ExternalLink, CheckCircle, ChevronDown, ChevronUp, PenTool, List, FileText, Link as LinkIcon, Lock, Key, Zap, DollarSign, Bell } from 'lucide-react';

interface ClientCardProps {
  client: ParsedClient;
  config: AppConfig;
  isExpiredMode: boolean;
  viewMode: ResultViewMode;
  searchQuery: string;
  isSent: boolean;
  isPaid?: boolean;
  hasReminder?: boolean;
  onEdit: (client: ParsedClient) => void;
  onCopy: (text: string) => void;
  onMarkAsSent: (id: string, action: 'whatsapp' | 'copy' | 'receipt') => void;
  onOpenReceipt: (client: ParsedClient) => void;
  onLinkClient: (client: ParsedClient) => void;
  onMarkAsPaid?: (client: ParsedClient) => void;
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
  client, config, isExpiredMode, viewMode, searchQuery, isSent, isPaid, hasReminder,
  onEdit, onCopy, onMarkAsSent, onOpenReceipt, onLinkClient, onMarkAsPaid, onAddReminder
}) => {
  const isFocusMode = viewMode === 'focus';
  // In Focus Mode, always start expanded. In Grid, collapsed by default.
  const [isCollapsed, setIsCollapsed] = useState(!isFocusMode);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('auto');
  
  // Pricing Table Group State
  const [selectedPlanGroupId, setSelectedPlanGroupId] = useState<string>('default');

  const { cleanText, whatsapp, original: originalPhone } = useMemo(() => extractPhone(client.rawNotes), [client.rawNotes]);
  const hasLinkedClients = client.linked && client.linked.length > 0;

  // Credential Extraction
  const credentials = useMemo(() => extractCredentials(cleanText), [cleanText]);

  // Automatically select plan group based on linked clients count
  useEffect(() => {
      if (!config.planGroups) return;
      const totalAccounts = 1 + (client.linked?.length || 0);
      
      if (totalAccounts > 1) {
          // Try to find a group that matches the number of screens (e.g. "2 Telas")
          // Logic: search in label for the number
          const matchingGroup = config.planGroups.find(g => g.label.includes(`${totalAccounts}`));
          if (matchingGroup) {
              setSelectedPlanGroupId(matchingGroup.id);
          }
      } else {
          // Reset to default if single user
          setSelectedPlanGroupId('default');
      }
  }, [client.linked, config.planGroups]);

  // Resolve active tags
  const activeTags = useMemo(() => {
    if (!client.tags || !config.tags) return [];
    return config.tags.filter(t => client.tags?.includes(t.id));
  }, [client.tags, config.tags]);

  // Calculate message data directly without useMemo to ensure real-time updates
  const calculateCardData = () => {
    const diasSemanaPt = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Smart Greeting Logic
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

    if (isExpiredMode) {
      prefixStr = 'venceu';
      colorClass = 'border-l-slate-500';
    } else {
      if (vencDateOnly.getTime() < hoje.getTime()) {
        prefixStr = 'venceu';
        colorClass = 'border-l-slate-500';
      } else if (vencDateOnly.getTime() === hoje.getTime()) {
        prefixStr = 'vence hoje';
        colorClass = 'border-l-red-500';
      } else if (vencDateOnly.getTime() === amanha.getTime()) {
        prefixStr = 'vence amanhã';
        colorClass = 'border-l-orange-500';
      } else if (vencDateOnly.getTime() === depoisDeAmanha.getTime()) {
        prefixStr = 'vence em';
        colorClass = 'border-l-amber-400';
      } else {
        prefixStr = 'vence em';
        colorClass = 'border-l-emerald-500';
      }
    }

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

    // Template Logic
    let templateToUse = '';
    let isCustom = false;

    if (client.customMessage && client.customMessage.trim().length > 0) {
        templateToUse = client.customMessage;
        isCustom = true;
    } else if (selectedTemplateId !== 'auto') {
        const found = config.templates.additional?.find(t => t.id === selectedTemplateId);
        if (found) {
            templateToUse = found.content;
        } else {
            templateToUse = isExpiredMode ? config.templates.expired : config.templates.normal;
        }
    } else {
        templateToUse = isExpiredMode ? config.templates.expired : config.templates.normal;
    }

    // Generate Price Table String based on SELECTED GROUP
    const activeGroup = config.planGroups?.find(g => g.id === selectedPlanGroupId) || config.planGroups?.[0];
    const plansToUse = activeGroup?.plans || config.plans || [];
    
    // Determine Table Title (Dynamic)
    const baseTitle = config.plansTitle || 'TABELA DE PLANOS';
    let tableTitle = activeGroup?.title; // Use explicit title if set
    
    if (!tableTitle) {
        // Fallback auto-generation logic
        if (activeGroup && activeGroup.id !== 'default') {
            tableTitle = `${baseTitle} (${activeGroup.label})`;
        } else {
            tableTitle = baseTitle;
        }
    }

    // FORMATTING LOGIC
    const formatStr = config.priceLineFormat || '{nome} - R$ {valor}';
    const priceTableString = plansToUse.map(p => {
        return formatStr
            .replace(/{nome}/g, p.label)
            .replace(/{valor}/g, String(p.price));
    }).join('\n');

    // Handle Linked Names in Message
    let clientNameDisplay = client.name;
    if (hasLinkedClients) {
        const linkedNames = client.linked!.map(l => l.name).join(', ');
        clientNameDisplay = `${client.name}, ${linkedNames}`;
    }

    let msg = templateToUse
        .replace(/{saudacao}/g, saudacao) 
        .replace(/{nome}/g, clientNameDisplay) // Use combined name
        .replace(/{vencimento}/g, vencimentoFinal)
        .replace(/{pix}/g, config.pixKey)
        .replace(/{tabela_precos}/g, priceTableString)
        .replace(/{titulo_tabela}/g, tableTitle) // New Dynamic Title
        .replace(/{login}/g, credentials.login || '???')
        .replace(/{senha}/g, credentials.pass || '???');
    
    // Fallback: If template doesn't have {titulo_tabela}, replace the hardcoded string if found
    if (!msg.includes(tableTitle)) {
        // Replace "*TABELA DE PLANOS:*" with "*Dynamic Title:*" using regex for flexible matching of old defaults
        msg = msg.replace(/\*TABELA DE PLANOS(:\*)?/g, `*${tableTitle}$1`);
    }

    // Fallback legacy prices
    if (plansToUse.length > 0) msg = msg.replace(/{plano1}/g, String(plansToUse[0].price));
    if (plansToUse.length > 1) msg = msg.replace(/{plano2}/g, String(plansToUse[1].price));
    
    return { statusColor: colorClass, message: msg, statusText: `${prefixStr} (${formatDate(venc)})`, isCustomMessage: isCustom };
  };

  const { statusColor, message, statusText, isCustomMessage } = calculateCardData();

  const HighlightedText = ({ text, query }: { text: string, query: string }) => {
    if (!query.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-white rounded px-0.5">{part}</mark>
          ) : (
            part
          )
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
      
      // Apply Anti-Ban logic if enabled (WhatsApp only)
      let finalMessage = processedMsg;
      if (config.antiBanMode) {
          finalMessage = applyAntiBan(finalMessage);
      }

      const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(finalMessage)}`;
      
      // Feature: Queue Mode (Auto-Advance) is handled by parent, but we open window here
      // Logic: App checks if queue mode is active when 'whatsapp' action is triggered.
      window.open(url, '_blank');
    }
  };

  const containerClasses = `
    group transition-all duration-200 ease-in-out
    bg-white dark:bg-slate-800/90
    shadow-sm border border-gray-200/80 dark:border-slate-700/40
    ${isSent ? 'opacity-50' : ''}
    ${viewMode === 'list'
      ? 'flex items-center p-2 rounded-lg border-l-4 ' + statusColor
      : isFocusMode
        ? 'flex flex-col rounded-2xl border-l-8 shadow-2xl ' + statusColor
        : 'flex flex-col md:flex-row rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 border-l-4 ' + statusColor
    }
  `;

  // --- LIST / COMPACT VIEW ---
  if (viewMode === 'list') {
    return (
      <div className={`${containerClasses} relative overflow-hidden`}>
        {/* Simplified for List view - Linked accounts not shown in detail */}
        <div className="flex-1 min-w-0 flex items-center gap-3 px-1">
          <div className="flex-shrink-0 w-6 flex justify-center">
             {isSent ? (
               <CheckCircle className="text-green-500 animate-in zoom-in" size={16} />
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
             {/* ... remaining list view content ... */}
             <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {formatDate(client.dueDate)}
             </div>
             <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 font-mono">
                {whatsapp ? <Phone size={12} className="text-green-600" /> : <span className="w-3"/>}
                {originalPhone || '-'}
             </div>
             <div className="text-[10px] text-gray-400 truncate italic">
               {cleanText || 'Sem notas'}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-1 pl-2 border-l border-gray-100 dark:border-gray-700">
           {/* Actions */}
           <button 
             onClick={() => handleAction('whatsapp')} 
             disabled={!whatsapp}
             className={`p-1.5 rounded transition-colors ${!whatsapp ? 'text-gray-200 cursor-not-allowed' : 'hover:bg-green-50 dark:hover:bg-green-900/30 text-gray-400 hover:text-green-500'}`}
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
      
      {!isFocusMode && !isCollapsed && (
        <div className="absolute top-2 left-2 z-20">
            <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-300 transition-colors"
                title="Recolher"
            >
                <ChevronUp size={14} />
            </button>
        </div>
      )}

      {(isSent || isPaid) && (
        <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
          {isPaid && (
            <div className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shadow-sm animate-in fade-in">
              <DollarSign size={9} /> Pago
            </div>
          )}
          {isSent && !isPaid && (
            <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shadow-sm animate-in fade-in">
              <CheckCircle size={9} /> Enviado
            </div>
          )}
        </div>
      )}
      
      {/* COLLAPSED STATE */}
      {isCollapsed && !isFocusMode ? (
        <div className="flex-1 flex items-center gap-3 px-3 py-2.5 min-h-[66px]">
            {/* Avatar */}
            <button
                onClick={() => setIsCollapsed(false)}
                className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(client.name)} flex items-center justify-center text-white text-sm font-bold shadow-md hover:opacity-90 transition-opacity select-none`}
                title="Expandir"
            >
                {getInitials(client.name)}
            </button>

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
                    <span className="text-[9px] font-medium uppercase text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-600 px-1.5 py-px rounded">
                        {statusText.split('(')[0].trim()}
                    </span>
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

                {(cleanText || client.customNotes) && (
                    <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                        {cleanText && <span><strong className="text-red-500 dark:text-red-400">Obs:</strong> <HighlightedText text={cleanText} query={searchQuery} /></span>}
                        {client.customNotes && <span className="ml-1.5"><strong className="text-amber-500">Nota:</strong> <HighlightedText text={client.customNotes} query={searchQuery} /></span>}
                    </div>
                )}
            </div>

            {/* Actions — mobile: apenas ações primárias; desktop: todas */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
                {/* Secundários — só no desktop */}
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
                        <div className={`p-1.5 rounded transition-colors ${selectedTemplateId !== 'auto' ? 'text-purple-500' : 'text-gray-300 dark:text-slate-600 hover:text-gray-500'}`}>
                            <List size={15} />
                        </div>
                    </div>
                )}
                <button onClick={() => onLinkClient(client)} className="hidden sm:flex p-1.5 rounded text-gray-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" title="Vincular">
                    <LinkIcon size={15} />
                </button>
                <button onClick={() => onOpenReceipt(client)} disabled={!whatsapp} className={`hidden sm:flex p-1.5 rounded transition-colors ${!whatsapp ? 'text-gray-200 dark:text-slate-700 cursor-not-allowed' : 'text-gray-300 dark:text-slate-600 hover:text-orange-500 dark:hover:text-orange-400'}`} title="Recibo">
                    <FileText size={15} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onEdit(client); }} className="hidden sm:flex p-1.5 rounded text-gray-300 dark:text-slate-600 hover:text-primary dark:hover:text-emerald-400 transition-colors" title="Editar">
                    <Edit size={15} />
                </button>

                {/* Primários — sempre visíveis */}
                {onAddReminder && (
                  <button onClick={() => onAddReminder(client)} className={`p-1.5 rounded transition-colors ${hasReminder ? 'text-violet-500 dark:text-violet-400' : 'text-gray-300 dark:text-slate-600 hover:text-violet-500 dark:hover:text-violet-400'}`} title="Lembrete">
                    <Bell size={15} />
                  </button>
                )}
                {onMarkAsPaid && (
                  <button onClick={() => onMarkAsPaid(client)} className={`p-1.5 rounded transition-colors ${isPaid ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-300 dark:text-slate-600 hover:text-emerald-500 dark:hover:text-emerald-400'}`} title={isPaid ? 'Pago' : 'Marcar como pago'}>
                    <DollarSign size={15} />
                  </button>
                )}
                <button onClick={() => handleAction('whatsapp')} disabled={!whatsapp} className={`p-1.5 rounded transition-colors ${!whatsapp ? 'text-gray-200 dark:text-slate-700 cursor-not-allowed' : 'text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-100'}`} title="WhatsApp">
                    <WhatsappIcon size={15} />
                </button>
                <button onClick={() => setIsCollapsed(false)} className="p-1.5 rounded text-gray-200 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400 transition-colors">
                    <ChevronDown size={14} />
                </button>
            </div>
        </div>
      ) : (
        // --- EXPANDED / FOCUS STATE ---
        <>
            <div className={`flex-1 flex flex-col ${isFocusMode ? 'p-3 sm:p-10 justify-center' : 'p-4 pt-10'} text-xs sm:text-sm leading-relaxed whitespace-pre-wrap relative ${isCustomMessage ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-300'}`}>
                
                {/* Header Info for Focus Mode */}
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
                         <p className="font-mono text-gray-400 mt-1">{whatsapp ? formatPhone(whatsapp) : originalPhone}</p>
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

                {/* --- PRICE TABLE SWITCHER CHIPS --- */}
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

                <div className={`mb-4 p-4 rounded-lg border select-text shadow-inner overflow-y-auto ${isFocusMode ? 'text-sm sm:text-base max-h-[30vh] sm:max-h-[40vh]' : ''} ${isCustomMessage ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30' : 'bg-gray-50 dark:bg-slate-900/50 border-gray-100 dark:border-slate-700/40'}`}>
                    {renderMessagePreview()}
                </div>

                <div className="space-y-2">
                    {/* CREDENTIALS BOX */}
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

            {/* ACTION BAR */}
            <div className={`flex flex-row items-center gap-1 sm:gap-2 p-1 sm:p-2 bg-gray-50/80 dark:bg-slate-900/60 border-t border-gray-100 dark:border-slate-700/40 backdrop-blur-sm ${isFocusMode ? 'justify-center py-4' : 'md:flex-col md:border-t-0 md:border-l md:w-14 md:justify-start'}`}>
                
                {/* Template Selector */}
                {(config.templates.additional || []).length > 0 && (
                    <div className={`relative group/tpl ${isFocusMode ? 'w-auto' : 'w-full'}`}>
                         <select 
                             value={selectedTemplateId}
                             onChange={(e) => setSelectedTemplateId(e.target.value)}
                             className={`absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10`}
                             title="Selecionar Modelo de Mensagem"
                         >
                            <option value="auto">Auto</option>
                            {config.templates.additional?.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                         </select>
                         <button className={`w-full p-2 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm border ${selectedTemplateId !== 'auto' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 border-purple-200' : 'bg-white dark:bg-gray-700 text-gray-500 border-transparent hover:bg-gray-100'}`}>
                            <List size={16} />
                            {isFocusMode && <span className="text-sm font-medium hidden sm:inline">{config.templates.additional?.find(t=>t.id===selectedTemplateId)?.label || 'Auto'}</span>}
                         </button>
                    </div>
                )}

                <div className={`w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 ${isFocusMode ? 'block' : 'hidden md:block md:w-6 md:h-px md:mx-0 md:my-1'}`} />

                <button
                    onClick={() => onLinkClient(client)}
                    className={`p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 shadow-sm hover:shadow text-gray-500 dark:text-slate-400 hover:text-blue-600 transition-all ${isFocusMode ? 'px-2 sm:px-4 bg-white dark:bg-slate-700' : ''}`}
                    title="Vincular Contas"
                >
                    <LinkIcon size={16} />
                </button>

                <button
                    onClick={() => onOpenReceipt(client)}
                    disabled={!whatsapp}
                    className={`p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 shadow-sm hover:shadow text-gray-500 dark:text-slate-400 hover:text-orange-500 transition-all ${isFocusMode ? 'px-2 sm:px-4 bg-white dark:bg-slate-700 text-orange-600' : ''}`}
                    title="Gerar Recibo e Enviar"
                >
                    <FileText size={16} />
                </button>

                <button
                    onClick={() => onEdit(client)}
                    className={`p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 shadow-sm hover:shadow text-gray-500 dark:text-slate-400 hover:text-primary transition-all ${isFocusMode ? 'px-2 sm:px-4 bg-white dark:bg-slate-700' : ''}`}
                    title="Editar Cliente"
                >
                    <Edit size={16} />
                </button>

                {!isFocusMode && (
                    <button onClick={() => onCopy(message)} className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 shadow-sm hover:shadow text-gray-500 dark:text-slate-400 hover:text-gray-800 transition-all" title="Copiar (Sem Spin)">
                    <Copy size={16} />
                    </button>
                )}

                <button onClick={() => handleAction('copy')} className={`p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 shadow-sm hover:shadow text-gray-500 dark:text-slate-400 hover:text-blue-600 transition-all relative ${isFocusMode ? 'px-3 sm:px-6 bg-white dark:bg-slate-700' : ''}`} title="Copiar (Com Spin)">
                <div className="relative flex items-center gap-2">
                    <Copy size={16} />
                    {isFocusMode && <span className="font-bold hidden sm:inline">Copiar</span>}
                    {!isFocusMode && <span className="absolute -top-1 -right-1 text-[7px] bg-blue-500 text-white px-0.5 py-px rounded-full font-bold">S</span>}
                </div>
                </button>
                
                {!isFocusMode && (
                    <button
                    onClick={() => onCopy(originalPhone || 'Sem telefone')}
                    disabled={!originalPhone}
                    className={`p-2 rounded-lg shadow-sm hover:shadow transition-all ${!originalPhone ? 'opacity-30 cursor-not-allowed text-gray-400' : 'hover:bg-white dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-indigo-600'}`}
                    title="Copiar Tel"
                    >
                    <Phone size={16} />
                    </button>
                )}

                <button 
                onClick={() => handleAction('whatsapp')} 
                disabled={!whatsapp}
                className={`p-2 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 ${!whatsapp ? 'opacity-30 cursor-not-allowed text-gray-400' : 'hover:bg-white dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'} ${isFocusMode ? 'px-4 sm:px-8 bg-slate-700 text-white hover:bg-slate-600 hover:text-white shadow-md' : ''}`} 
                title="WhatsApp"
                >
                <WhatsappIcon size={isFocusMode ? 20 : 16} />
                {isFocusMode && <span className="font-bold hidden sm:inline">Enviar</span>}
                </button>

                {!isFocusMode && (
                    <button onClick={() => onCopy(client.name)} className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 shadow-sm hover:shadow text-gray-500 dark:text-slate-400 hover:text-orange-500 transition-all" title="Copiar Nome">
                        <ExternalLink size={16} />
                    </button>
                )}
            </div>
        </>
      )}
    </div>
  );
};

// Helper for display
function formatPhone(num: string) {
    if (num.length === 11) {
        return `(${num.substring(0,2)}) ${num.substring(2,7)}-${num.substring(7)}`;
    }
    return num;
}

export default React.memo(ClientCard);
