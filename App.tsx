
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Sun, Moon, Filter, Trash2, Search, ArrowLeft, Download, Settings, Users, 
  CalendarX, AlertTriangle, Info, CalendarCheck, LayoutGrid, LayoutList, 
  History, Play, X, ChevronLeft, ChevronRight, CheckCircle, Clock, Link as LinkIcon, Copy, MessageSquare, ExternalLink,
  Clipboard, Rocket, Upload, AlertOctagon
} from 'lucide-react';
import { ParsedClient, AppConfig, ViewMode, ResultViewMode, ToastMessage, DateRange, ActionLog } from './types';
import { DEFAULT_CONFIG } from './constants';
import { parseClientData, detectInputType, normalizeCsvIfNeeded } from './utils/parser';
import { extractPhone, extractPhoneValidated, generateCSV, formatDateShort, toInputDate, formatCurrency, padZero, formatDate } from './utils/helpers';
import { getWeekdayContext, getUpcomingRange } from './utils/calendar';
import ClientCard from './components/ClientCard';
import ConfigModal from './components/ConfigModal';
import EditClientModal from './components/EditClientModal';
import ReceiptModal from './components/ReceiptModal';
import LinkClientsModal from './components/LinkClientsModal';
import { HistorySidebar, LinksSidebar } from './components/Sidebars';

function App() {
  // --- Theme State ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // --- Configuration State (With Migration Logic) ---
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('cobrancaConfig');
    if (saved) {
        const parsed = JSON.parse(saved);
        
        // MIGRATION: Convert old "prices" object to "plans" array if needed
        if (parsed.prices && (!parsed.plans || parsed.plans.length === 0)) {
            parsed.plans = [
                { id: 'm1', label: '1 Mês', price: parsed.prices.month1 || 35 },
                { id: 'm2', label: '2 Meses', price: parsed.prices.month2 || 70 },
                { id: 'm3', label: '3 Meses', price: parsed.prices.month3 || 105 },
                { id: 'm6', label: '6 Meses', price: parsed.prices.month6 || 210 },
            ];
            // Update default templates to use new variable if they are still using the old ones
            if (parsed.templates.normal.includes('{plano1}')) {
                parsed.templates.normal = DEFAULT_CONFIG.templates.normal;
            }
            if (parsed.templates.expired.includes('{plano1}')) {
                parsed.templates.expired = DEFAULT_CONFIG.templates.expired;
            }
            delete parsed.prices;
        }

        // UPDATE: Check for missing 4 and 5 months plans (for existing users)
        if (parsed.plans) {
            const hasP4 = parsed.plans.some((p: any) => p.label.includes('4 Meses'));
            const hasP5 = parsed.plans.some((p: any) => p.label.includes('5 Meses'));
            
            if (!hasP4) {
                 parsed.plans.push({ id: 'p4', label: '4 Meses', price: 140 });
                 parsed.plans.sort((a: any, b: any) => a.price - b.price);
            }
            if (!hasP5) {
                 parsed.plans.push({ id: 'p5', label: '5 Meses', price: 175 });
                 parsed.plans.sort((a: any, b: any) => a.price - b.price);
            }
        }
        
        // UPDATE: Initialize planGroups if missing
        if (!parsed.planGroups || parsed.planGroups.length === 0) {
            // Create default group from existing plans
            parsed.planGroups = [
                {
                    id: 'default',
                    label: '1 Tela (Padrão)',
                    plans: parsed.plans || DEFAULT_CONFIG.plans
                },
                ...DEFAULT_CONFIG.planGroups.slice(1) // Add 2 and 3 screens examples
            ];
        }

        // Ensure new fields exist
        if (!parsed.tags) parsed.tags = DEFAULT_CONFIG.tags;
        if (!parsed.templates.receipt) parsed.templates.receipt = DEFAULT_CONFIG.templates.receipt;
        if (!parsed.quickLinks) parsed.quickLinks = DEFAULT_CONFIG.quickLinks;
        if (!parsed.priceLineFormat) parsed.priceLineFormat = DEFAULT_CONFIG.priceLineFormat;
        if (!parsed.plansTitle) parsed.plansTitle = DEFAULT_CONFIG.plansTitle;

        // Cleanup deprecated quickMessages if they exist
        if (parsed.quickMessages) delete parsed.quickMessages;

        return parsed;
    }
    return DEFAULT_CONFIG;
  });

  // --- Data State ---
  const [inputData, setInputData] = useState(() => localStorage.getItem('lastInputData') || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [customNotes, setCustomNotes] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('customNotes');
    return saved ? JSON.parse(saved) : {};
  });

  const [customMessages, setCustomMessages] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('customMessages');
    return saved ? JSON.parse(saved) : {};
  });

  const [phoneOverrides, setPhoneOverrides] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('phoneOverrides');
    return saved ? JSON.parse(saved) : {};
  });

  const [clientTags, setClientTags] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('clientTags');
    return saved ? JSON.parse(saved) : {};
  });

  // Mapping: MasterName -> Array of DependentNames
  const [clientLinks, setClientLinks] = useState<Record<string, string[]>>(() => {
      const saved = localStorage.getItem('clientLinks');
      return saved ? JSON.parse(saved) : {};
  });

  // --- View State ---
  const [viewMode, setViewMode] = useState<ViewMode>('input');
  const [resultViewMode, setResultViewMode] = useState<ResultViewMode>('grid');
  const [results, setResults] = useState<ParsedClient[]>([]); // Structured results (grouped)
  const [flatResults, setFlatResults] = useState<ParsedClient[]>([]); // All clients flat list
  const [resultTitle, setResultTitle] = useState('');
  const [isExpiredMode, setIsExpiredMode] = useState(false);
  
  // --- Smart Persistence for Sent Clients ---
  const [sentClients, setSentClients] = useState<Record<string, number>>(() => {
    try {
        const saved = localStorage.getItem('sentClientsHistory');
        if (!saved) return {};
        const parsed = JSON.parse(saved);
        const now = Date.now();
        const eighteenHours = 18 * 60 * 60 * 1000;
        
        const cleaned: Record<string, number> = {};
        Object.entries(parsed).forEach(([id, timestamp]) => {
            if (typeof timestamp === 'number' && (now - timestamp) < eighteenHours) {
                cleaned[id] = timestamp;
            }
        });
        return cleaned;
    } catch (e) { return {}; }
  });

  // --- Action History Log (New Feature) ---
  const [actionHistory, setActionHistory] = useState<ActionLog[]>(() => {
      try {
          const saved = localStorage.getItem('actionHistory');
          if (!saved) return [];
          const parsed: ActionLog[] = JSON.parse(saved);
          // Filter logs from today only
          const today = new Date().toDateString();
          return parsed.filter(log => new Date(log.timestamp).toDateString() === today);
      } catch (e) { return []; }
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);

  // --- Filter Inputs ---
  const [unifiedDates, setUnifiedDates] = useState<DateRange>(() => ({
    start: localStorage.getItem('unifiedStart') || '',
    end: localStorage.getItem('unifiedEnd') || ''
  }));
  const [expiredDates, setExpiredDates] = useState<DateRange>({ start: '', end: '' });
  
  // --- UI State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ParsedClient | null>(null);
  const [receiptClient, setReceiptClient] = useState<ParsedClient | null>(null);
  const [linkingClient, setLinkingClient] = useState<ParsedClient | null>(null); // For Linking Modal

  // --- Focus Mode & Queue State ---
  const [focusIndex, setFocusIndex] = useState(0);
  const [isQueueMode, setIsQueueMode] = useState(false);

  // --- Weekday Rules State ---
  // Recalcula uma vez por minuto (caso usuário deixe a aba aberta passando da meia-noite)
  const [weekday, setWeekday] = useState(() => getWeekdayContext());
  useEffect(() => {
    const interval = setInterval(() => setWeekday(getWeekdayContext()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // --- Invalid Phones Report (preenchido durante o modo Fila) ---
  const [invalidClients, setInvalidClients] = useState<{ name: string; phone: string; reason: string }[]>([]);
  const [showInvalidReport, setShowInvalidReport] = useState(false);

  // Ref de input de arquivo (upload CSV/TXT)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('cobrancaConfig', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('lastInputData', inputData);
  }, [inputData]);

  useEffect(() => {
    localStorage.setItem('customNotes', JSON.stringify(customNotes));
  }, [customNotes]);

  useEffect(() => {
    localStorage.setItem('customMessages', JSON.stringify(customMessages));
  }, [customMessages]);

  useEffect(() => {
    localStorage.setItem('phoneOverrides', JSON.stringify(phoneOverrides));
  }, [phoneOverrides]);

  useEffect(() => {
    localStorage.setItem('clientTags', JSON.stringify(clientTags));
  }, [clientTags]);

  useEffect(() => {
    localStorage.setItem('clientLinks', JSON.stringify(clientLinks));
  }, [clientLinks]);

  useEffect(() => {
    localStorage.setItem('unifiedStart', unifiedDates.start);
    localStorage.setItem('unifiedEnd', unifiedDates.end);
  }, [unifiedDates]);

  useEffect(() => {
    localStorage.setItem('sentClientsHistory', JSON.stringify(sentClients));
  }, [sentClients]);

  useEffect(() => {
    localStorage.setItem('actionHistory', JSON.stringify(actionHistory));
  }, [actionHistory]);

  // --- Helpers ---
  const addToast = (text: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handlePasteInput = async () => {
    try {
      const raw = await navigator.clipboard.readText();
      if (!raw) {
          addToast('Área de transferência vazia.', 'warning');
          return;
      }
      // Normaliza CSV automaticamente caso o AdminX exporte nesse formato
      const text = normalizeCsvIfNeeded(raw);
      setInputData(prev => {
          const cleanPrev = prev || '';
          if (!cleanPrev.trim()) return text;
          return cleanPrev.trim() + '\n' + text;
      });
      addToast('Dados adicionados ao final da lista!', 'success');
    } catch (err) {
      if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
      }
      addToast('Use Ctrl+V para colar (Permissão do navegador necessária).', 'info');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const text = normalizeCsvIfNeeded(raw);
      setInputData(prev => {
        const cleanPrev = prev || '';
        if (!cleanPrev.trim()) return text;
        return cleanPrev.trim() + '\n' + text;
      });
      addToast(`Arquivo "${file.name}" carregado.`, 'success');
    } catch {
      addToast('Falha ao ler o arquivo.', 'error');
    } finally {
      // Permite recarregar o mesmo arquivo se o usuário quiser
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processData = useCallback((range: DateRange, isVencidoFilter: boolean, forceLinks?: Record<string, string[]>) => {
    if (!inputData.trim()) {
      addToast('Por favor, insira dados no campo de texto.', 'warning');
      return;
    }
    if (!range.start || !range.end) {
      addToast('Selecione as datas de início e fim.', 'warning');
      return;
    }

    const start = new Date(range.start + "T00:00:00");
    const end = new Date(range.end + "T23:59:59");

    if (start > end) {
      addToast('Data de início maior que data fim.', 'error');
      return;
    }

    const isLikelyP2P = detectInputType(inputData);
    const { parsedEntries } = parseClientData(inputData, isLikelyP2P);
    
    // 1. First Pass: Apply overrides and basic formatting
    const preparedClients = parsedEntries.filter(entry => {
      const entryDate = new Date(entry.dueDate);
      entryDate.setHours(0,0,0,0);
      const s = new Date(start); s.setHours(0,0,0,0);
      const e = new Date(end); e.setHours(0,0,0,0);
      return entryDate >= s && entryDate <= e;
    }).map(entry => {
      let rawNotes = entry.rawNotes;
      if (phoneOverrides[entry.name]) {
         const { cleanText } = extractPhone(entry.rawNotes);
         rawNotes = `${phoneOverrides[entry.name]} ${cleanText}`.trim();
      }
      return {
        ...entry,
        rawNotes: rawNotes,
        customNotes: customNotes[entry.name] || '',
        customMessage: customMessages[entry.name] || '',
        tags: clientTags[entry.name] || [],
        linked: [] as ParsedClient[]
      };
    });

    if (preparedClients.length === 0) {
      addToast(`Nenhum resultado no período. (Lidos: ${parsedEntries.length})`, 'info');
      return;
    }

    // 2. Second Pass: Group Clients based on Links
    const linksToUse = forceLinks || clientLinks;
    const clientMap = new Map<string, ParsedClient>();
    preparedClients.forEach(c => clientMap.set(c.name, c));

    // Identify which clients are dependents (to hide them later)
    const dependentNames = new Set<string>();

    Object.entries(linksToUse).forEach(([masterName, dependents]) => {
        const master = clientMap.get(masterName);
        if (master) {
            (dependents as string[]).forEach(depName => {
                const dep = clientMap.get(depName);
                if (dep) {
                    master.linked = [...(master.linked || []), dep];
                    dependentNames.add(depName);
                }
            });
        }
    });

    // Filter out dependents from the main list
    const groupedClients = preparedClients.filter(c => !dependentNames.has(c.name));

    setFlatResults(preparedClients);
    setResults(groupedClients);
    setIsExpiredMode(isVencidoFilter);
    const typeLabel = isLikelyP2P ? 'P2P' : 'IPTV';
    const modeLabel = isVencidoFilter ? 'Vencidos' : typeLabel;
    setResultTitle(`${modeLabel} (${formatDateShort(start)} - ${formatDateShort(end)})`);
    setViewMode('results');
    setResultViewMode('grid'); // Reset to grid view
    setSearchQuery('');
  }, [inputData, phoneOverrides, customNotes, customMessages, clientTags, clientLinks]);

  const handleFilterUpcoming = () => {
    const range = getUpcomingRange();
    const startStr = toInputDate(range.start);
    const endStr = toInputDate(range.end);
    setUnifiedDates({ start: startStr, end: endStr });
    processData({ start: startStr, end: endStr }, false);

    if (weekday.mode === 'friday_double') {
      addToast('Sexta-feira: filtrando amanhã + depois de amanhã.', 'info');
    } else {
      addToast('Filtrando vencimentos de amanhã.', 'info');
    }
  };

  const handleFilterExpiredRecent = () => {
    const today = new Date();
    const fourDaysAgo = new Date(today);
    fourDaysAgo.setDate(today.getDate() - 4);
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(today.getDate() - 5);

    const startStr = toInputDate(fiveDaysAgo);
    const endStr = toInputDate(fourDaysAgo);

    setExpiredDates({ start: startStr, end: endStr });
    processData({ start: startStr, end: endStr }, true);
  };

  const handleEditSave = (updated: ParsedClient) => {
    // Update both lists
    setResults(prev => prev.map(c => c.id === updated.id ? updated : c));
    setFlatResults(prev => prev.map(c => c.id === updated.id ? updated : c));
    
    // Notes
    if (updated.customNotes) {
      setCustomNotes(prev => ({ ...prev, [updated.name]: updated.customNotes! }));
    } else {
      setCustomNotes(prev => { const copy = { ...prev }; delete copy[updated.name]; return copy; });
    }

    // Messages
    if (updated.customMessage) {
      setCustomMessages(prev => ({ ...prev, [updated.name]: updated.customMessage! }));
    } else {
      setCustomMessages(prev => { const copy = { ...prev }; delete copy[updated.name]; return copy; });
    }

    // Phones
    const { original } = extractPhone(updated.rawNotes);
    if (original) {
        setPhoneOverrides(prev => ({ ...prev, [updated.name]: original }));
    }

    // Tags
    if (updated.tags && updated.tags.length > 0) {
        setClientTags(prev => ({ ...prev, [updated.name]: updated.tags! }));
    } else {
        setClientTags(prev => { const copy = { ...prev }; delete copy[updated.name]; return copy; });
    }

    setEditingClient(null);
    addToast('Cliente atualizado.', 'success');
  };

  const handleSendReceipt = (date: Date, value: number) => {
    if (!receiptClient) return;

    handleMarkAsSent(receiptClient.id, 'receipt');

    const receiptMsg = (config.templates.receipt || '')
        .replace(/{nome}/g, receiptClient.name)
        .replace(/{data_vencimento}/g, formatDate(date))
        .replace(/{valor}/g, `R$ ${value}`);

    const { whatsapp } = extractPhone(receiptClient.rawNotes);

    if (whatsapp) {
        const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(receiptMsg)}`;
        window.open(url, '_blank');
    } else {
        copyToClipboard(receiptMsg);
        addToast('Sem WhatsApp, copiado!', 'warning');
    }
  };

  const handleSaveLinks = (master: ParsedClient, selectedDependents: string[]) => {
      // Update links
      const newLinks = { ...clientLinks };
      if (selectedDependents.length === 0) {
          delete newLinks[master.name];
      } else {
          newLinks[master.name] = selectedDependents;
      }
      setClientLinks(newLinks);

      // Re-process view
      const datesToUse = isExpiredMode ? expiredDates : unifiedDates;
      processData(datesToUse, isExpiredMode, newLinks);
      addToast('Vínculos salvos!', 'success');
  };

  const handleExport = () => {
    if (results.length === 0) return;
    const dataToExport = getFilteredResults().map(r => ({
      name: r.name,
      date: r.dueDate,
      notes: extractPhone(r.rawNotes).cleanText,
      phone: extractPhone(r.rawNotes).original,
      customNotes: r.customNotes || ''
    }));
    const csv = generateCSV(dataToExport, config.defaultTime || '20:00');
    const blob = new Blob([String.fromCharCode(0xFEFF), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clientes_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Arquivo exportado.', 'success');
  };

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast('Copiado!', 'success');
    }).catch(() => addToast('Erro ao copiar.', 'error'));
  }, []);

  const handleMarkAsSent = useCallback((id: string, action: 'whatsapp' | 'copy' | 'mark' | 'receipt') => {
    const timestamp = Date.now();
    setSentClients(prev => ({ ...prev, [id]: timestamp }));
    
    // Log history
    const client = results.find(r => r.id === id);
    if (client) {
        setActionHistory(prev => {
            // Avoid duplicates within last 10 minutes for same action to prevent spamming log
            const existing = prev.find(p => p.clientId === id && p.action === action && (timestamp - p.timestamp) < 600000);
            if (existing) return prev;
            return [{ clientId: id, clientName: client.name, timestamp, action }, ...prev];
        });
    }

    // AUTO-ADVANCE LOGIC (QUEUE MODE)
    // Only auto-advance if it was a WhatsApp action and Queue Mode is active
    if (action === 'whatsapp') {
        // We need to check the CURRENT view mode and index state
        // Since this is a callback, we use functional updates or refs usually, 
        // but here we can just update the index state with a timeout
        setTimeout(() => {
            setIsQueueMode(currentIsQueue => {
                if (currentIsQueue) {
                     setFocusIndex(prevIndex => {
                         // Advance if not at end
                         const total = getFilteredResults().length;
                         if (prevIndex < total - 1) {
                             return prevIndex + 1;
                         }
                         return prevIndex;
                     });
                }
                return currentIsQueue; // return existing value
            });
        }, 1000); // 1s delay to let browser open tab
    }
  }, [results]);

  const getFilteredResults = useCallback(() => {
    if (!searchQuery) return results;
    const lower = searchQuery.toLowerCase();
    
    // Check tags filter as well
    return results.filter(r => {
        const matchesName = r.name.toLowerCase().includes(lower);
        const matchesNotes = r.rawNotes.toLowerCase().includes(lower);
        const matchesCustom = (r.customNotes || '').toLowerCase().includes(lower);
        
        // Also check inside Linked Clients
        const matchesLinked = r.linked?.some(l => l.name.toLowerCase().includes(lower));
        
        // Allow searching by tag name (e.g. search "vip")
        const clientTagLabels = (r.tags || []).map(tid => config.tags?.find(t => t.id === tid)?.label.toLowerCase() || '');
        const matchesTags = clientTagLabels.some(label => label.includes(lower));

        return matchesName || matchesNotes || matchesCustom || matchesTags || matchesLinked;
    });
  }, [results, searchQuery, config.tags]);

  const dashboardStats = useMemo(() => {
    // When calculating stats, we should probably consider linked clients too if we want "Total Accounts"
    // Or just "Total Paying Clients" (cards). Let's stick to Cards for simplicity, but maybe indicate accounts.
    // Actually, revenue is per account usually.
    const currentResults = getFilteredResults();
    let totalCards = 0;
    let totalAccounts = 0;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let expired = 0;
    let expiringToday = 0;

    currentResults.forEach(r => {
        totalCards++;
        totalAccounts += 1 + (r.linked?.length || 0);

        const d = new Date(r.dueDate);
        d.setHours(0,0,0,0);
        if (d < today) expired++;
        if (d.getTime() === today.getTime()) expiringToday++;
    });

    const potentialRevenue = totalAccounts * (config.plans?.[0]?.price || 35); // Approx revenue using first plan
    return { total: totalCards, expired, today: expiringToday, potentialRevenue };
  }, [results, searchQuery, config.plans]);

  // --- Focus Mode Logic ---
  const startFocusMode = (enableQueue = false) => {
    const filtered = getFilteredResults();
    if (filtered.length === 0) return;

    // Pré-validação: separa clientes com número inválido
    const invalids: { name: string; phone: string; reason: string }[] = [];
    filtered.forEach(c => {
      const v = extractPhoneValidated(c.rawNotes);
      if (!v.isValid) {
        invalids.push({
          name: c.name,
          phone: v.original || '(sem número)',
          reason: v.invalidReason || 'inválido'
        });
      }
    });
    setInvalidClients(invalids);

    setFocusIndex(0);
    setResultViewMode('focus');
    setIsQueueMode(enableQueue);

    if (invalids.length > 0) {
      addToast(`${invalids.length} cliente(s) com número inválido — verão envio manual no relatório final.`, 'warning');
    }
    if (enableQueue) {
      addToast('Modo Fila Ativo: o próximo cliente abrirá automaticamente após enviar.', 'success');
    }
  };

  const handleFocusNext = () => {
    const filtered = getFilteredResults();
    if (focusIndex < filtered.length - 1) {
      setFocusIndex(prev => prev + 1);
    } else if (isQueueMode) {
      // Fim da fila — exibe relatório se houver inválidos
      if (invalidClients.length > 0) setShowInvalidReport(true);
      setIsQueueMode(false);
      addToast('Fila concluída.', 'success');
    }
  };

  const handleFocusPrev = () => {
    if (focusIndex > 0) setFocusIndex(prev => prev - 1);
  };

  const stopFocusMode = () => {
      setResultViewMode('grid');
      setIsQueueMode(false);
      // Ao sair, mostra o relatório de inválidos se houver
      if (invalidClients.length > 0) setShowInvalidReport(true);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors h-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="p-1.5 bg-gradient-to-br from-primary to-primary-hover rounded-lg shadow text-white">
                <Users size={18} />
             </div>
             <h1 className="text-lg font-bold tracking-tight text-gray-800 dark:text-white hidden sm:block">
               Cobrança Fácil
             </h1>
          </div>
          
          <div className="flex items-center gap-2">
             {viewMode === 'results' && resultViewMode !== 'focus' && (
                <>
                    <button 
                        onClick={() => setIsLinksOpen(true)}
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors mr-1"
                        title="Links Rápidos"
                    >
                        <LinkIcon size={18} />
                    </button>

                    <button 
                        onClick={() => setIsHistoryOpen(true)}
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors relative"
                        title="Histórico de Sessão"
                    >
                        <History size={18} />
                        {actionHistory.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
                    </button>

                    <button 
                        onClick={() => startFocusMode(true)}
                        className="flex items-center gap-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50 px-3 py-1.5 rounded-full text-xs font-bold transition-all border border-orange-200 dark:border-orange-800/50 mr-1"
                        title="Fila de Disparo (Auto-avanço)"
                    >
                        <Rocket size={14} /> Fila
                    </button>

                    <button 
                        onClick={() => startFocusMode(false)}
                        className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-95 mr-2"
                        title="Modo Foco (Um por vez)"
                    >
                        <Play size={14} fill="currentColor" /> Foco
                    </button>

                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-md p-0.5 border border-gray-200 dark:border-gray-600">
                        <button 
                            onClick={() => setResultViewMode('grid')}
                            className={`p-1.5 rounded-sm transition-all ${resultViewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            title="Grade"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button 
                            onClick={() => setResultViewMode('list')}
                            className={`p-1.5 rounded-sm transition-all ${resultViewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            title="Lista"
                        >
                            <LayoutList size={16} />
                        </button>
                    </div>
                </>
             )}

             <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors focus:ring-2 focus:ring-primary/50 outline-none ml-1"
             >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container max-w-7xl mx-auto px-3 sm:px-4 py-6 relative">
        
        {viewMode === 'input' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* ... (Input UI) ... */}
            <div className="lg:col-span-2 space-y-5">
              {/* AVISO DE CALENDÁRIO */}
              {weekday.mode === 'friday_double' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-3 rounded-lg flex items-start gap-3">
                  <Info size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-700 dark:text-amber-300">
                      Sexta-feira: o filtro "Próximos" cobre amanhã + depois de amanhã
                    </p>
                    <p className="text-amber-600 dark:text-amber-400 text-xs mt-0.5">{weekday.todayLabel}</p>
                  </div>
                </div>
              )}

              <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <div className="flex items-center gap-2">
                        <Settings size={16} className="text-primary" />
                        <h2 className="text-base font-semibold">Entrada de Dados</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                          type="file"
                          accept=".csv,.txt,.tsv"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          className="hidden"
                      />
                      <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1 text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 px-2 py-1.5 rounded hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                          title="Carregar arquivo CSV ou TXT"
                      >
                          <Upload size={14} /> Arquivo
                      </button>
                      <button 
                          onClick={handlePasteInput}
                          className="flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                          title="Colar da área de transferência (Adiciona ao final)"
                      >
                          <Clipboard size={14} /> Colar
                      </button>
                    </div>
                </div>
                
                <textarea 
                  ref={textareaRef}
                  value={inputData}
                  onChange={(e) => setInputData(e.target.value)}
                  placeholder="Cole aqui a lista (IPTV ou P2P)..."
                  className="w-full h-48 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary outline-none resize-y font-mono text-xs transition-all shadow-inner"
                />

                <div className="mt-5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                  {/* ... Filter buttons ... */}
                  <div className="flex items-center gap-2 mb-3">
                     <Filter size={14} className="text-gray-400" />
                     <h3 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Filtro de Processamento</h3>
                  </div>
                  
                  <div className="mb-4">
                     <button 
                        onClick={handleFilterUpcoming}
                        className="w-full bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/20 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 border border-blue-100 dark:border-blue-800/50"
                        title={weekday.mode === 'friday_double' ? 'Sexta: amanhã + depois de amanhã' : 'Amanhã'}
                     >
                        <CalendarCheck size={16} />
                        {weekday.mode === 'friday_double'
                          ? 'Próximos (Amanhã + Depois)'
                          : 'Próximos (Amanhã)'}
                     </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="group">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Data Início</label>
                      <input 
                        type="date" 
                        value={unifiedDates.start}
                        onChange={(e) => setUnifiedDates({...unifiedDates, start: e.target.value})}
                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 dark:text-white focus:ring-1 focus:ring-primary text-sm [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                    <div className="group">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Data Fim</label>
                      <input 
                        type="date" 
                        value={unifiedDates.end}
                        onChange={(e) => setUnifiedDates({...unifiedDates, end: e.target.value})}
                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 dark:text-white focus:ring-1 focus:ring-primary text-sm [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => processData(unifiedDates, false)}
                      className="flex-1 bg-gradient-to-r from-primary to-primary-hover text-white py-2 px-4 rounded-lg text-sm font-semibold shadow-md shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <Filter size={16} /> Processar
                    </button>
                    <button 
                      onClick={() => {
                        setInputData('');
                        setUnifiedDates({start: '', end: ''});
                        addToast('Limpo', 'info');
                      }}
                      className="bg-white dark:bg-transparent border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 py-2 px-3 rounded-lg transition-all hover:text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3 text-red-600 dark:text-red-400 border-b border-gray-100 dark:border-gray-700 pb-2">
                  <CalendarX size={16} />
                  <h2 className="text-base font-semibold">Filtro de Vencidos</h2>
                </div>
                
                <div className="space-y-3">
                    <button 
                        onClick={handleFilterExpiredRecent}
                        className="w-full bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/20 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 border border-orange-200 dark:border-orange-800/50"
                    >
                        <History size={16} />
                        Vencidos (4-5 dias)
                    </button>

                    <div className="border-t border-gray-100 dark:border-gray-700 my-2"></div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Início</label>
                            <input 
                                type="date" 
                                value={expiredDates.start}
                                onChange={(e) => setExpiredDates({...expiredDates, start: e.target.value})}
                                className="w-full p-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-xs dark:text-white focus:ring-1 focus:ring-red-500 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Fim</label>
                            <input 
                                type="date" 
                                value={expiredDates.end}
                                onChange={(e) => setExpiredDates({...expiredDates, end: e.target.value})}
                                className="w-full p-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-xs dark:text-white focus:ring-1 focus:ring-red-500 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                            />
                        </div>
                    </div>

                    <button 
                      onClick={() => processData(expiredDates, true)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <Search size={16} /> Filtrar
                    </button>
                </div>
              </div>

              <button 
                onClick={() => setIsConfigOpen(true)}
                className="w-full bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <Settings size={16} /> Configurações
              </button>
            </div>
          </div>
        )}

        {/* ... (Rest of the render: Dashboard, Grid, HistorySidebar, etc) ... */}
        {viewMode === 'results' && resultViewMode !== 'focus' && (
          <div className="animate-fade-in-up">
            {/* Dashboard Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                        <Users size={16} className="text-primary" />
                        <span className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase">Clientes</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-white">{dashboardStats.total}</div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                        <CalendarCheck size={16} className="text-yellow-600" />
                        <span className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase">Hoje</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{dashboardStats.today}</div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={16} className="text-red-600" />
                        <span className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase">Vencidos</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{dashboardStats.expired}</div>
                </div>
            </div>

            {/* Result Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <button 
                  onClick={() => setViewMode('input')} 
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm hover:shadow-md transition-all font-bold text-sm group mb-2 active:scale-95"
                >
                  <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" /> Voltar
                </button>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">{resultTitle}</h2>
              </div>

              <div className="flex gap-2">
                <div className="relative group flex-1 md:flex-none">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Pesquisar..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-2 w-full md:w-56 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-1 focus:ring-primary outline-none text-sm shadow-sm"
                  />
                </div>
                <button 
                  onClick={handleExport}
                  className="flex items-center justify-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg transition-all text-sm font-medium"
                >
                  <Download size={14} /> <span className="hidden sm:inline">CSV</span>
                </button>
              </div>
            </div>

            {/* Results Grid/List */}
            <div className={resultViewMode === 'grid' ? "grid grid-cols-1 gap-3" : "flex flex-col gap-2"}>
              {getFilteredResults().length > 0 ? (
                getFilteredResults().map((client) => (
                  <ClientCard 
                    key={client.id} 
                    client={client} 
                    config={config} 
                    isExpiredMode={isExpiredMode}
                    viewMode={resultViewMode}
                    searchQuery={searchQuery}
                    isSent={!!sentClients[client.id]}
                    onEdit={setEditingClient}
                    onCopy={copyToClipboard}
                    onMarkAsSent={handleMarkAsSent}
                    onOpenReceipt={setReceiptClient}
                    onLinkClient={setLinkingClient}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                  <p className="text-sm font-medium">Nenhum resultado encontrado.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- FOCUS MODE OVERLAY --- */}
        {viewMode === 'results' && resultViewMode === 'focus' && getFilteredResults().length > 0 && (
            <div className="fixed inset-0 z-50 bg-gray-100 dark:bg-gray-900 flex flex-col animate-in fade-in">
                {/* Focus Header */}
                <div className="h-16 flex items-center justify-between px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={stopFocusMode}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <ArrowLeft size={24} className="text-gray-600 dark:text-gray-300" />
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Modo Foco</span>
                                {isQueueMode && (
                                    <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                        <Rocket size={10} /> FILA ATIVA
                                    </span>
                                )}
                            </div>
                            <span className="text-sm font-bold text-gray-800 dark:text-white">
                                {focusIndex + 1} de {getFilteredResults().length}
                            </span>
                        </div>
                    </div>
                    <div className="w-1/3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${((focusIndex + 1) / getFilteredResults().length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Focus Content */}
                <div className="flex-1 flex items-center justify-center p-2 sm:p-8 overflow-hidden">
                    <div className="w-full max-w-2xl h-full flex flex-col justify-center">
                        <ClientCard 
                            client={getFilteredResults()[focusIndex]} 
                            config={config} 
                            isExpiredMode={isExpiredMode}
                            viewMode="focus"
                            searchQuery={searchQuery}
                            isSent={!!sentClients[getFilteredResults()[focusIndex].id]}
                            onEdit={setEditingClient}
                            onCopy={copyToClipboard}
                            onMarkAsSent={handleMarkAsSent}
                            onOpenReceipt={setReceiptClient}
                            onLinkClient={setLinkingClient}
                        />
                    </div>
                </div>

                {/* Focus Controls */}
                <div className="h-20 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-6 px-4">
                    <button 
                        onClick={handleFocusPrev}
                        disabled={focusIndex === 0}
                        className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    
                    <span className="text-sm text-gray-400 font-medium">Navegar</span>

                    <button 
                        onClick={handleFocusNext}
                        disabled={focusIndex === getFilteredResults().length - 1}
                        className="p-3 rounded-full bg-primary hover:bg-primary-hover text-white shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all transform active:scale-95"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>
        )}
      </main>

      {/* Sidebars */}
      <HistorySidebar 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        history={actionHistory} 
      />
      
      <LinksSidebar 
        isOpen={isLinksOpen} 
        onClose={() => setIsLinksOpen(false)} 
        links={config.quickLinks || []} 
        onCopy={copyToClipboard}
        onManage={() => { setIsLinksOpen(false); setIsConfigOpen(true); }}
      />
      
      {/* Modals & Toasts */}
      <ConfigModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
        config={config} 
        onSave={(newConf) => { setConfig(newConf); setIsConfigOpen(false); addToast('Salvo', 'success'); }} 
      />
      
      <EditClientModal 
        isOpen={!!editingClient} 
        onClose={() => setEditingClient(null)} 
        client={editingClient} 
        config={config}
        onSave={handleEditSave} 
      />

      <ReceiptModal 
        isOpen={!!receiptClient} 
        onClose={() => setReceiptClient(null)} 
        client={receiptClient} 
        config={config}
        onConfirm={handleSendReceipt}
      />

      <LinkClientsModal 
        isOpen={!!linkingClient}
        onClose={() => setLinkingClient(null)}
        masterClient={linkingClient}
        allClients={flatResults}
        onSave={handleSaveLinks}
      />

      {/* Modal de Relatório de Números Inválidos */}
      {showInvalidReport && invalidClients.length > 0 && (
        <div className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col border border-red-200 dark:border-red-900/50">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertOctagon className="text-red-600 dark:text-red-400" size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
                    Envio Manual Necessário
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {invalidClients.length} cliente(s) com número inválido
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInvalidReport(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-2 flex-1">
              {invalidClients.map((c, idx) => (
                <div
                  key={`${c.name}-${idx}`}
                  className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                      {c.phone} <span className="text-red-500">({c.reason})</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <button
                onClick={() => {
                  const text = invalidClients
                    .map(c => `- ${c.name} | ${c.phone} (${c.reason})`)
                    .join('\n');
                  copyToClipboard(`⚠️ ENVIO MANUAL NECESSÁRIO:\n${text}`);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-all"
              >
                <Copy size={14} /> Copiar lista
              </button>
              <button
                onClick={() => setShowInvalidReport(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`
            pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-white text-sm font-medium animate-bounce-in backdrop-blur-md
            ${t.type === 'success' ? 'bg-green-600/90' : 
              t.type === 'error' ? 'bg-red-600/90' : 
              t.type === 'warning' ? 'bg-yellow-600/90' : 'bg-primary/90'}
          `}>
             {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
