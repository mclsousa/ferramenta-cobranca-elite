
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Sun, Moon, Filter, Trash2, Search, ArrowLeft, Download, Settings, Users,
  CalendarX, AlertTriangle, Info, CalendarCheck, LayoutGrid, LayoutList,
  History, Play, X, ChevronLeft, ChevronRight, CheckCircle, Clock, Link as LinkIcon, Copy, MessageSquare, ExternalLink,
  Clipboard, Rocket, Upload, AlertOctagon, Menu, Database, DollarSign, Bell
} from 'lucide-react';
import { ParsedClient, AppConfig, ViewMode, ResultViewMode, ToastMessage, DateRange, ActionLog, PaymentRecord, StoredClient, Reminder } from './types';
import { DEFAULT_CONFIG } from './constants';
import { parseClientData, detectInputType, normalizeCsvIfNeeded } from './utils/parser';
import { extractPhone, extractPhoneValidated, generateCSV, formatDateShort, toInputDate, formatCurrency, padZero, formatDate } from './utils/helpers';
import { getWeekdayContext, getUpcomingRange } from './utils/calendar';
import ClientCard from './components/ClientCard';
import ConfigModal from './components/ConfigModal';
import EditClientModal from './components/EditClientModal';
import ReceiptModal from './components/ReceiptModal';
import LinkClientsModal from './components/LinkClientsModal';
import PaymentModal from './components/PaymentModal';
import ReminderModal from './components/ReminderModal';
import DatabaseModal from './components/DatabaseModal';
import { HistorySidebar, LinksSidebar } from './components/Sidebars';

function App() {
  // --- Theme State ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('themeElite');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  // --- Feature: Pagamentos ---
  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('paymentsLog');
      if (!saved) return [];
      const parsed: PaymentRecord[] = JSON.parse(saved);
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      return parsed.filter(p => Date.now() - p.paidAt < thirtyDays);
    } catch { return []; }
  });
  const [payingClient, setPayingClient] = useState<ParsedClient | null>(null);

  // --- Feature: Banco de Clientes ---
  const [clientDatabase, setClientDatabase] = useState<StoredClient[]>(() => {
    try {
      const saved = localStorage.getItem('clientDatabase');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false);

  // --- Feature: Lembretes ---
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const saved = localStorage.getItem('reminders');
      if (!saved) return [];
      const parsed: Reminder[] = JSON.parse(saved);
      return parsed.filter(r => !r.fired || Date.now() - r.scheduledFor < 24 * 60 * 60 * 1000);
    } catch { return []; }
  });
  const [reminderClient, setReminderClient] = useState<ParsedClient | null>(null);

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
    localStorage.setItem('themeElite', isDarkMode ? 'dark' : 'light');
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

  useEffect(() => {
    localStorage.setItem('paymentsLog', JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem('clientDatabase', JSON.stringify(clientDatabase));
  }, [clientDatabase]);

  useEffect(() => {
    localStorage.setItem('reminders', JSON.stringify(reminders));
  }, [reminders]);

  // Dispara lembretes pendentes ao carregar e agenda os futuros da sessão
  useEffect(() => {
    const now = Date.now();
    const pending = reminders.filter(r => !r.fired);
    pending.forEach(r => {
      const delay = r.scheduledFor - now;
      if (delay <= 0) {
        addToast(`⏰ Lembrete: ${r.clientName}`, 'warning');
        setReminders(prev => prev.map(x => x.id === r.id ? { ...x, fired: true } : x));
      } else if (delay < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          addToast(`⏰ Lembrete: ${r.clientName}`, 'warning');
          if (Notification.permission === 'granted') {
            new Notification('Cobrança Elite', { body: `Hora de cobrar: ${r.clientName}`, icon: '/favicon.ico' });
          }
          setReminders(prev => prev.map(x => x.id === r.id ? { ...x, fired: true } : x));
        }, delay);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    saveToDatabase(preparedClients);
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

    const potentialRevenue = totalAccounts * (config.plans?.[0]?.price || 35);
    return { total: totalCards, expired, today: expiringToday, potentialRevenue };
  }, [results, searchQuery, config.plans]);

  const todayRevenue = useMemo(() => {
    const todayStr = new Date().toDateString();
    return payments
      .filter(p => new Date(p.paidAt).toDateString() === todayStr)
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

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

  // --- Handlers: Pagamentos ---
  const handleMarkAsPaid = (client: ParsedClient, amount: number) => {
    const record: PaymentRecord = {
      id: crypto.randomUUID(),
      clientId: client.id,
      clientName: client.name,
      amount,
      paidAt: Date.now(),
    };
    setPayments(prev => [...prev, record]);
    addToast(`💰 ${client.name} — R$ ${amount.toFixed(2)} registrado`, 'success');
  };

  // --- Handlers: Banco de Clientes ---
  const saveToDatabase = (parsed: ParsedClient[]) => {
    setClientDatabase(prev => {
      const existingNames = new Set(prev.map(c => c.name.toLowerCase()));
      const newEntries: StoredClient[] = parsed
        .filter(c => !existingNames.has(c.name.toLowerCase()))
        .map(c => ({
          id: crypto.randomUUID(),
          name: c.name,
          rawNotes: c.rawNotes,
          type: c.type,
          savedAt: Date.now(),
        }));
      // Atualiza data de clientes já existentes
      const updated = prev.map(stored => {
        const match = parsed.find(c => c.name.toLowerCase() === stored.name.toLowerCase());
        return match ? { ...stored, rawNotes: match.rawNotes, savedAt: Date.now() } : stored;
      });
      return [...updated, ...newEntries];
    });
  };

  const handleLoadFromDatabase = (rawNotes: string) => {
    setInputData(prev => {
      const clean = prev.trim();
      return clean ? clean + '\n' + rawNotes : rawNotes;
    });
    addToast('Clientes carregados no painel', 'success');
  };

  const handleRemoveFromDatabase = (id: string) => {
    setClientDatabase(prev => prev.filter(c => c.id !== id));
  };

  const handleClearDatabase = () => {
    setClientDatabase([]);
    addToast('Banco limpo', 'info');
  };

  // --- Handlers: Lembretes ---
  const handleAddReminder = (client: ParsedClient, scheduledFor: number) => {
    const reminder: Reminder = {
      id: crypto.randomUUID(),
      clientId: client.id,
      clientName: client.name,
      scheduledFor,
      fired: false,
    };
    setReminders(prev => {
      const withoutOld = prev.filter(r => r.clientId !== client.id);
      return [...withoutOld, reminder];
    });
    const delay = scheduledFor - Date.now();
    if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        addToast(`⏰ Lembrete: ${client.name}`, 'warning');
        if (Notification.permission === 'granted') {
          new Notification('Cobrança Elite', { body: `Hora de cobrar: ${client.name}`, icon: '/favicon.ico' });
        }
        setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, fired: true } : r));
      }, delay);
    }
    const dt = new Date(scheduledFor);
    const label = dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    addToast(`🔔 Lembrete agendado: ${label}`, 'info');
  };

  const stopFocusMode = () => {
      setResultViewMode('grid');
      setIsQueueMode(false);
      // Ao sair, mostra o relatório de inválidos se houver
      if (invalidClients.length > 0) setShowInvalidReport(true);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-slate-950 text-gray-800 dark:text-slate-100 overflow-hidden">
      
      {/* ── HEADER ── */}
      <header className="flex-shrink-0 z-40 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 h-14 flex items-center px-3 sm:px-5 justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Hambúrguer — só aparece no mobile */}
          <button
            onClick={() => setIsSidebarOpen(v => !v)}
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-100 transition-colors"
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>
          <div className="p-1.5 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg shadow-lg shadow-emerald-500/20 text-white">
            <Users size={16} />
          </div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
            Cobrança <span className="text-emerald-500 dark:text-emerald-400">Elite</span>
          </h1>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {results.length > 0 && resultViewMode !== 'focus' && (
            <>
              <button onClick={() => setIsLinksOpen(true)} className="hidden sm:flex p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title="Links Rápidos">
                <LinkIcon size={17} />
              </button>
              <button onClick={() => setIsHistoryOpen(true)} className="hidden sm:flex p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-100 transition-colors relative" title="Histórico">
                <History size={17} />
                {actionHistory.length > 0 && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>}
              </button>
              <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-slate-700 mx-0.5" />
              <button onClick={() => startFocusMode(true)} className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-amber-500/20" title="Fila">
                <Rocket size={13} /> <span className="hidden sm:inline">Fila</span>
              </button>
              <button onClick={() => startFocusMode(false)} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-violet-900/30 active:scale-95" title="Foco">
                <Play size={13} fill="currentColor" /> <span className="hidden sm:inline">Foco</span>
              </button>
              <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5 border border-gray-200 dark:border-slate-700">
                <button onClick={() => setResultViewMode('grid')} className={`p-1.5 rounded transition-all ${resultViewMode === 'grid' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}`} title="Grade"><LayoutGrid size={15} /></button>
                <button onClick={() => setResultViewMode('list')} className={`p-1.5 rounded transition-all ${resultViewMode === 'list' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}`} title="Lista"><LayoutList size={15} /></button>
              </div>
            </>
          )}
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-500 hover:text-gray-800 dark:hover:text-slate-300 transition-colors" title={isDarkMode ? 'Modo claro' : 'Modo escuro'}>
            {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Backdrop mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ── SIDEBAR ── */}
        <aside className={`
          fixed md:relative inset-y-0 left-0 z-50
          w-[85vw] max-w-sm md:w-80 flex-shrink-0
          bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800
          flex flex-col overflow-hidden
          transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          {/* Cabeçalho da sidebar (mobile: mostra fechar) */}
          <div className="flex-shrink-0 md:hidden flex items-center justify-between px-5 pt-5 pb-3">
            <span className="text-sm font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Painel</span>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Aviso Sexta */}
            {weekday.mode === 'friday_double' && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-start gap-2.5">
                <Info size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-300 leading-snug">Sexta: amanhã + depois de amanhã serão incluídos</p>
              </div>
            )}

            {/* Entrada de Dados */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Dados</span>
                <div className="flex gap-1.5">
                  <input type="file" accept=".csv,.txt,.tsv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                    <Upload size={13} /> Arquivo
                  </button>
                  <button onClick={handlePasteInput} className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                    <Clipboard size={13} /> Colar
                  </button>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
                placeholder="Cole aqui a lista (IPTV ou P2P)..."
                className="w-full h-36 p-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none font-mono text-xs placeholder-gray-400 dark:placeholder-slate-600 transition-all leading-relaxed"
              />
            </div>

            {/* Filtro principal */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Filtro</span>
              <button onClick={() => { handleFilterUpcoming(); setIsSidebarOpen(false); }} className="w-full bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-600/20 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                <CalendarCheck size={16} />
                {weekday.mode === 'friday_double' ? 'Próximos (Amanhã + Depois)' : 'Próximos (Amanhã)'}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-500 mb-1.5">Início</label>
                  <input type="date" value={unifiedDates.start} onChange={(e) => setUnifiedDates({...unifiedDates, start: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:[color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-500 mb-1.5">Fim</label>
                  <input type="date" value={unifiedDates.end} onChange={(e) => setUnifiedDates({...unifiedDates, end: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:[color-scheme:dark]" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { processData(unifiedDates, false); setIsSidebarOpen(false); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-xl text-sm font-bold transition-all active:scale-[0.97] flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
                  <Filter size={15} /> Processar
                </button>
                <button onClick={() => { setInputData(''); setUnifiedDates({start:'',end:''}); setResults([]); setFlatResults([]); addToast('Limpo','info'); }} className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 py-3 px-3.5 rounded-xl transition-all" title="Limpar">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-800" />

            {/* Vencidos */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <CalendarX size={14} className="text-red-500" /> Vencidos
              </span>
              <button onClick={() => { handleFilterExpiredRecent(); setIsSidebarOpen(false); }} className="w-full bg-red-500/8 hover:bg-red-500/15 text-red-500 dark:text-red-400 border border-red-500/20 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                <History size={16} /> Vencidos (4-5 dias)
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-500 mb-1.5">Início</label>
                  <input type="date" value={expiredDates.start} onChange={(e) => setExpiredDates({...expiredDates, start: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-red-500 dark:[color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-500 mb-1.5">Fim</label>
                  <input type="date" value={expiredDates.end} onChange={(e) => setExpiredDates({...expiredDates, end: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-red-500 dark:[color-scheme:dark]" />
                </div>
              </div>
              <button onClick={() => { processData(expiredDates, true); setIsSidebarOpen(false); }} className="w-full bg-red-600 hover:bg-red-500 text-white py-3 px-4 rounded-xl text-sm font-bold transition-all active:scale-[0.97] flex items-center justify-center gap-2 shadow-lg shadow-red-900/20">
                <Search size={15} /> Filtrar Vencidos
              </button>
            </div>

          </div>

          {/* Footer da sidebar */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-slate-800 p-4 space-y-2">
            <button onClick={() => setIsDatabaseOpen(true)} className="w-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
              <Database size={16} />
              Banco de Clientes
              {clientDatabase.length > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{clientDatabase.length}</span>
              )}
            </button>
            <button onClick={() => setIsConfigOpen(true)} className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2">
              <Settings size={16} /> Configurações
            </button>
          </div>
        </aside>

        {/* ── ÁREA PRINCIPAL ── */}
        <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-slate-950">
          {results.length === 0 ? (
            <div className="h-full flex items-center justify-center p-6 sm:p-8">
              <div className="text-center space-y-5 max-w-xs">
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/50 flex items-center justify-center mx-auto shadow-sm">
                  <Users size={30} className="text-gray-400 dark:text-slate-600" />
                </div>
                <div>
                  <p className="text-gray-700 dark:text-slate-300 font-semibold">Pronto para cobrar</p>
                  <p className="text-gray-500 dark:text-slate-500 text-sm mt-1 md:hidden">Abra o <span className="text-emerald-600 dark:text-emerald-400 font-medium">menu</span>, cole a lista e clique em <span className="text-emerald-600 dark:text-emerald-400 font-medium">Processar</span></p>
                  <p className="text-gray-500 dark:text-slate-500 text-sm mt-1 hidden md:block">Cole a lista no painel e clique em <span className="text-emerald-600 dark:text-emerald-400 font-medium">Processar</span></p>
                </div>
                <div className="flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-slate-600">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> IPTV</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-500" /> P2P</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> CSV</span>
                </div>
              </div>
            </div>
          ) : resultViewMode !== 'focus' ? (
            <div className="p-3 sm:p-6 animate-fade-in-up">
              {/* Dashboard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5 sm:mb-6">
                <div className="bg-white dark:bg-slate-800/60 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-slate-700/40 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1.5"><Users size={13} className="text-emerald-500 dark:text-emerald-400" /><span className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">Clientes</span></div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{dashboardStats.total}</div>
                </div>
                <div className="bg-white dark:bg-slate-800/60 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-slate-700/40 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1.5"><CalendarCheck size={13} className="text-amber-500 dark:text-amber-400" /><span className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">Hoje</span></div>
                  <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{dashboardStats.today}</div>
                </div>
                <div className="bg-white dark:bg-slate-800/60 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-slate-700/40 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1.5"><AlertTriangle size={13} className="text-red-500 dark:text-red-400" /><span className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">Vencidos</span></div>
                  <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{dashboardStats.expired}</div>
                </div>
                <div className="bg-white dark:bg-slate-800/60 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-slate-700/40 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1.5"><CheckCircle size={13} className="text-emerald-500 dark:text-emerald-400" /><span className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">Recebido</span></div>
                  <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {todayRevenue > 0 ? `R$ ${todayRevenue.toFixed(2)}` : <span className="text-gray-400 dark:text-slate-600 text-base">—</span>}
                  </div>
                </div>
              </div>

              {/* Toolbar resultados */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-5">
                <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300">{resultTitle}</h2>
                <div className="flex gap-2">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={13} />
                    <input type="text" placeholder="Pesquisar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-2 w-full sm:w-44 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 text-sm placeholder-gray-400 dark:placeholder-slate-600 focus:ring-1 focus:ring-emerald-500 outline-none" />
                  </div>
                  <button onClick={handleExport} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 px-3 py-2 rounded-lg transition-all text-xs font-medium flex-shrink-0">
                    <Download size={13} /> CSV
                  </button>
                </div>
              </div>

              {/* Cards */}
              <div className={resultViewMode === 'grid' ? "grid grid-cols-1 gap-3" : "flex flex-col gap-2"}>
                {getFilteredResults().length > 0 ? getFilteredResults().map((client) => (
                  <ClientCard key={client.id} client={client} config={config} isExpiredMode={isExpiredMode} viewMode={resultViewMode} searchQuery={searchQuery} isSent={!!sentClients[client.id]} isPaid={payments.some(p => p.clientId === client.id && new Date(p.paidAt).toDateString() === new Date().toDateString())} hasReminder={reminders.some(r => r.clientId === client.id && !r.fired)} onEdit={setEditingClient} onCopy={copyToClipboard} onMarkAsSent={handleMarkAsSent} onOpenReceipt={setReceiptClient} onLinkClient={setLinkingClient} onMarkAsPaid={setPayingClient} onAddReminder={setReminderClient} />
                )) : (
                  <div className="text-center py-16 text-gray-500 dark:text-slate-600 bg-white dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                    <p className="text-sm font-medium">Nenhum resultado encontrado.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {/* ── MODO FOCO ── */}
      {resultViewMode === 'focus' && getFilteredResults().length > 0 && (
        <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-slate-950 flex flex-col">
          <div className="h-14 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <button onClick={stopFocusMode} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <ArrowLeft size={20} className="text-gray-700 dark:text-slate-300" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 dark:text-slate-500 uppercase font-bold tracking-wider">Modo Foco</span>
                  {isQueueMode && <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><Rocket size={9} /> FILA</span>}
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{focusIndex + 1} / {getFilteredResults().length}</span>
              </div>
            </div>
            <div className="w-48 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${((focusIndex + 1) / getFilteredResults().length) * 100}%` }} />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 sm:p-10 overflow-hidden">
            <div className="w-full max-w-2xl h-full flex flex-col justify-center">
              <ClientCard client={getFilteredResults()[focusIndex]} config={config} isExpiredMode={isExpiredMode} viewMode="focus" searchQuery={searchQuery} isSent={!!sentClients[getFilteredResults()[focusIndex].id]} isPaid={payments.some(p => p.clientId === getFilteredResults()[focusIndex].id && new Date(p.paidAt).toDateString() === new Date().toDateString())} hasReminder={reminders.some(r => r.clientId === getFilteredResults()[focusIndex].id && !r.fired)} onEdit={setEditingClient} onCopy={copyToClipboard} onMarkAsSent={handleMarkAsSent} onOpenReceipt={setReceiptClient} onLinkClient={setLinkingClient} onMarkAsPaid={setPayingClient} onAddReminder={setReminderClient} />
            </div>
          </div>
          <div className="h-20 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex items-center justify-center gap-6">
            <button onClick={handleFocusPrev} disabled={focusIndex === 0} className="p-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all"><ChevronLeft size={22} /></button>
            <span className="text-xs text-gray-400 dark:text-slate-600 font-medium">Navegar</span>
            <button onClick={handleFocusNext} disabled={focusIndex === getFilteredResults().length - 1} className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95"><ChevronRight size={22} /></button>
          </div>
        </div>
      )}

      {/* ── SIDEBARS ── */}
      <HistorySidebar isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={actionHistory} />
      <LinksSidebar isOpen={isLinksOpen} onClose={() => setIsLinksOpen(false)} links={config.quickLinks || []} onCopy={copyToClipboard} onManage={() => { setIsLinksOpen(false); setIsConfigOpen(true); }} />

      {/* ── NOVOS MODAIS ── */}
      <PaymentModal
        client={payingClient}
        onClose={() => setPayingClient(null)}
        onConfirm={handleMarkAsPaid}
      />
      <ReminderModal
        client={reminderClient}
        defaultTime={config.defaultTime || '20:00'}
        onClose={() => setReminderClient(null)}
        onConfirm={handleAddReminder}
      />
      <DatabaseModal
        isOpen={isDatabaseOpen}
        onClose={() => setIsDatabaseOpen(false)}
        clients={clientDatabase}
        onLoad={handleLoadFromDatabase}
        onRemove={handleRemoveFromDatabase}
        onClearAll={handleClearDatabase}
      />

      {/* ── MODAIS ── */}
      <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} config={config} onSave={(newConf) => { setConfig(newConf); setIsConfigOpen(false); addToast('Salvo', 'success'); }} />
      <EditClientModal isOpen={!!editingClient} onClose={() => setEditingClient(null)} client={editingClient} config={config} onSave={handleEditSave} />
      <ReceiptModal isOpen={!!receiptClient} onClose={() => setReceiptClient(null)} client={receiptClient} config={config} onConfirm={handleSendReceipt} />
      <LinkClientsModal isOpen={!!linkingClient} onClose={() => setLinkingClient(null)} masterClient={linkingClient} allClients={flatResults} onSave={handleSaveLinks} />

      {/* Relatório de Inválidos */}
      {showInvalidReport && invalidClients.length > 0 && (
        <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col border border-gray-200 dark:border-slate-700">
            <div className="p-5 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-xl"><AlertOctagon className="text-red-400" size={18} /></div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">Envio Manual Necessário</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{invalidClients.length} cliente(s) com número inválido</p>
                </div>
              </div>
              <button onClick={() => setShowInvalidReport(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2 flex-1">
              {invalidClients.map((c, idx) => (
                <div key={`${c.name}-${idx}`} className="p-3 bg-red-50 dark:bg-red-500/5 rounded-lg border border-red-200 dark:border-red-900/30">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-mono">{c.phone} <span className="text-red-600 dark:text-red-400">({c.reason})</span></p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex gap-2">
              <button onClick={() => { const text = invalidClients.map(c => `- ${c.name} | ${c.phone} (${c.reason})`).join('\n'); copyToClipboard(`⚠️ ENVIO MANUAL NECESSÁRIO:\n${text}`); }} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-all">
                <Copy size={13} /> Copiar lista
              </button>
              <button onClick={() => setShowInvalidReport(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOASTS ── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full shadow-xl text-white text-sm font-medium animate-bounce-in ${t.type === 'success' ? 'bg-emerald-600' : t.type === 'error' ? 'bg-red-600' : t.type === 'warning' ? 'bg-amber-600' : 'bg-gray-700'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
