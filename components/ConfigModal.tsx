
import React, { useState, useEffect, useRef } from 'react';
import { AppConfig, MessageTemplate, ClientTag, PricingPlan, QuickLink, PlanGroup } from '../types';
import { Save, X, Download, Upload, Clock, AlertTriangle, Plus, Trash2, FileText, Tag, CreditCard, Link as LinkIcon, Shield, HelpCircle, Check } from 'lucide-react';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (newConfig: AppConfig) => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'templates' | 'plans' | 'receipt' | 'tags' | 'links'>('general');
  const [selectedPlanGroup, setSelectedPlanGroup] = useState<string>('default');

  // New states for inline UI actions (replacing prompt/confirm)
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const newGroupInputRef = useRef<HTMLInputElement>(null);

  // Sync when opening
  useEffect(() => {
    if (isOpen) {
        setLocalConfig(config);
        // Ensure default group exists if not
        if (!config.planGroups || config.planGroups.length === 0) {
             setLocalConfig(prev => ({
                 ...prev,
                 planGroups: [{ id: 'default', label: '1 Tela (Padrão)', plans: prev.plans || [] }]
             }));
        }
    }
  }, [isOpen, config]);

  // Auto-focus input when adding group
  useEffect(() => {
      if (isAddingGroup && newGroupInputRef.current) {
          newGroupInputRef.current.focus();
      }
  }, [isAddingGroup]);

  const handleChange = (field: keyof AppConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  // --- Plan Groups Logic ---
  const handleAddPlanGroup = () => {
      setIsAddingGroup(true);
  };

  const handleSaveNewGroup = () => {
      if (!newGroupName.trim()) {
          setIsAddingGroup(false);
          return;
      }
      const newGroup: PlanGroup = {
          id: Date.now().toString(),
          label: newGroupName,
          plans: []
      };
      setLocalConfig(prev => ({
          ...prev,
          planGroups: [...(prev.planGroups || []), newGroup]
      }));
      setSelectedPlanGroup(newGroup.id);
      setIsAddingGroup(false);
      setNewGroupName('');
  };

  const handleCancelNewGroup = () => {
      setIsAddingGroup(false);
      setNewGroupName('');
  };

  const handleDeletePlanGroup = (groupId: string) => {
      if (groupId === 'default') {
          return; // Prevent deletion of default via UI check
      }
      // Removed confirm() to prevent browser blocking issues
      setLocalConfig(prev => ({
          ...prev,
          planGroups: prev.planGroups?.filter(g => g.id !== groupId) || []
      }));
      if (selectedPlanGroup === groupId) {
          setSelectedPlanGroup('default');
      }
  };

  const handleUpdateGroupTitle = (groupId: string, title: string) => {
      setLocalConfig(prev => ({
          ...prev,
          planGroups: (prev.planGroups || []).map(g => 
            g.id === groupId ? { ...g, title: title } : g
          )
      }));
  };

  // --- Plans Logic (Inside a Group) ---
  const handleAddPlanToGroup = (groupId: string) => {
    const newPlan: PricingPlan = {
      id: Date.now().toString(),
      label: '',
      price: 0
    };
    setLocalConfig(prev => ({
      ...prev,
      planGroups: (prev.planGroups || []).map(group => {
          if (group.id === groupId) {
              return { ...group, plans: [...group.plans, newPlan] };
          }
          return group;
      })
    }));
  };

  const handleUpdatePlanInGroup = (groupId: string, planId: string, field: keyof PricingPlan, value: string | number) => {
    setLocalConfig(prev => ({
      ...prev,
      planGroups: (prev.planGroups || []).map(group => {
          if (group.id === groupId) {
              return {
                  ...group,
                  plans: group.plans.map(p => p.id === planId ? { ...p, [field]: value } : p)
              };
          }
          return group;
      })
    }));
  };

  const handleDeletePlanFromGroup = (groupId: string, planId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      planGroups: (prev.planGroups || []).map(group => {
          if (group.id === groupId) {
              return { ...group, plans: group.plans.filter(p => p.id !== planId) };
          }
          return group;
      })
    }));
  };

  const handleTemplateChange = (key: keyof AppConfig['templates'], value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      templates: { ...prev.templates, [key]: value }
    }));
  };

  // --- Additional Templates Logic ---
  const handleAddTemplate = () => {
    const newTemplate: MessageTemplate = {
      id: Date.now().toString(),
      label: 'Novo Modelo',
      content: 'Olá {nome}...'
    };
    setLocalConfig(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        additional: [...(prev.templates.additional || []), newTemplate]
      }
    }));
  };

  const handleUpdateTemplate = (id: string, field: keyof MessageTemplate, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        additional: (prev.templates.additional || []).map(t => 
          t.id === id ? { ...t, [field]: value } : t
        )
      }
    }));
  };

  const handleDeleteTemplate = (id: string) => {
    // UI delete without native confirm
    setLocalConfig(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        additional: (prev.templates.additional || []).filter(t => t.id !== id)
      }
    }));
  };

  // --- Tags Logic ---
  const handleAddTag = () => {
    const newTag: ClientTag = {
        id: Date.now().toString(),
        label: 'Nova Tag',
        color: '#000000'
    };
    setLocalConfig(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag]
    }));
  };

  const handleUpdateTag = (id: string, field: keyof ClientTag, value: string) => {
    setLocalConfig(prev => ({
        ...prev,
        tags: (prev.tags || []).map(t => t.id === id ? { ...t, [field]: value } : t)
    }));
  };

  const handleDeleteTag = (id: string) => {
    setLocalConfig(prev => ({
        ...prev,
        tags: (prev.tags || []).filter(t => t.id !== id)
    }));
  };

  // --- Quick Links Logic ---
  const handleAddLink = () => {
    const newLink: QuickLink = {
        id: Date.now().toString(),
        label: 'Novo Link',
        url: ''
    };
    setLocalConfig(prev => ({
        ...prev,
        quickLinks: [...(prev.quickLinks || []), newLink]
    }));
  };

  const handleUpdateLink = (id: string, field: keyof QuickLink, value: string) => {
    setLocalConfig(prev => ({
        ...prev,
        quickLinks: (prev.quickLinks || []).map(l => l.id === id ? { ...l, [field]: value } : l)
    }));
  };

  const handleDeleteLink = (id: string) => {
    setLocalConfig(prev => ({
        ...prev,
        quickLinks: (prev.quickLinks || []).filter(l => l.id !== id)
    }));
  };

  // --- Backup & Restore Logic ---
  const BACKUP_KEYS = [
    'cobrancaConfig',
    'customNotes',
    'customMessages',
    'phoneOverrides',
    'clientTags',
    'clientLinks',
    'clientDatabase',
    'reminders',
    'sentClientsHistory',
    'actionHistory',
    'lastInputData',
    'themeElite',
    'unifiedStart',
    'unifiedEnd',
  ] as const;

  const handleBackup = () => {
    const backupData: Record<string, string | null> = { _version: '2', timestamp: new Date().toISOString() };
    for (const key of BACKUP_KEYS) {
      backupData[key] = localStorage.getItem(key);
    }
    // Always use latest config (unsaved changes included)
    backupData['cobrancaConfig'] = JSON.stringify(localConfig);

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_tvbrcob_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target?.result as string);
            if (!data.cobrancaConfig && !data.config) {
                alert('Arquivo de backup inválido.');
                return;
            }

            // Suporte ao formato antigo (v1) e novo (v2)
            const isV1 = !data._version;
            if (isV1) {
                // Formato antigo só tinha config, customNotes, clientTags
                if (data.config) localStorage.setItem('cobrancaConfig', JSON.stringify(data.config));
                if (data.customNotes) localStorage.setItem('customNotes', data.customNotes);
                if (data.clientTags) localStorage.setItem('clientTags', data.clientTags);
            } else {
                // Formato completo v2
                for (const key of BACKUP_KEYS) {
                    if (data[key] != null) {
                        localStorage.setItem(key, data[key] as string);
                    }
                }
            }

            alert('Backup restaurado! A página será recarregada para aplicar tudo.');
            window.location.reload();
        } catch (err) {
            alert('Erro ao ler arquivo de backup. Verifique se o arquivo é válido.');
        }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  const currentGroup = localConfig.planGroups?.find(g => g.id === selectedPlanGroup);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <SettingsIcon className="text-emerald-600" /> Configurações
          </h2>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 p-2 rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs - Horizontal Scrollable - Fix for mobile */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-x-auto overflow-y-hidden no-scrollbar flex-shrink-0">
            {[
                { id: 'general', label: 'Geral' },
                { id: 'templates', label: 'Mensagens' },
                { id: 'plans', label: 'Planos' },
                { id: 'receipt', label: 'Recibo' },
                { id: 'tags', label: 'Etiquetas' },
                { id: 'links', label: 'Links' }
            ].map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)} 
                    className={`flex-none sm:flex-1 py-3 px-4 text-sm font-medium transition-colors whitespace-nowrap border-t-2 border-b-0 border-x ${activeTab === tab.id ? 'bg-white dark:bg-gray-700 text-emerald-600 border-t-emerald-600 border-x-transparent border-b-transparent' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border-x-transparent border-t-transparent hover:border-b-transparent'}`}
                    style={{ borderRightColor: 'transparent', borderLeftColor: 'transparent' }} // Force transparent borders for inactive tabs
                >
                    {tab.label}
                </button>
            ))}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-8 flex-1 overflow-y-auto">
          
          {activeTab === 'general' && (
              <div className="space-y-6">
                 {/* Section: General Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section>
                        <h3 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Chave PIX
                        </h3>
                        <input 
                        type="text" 
                        value={localConfig.pixKey}
                        onChange={(e) => handleChange('pixKey', e.target.value)}
                        className="w-full p-3 rounded-xl bg-gray-100 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        placeholder="Seu e-mail, CPF ou telefone"
                        />
                    </section>

                    <section>
                        <h3 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Clock size={14} /> Horário de Vencimento
                        </h3>
                        <input 
                        type="time" 
                        value={localConfig.defaultTime || '20:00'}
                        onChange={(e) => handleChange('defaultTime', e.target.value)}
                        className="w-full p-3 rounded-xl bg-gray-100 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Horário padrão exibido nos cartões e mensagens.</p>
                    </section>
                </div>

                 {/* New: Anti-Ban Mode Toggle */}
                <section className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3">
                            <Shield className="text-blue-600 dark:text-blue-400 mt-1" size={20} />
                            <div>
                                <h3 className="text-sm font-bold text-gray-800 dark:text-white">Modo Anti-Banimento (WhatsApp)</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
                                    Insere caracteres invisíveis aleatórios na mensagem para tornar cada envio 100% único digitalmente, reduzindo o risco de bloqueio.
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={localConfig.antiBanMode || false}
                                onChange={(e) => handleChange('antiBanMode', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </section>

                {/* Section: Data Management */}
                <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex items-center gap-2 mb-4 text-orange-600 dark:text-orange-400">
                        <AlertTriangle size={18} />
                        <h3 className="text-sm font-semibold uppercase tracking-wider">Gerenciamento de Dados</h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-4">
                        <button
                        onClick={handleBackup}
                        className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 px-3 py-2.5 rounded-xl text-xs transition-colors"
                        >
                            <Download size={13} /> Baixar Backup (JSON)
                        </button>
                        <label className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer">
                            <Upload size={13} /> Restaurar Backup
                            <input 
                            ref={fileInputRef}
                            type="file" 
                            accept=".json" 
                            className="hidden" 
                            onChange={handleRestore}
                            />
                        </label>
                    </div>
                </section>
              </div>
          )}

          {activeTab === 'templates' && (
              <div className="space-y-6">
                 {/* Section: Standard Templates */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">Template Padrão (Normal)</h3>
                        <div className="text-[10px] text-gray-500 mb-2 leading-relaxed">
                            Variáveis: <code>{`{tabela_precos}`}</code>, <code>{`{saudacao}`}</code> (Bom dia/tarde...), <code>{`{titulo_tabela}`}</code> (Ex: {localConfig.plansTitle || 'TABELA DE PLANOS'} (2 Telas)).
                        </div>
                        <textarea 
                            value={localConfig.templates.normal}
                            onChange={(e) => handleTemplateChange('normal', e.target.value)}
                            rows={8}
                            className="w-full p-3 rounded-xl bg-gray-100 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:outline-none text-sm font-mono"
                        ></textarea>
                    </section>
                    <section>
                        <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-3">Template Padrão (Vencido)</h3>
                         <div className="text-[10px] text-gray-500 mb-2 leading-relaxed">
                            Variáveis: <code>{`{tabela_precos}`}</code>, <code>{`{saudacao}`}</code> (Bom dia/tarde...), <code>{`{titulo_tabela}`}</code> (Ex: {localConfig.plansTitle || 'TABELA DE PLANOS'} (2 Telas)).
                        </div>
                        <textarea 
                            value={localConfig.templates.expired}
                            onChange={(e) => handleTemplateChange('expired', e.target.value)}
                            rows={8}
                            className="w-full p-3 rounded-xl bg-gray-100 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:outline-none text-sm font-mono border-red-200 dark:border-red-900/30"
                        ></textarea>
                    </section>
                </div>

                {/* Section: Additional Templates */}
                <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Modelos Adicionais</h3>
                    <button
                        onClick={handleAddTemplate}
                        className="flex items-center gap-1.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 px-3 py-2.5 rounded-xl text-xs transition-colors"
                    >
                        <Plus size={13} /> Criar Modelo
                    </button>
                    </div>
                    
                    <div className="space-y-4">
                    {(localConfig.templates.additional || []).map((template) => (
                        <div key={template.id} className="bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <input 
                                type="text" 
                                value={template.label}
                                onChange={(e) => handleUpdateTemplate(template.id, 'label', e.target.value)}
                                className="flex-1 p-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="Nome do Modelo (Ex: Amigável)"
                                />
                                <button 
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="p-2 rounded-xl bg-gray-100 hover:bg-red-100 dark:bg-slate-700 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                                title="Excluir"
                                >
                                <Trash2 size={16} />
                                </button>
                            </div>
                            <textarea 
                                value={template.content}
                                onChange={(e) => handleUpdateTemplate(template.id, 'content', e.target.value)}
                                rows={4}
                                className="w-full p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none text-xs font-mono"
                                placeholder="Conteúdo da mensagem..."
                            ></textarea>
                        </div>
                    ))}
                    {(localConfig.templates.additional || []).length === 0 && (
                        <p className="text-xs text-gray-500 italic">Nenhum modelo adicional criado.</p>
                    )}
                    </div>
                </section>
              </div>
          )}

          {activeTab === 'plans' && (
              <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                      <div>
                        <h3 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                            <CreditCard size={16} /> Tabelas de Preços
                        </h3>
                        <p className="text-xs text-gray-500">Crie tabelas diferentes para clientes vinculados (Ex: 2 Telas).</p>
                      </div>
                      {!isAddingGroup && (
                        <button
                            onClick={handleAddPlanGroup}
                            className="flex items-center gap-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-600 dark:text-emerald-400 px-3 py-2.5 rounded-xl text-xs transition-colors"
                        >
                            <Plus size={13} /> Nova Tabela
                        </button>
                      )}
                  </div>

                  {/* Formatting Option & Table Title */}
                  <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50">
                           <div className="flex items-center gap-2 mb-1">
                               <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300">Título Base (Global)</h4>
                               <div className="group relative">
                                   <HelpCircle size={12} className="text-blue-500 cursor-help" />
                                   <div className="hidden group-hover:block absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-[10px] rounded shadow-lg z-50">
                                       Título padrão usado se o grupo não tiver um título específico. Ex: "TABELA DE PLANOS".
                                   </div>
                               </div>
                           </div>
                           <input 
                               type="text" 
                               value={localConfig.plansTitle || 'TABELA DE PLANOS'}
                               onChange={(e) => handleChange('plansTitle', e.target.value)}
                               className="w-full p-2 text-xs rounded-xl bg-gray-100 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                               placeholder="Ex: TABELA DE PLANOS"
                           />
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50">
                           <div className="flex items-center gap-2 mb-1">
                               <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300">Formato da Linha de Preço</h4>
                               <div className="group relative">
                                   <HelpCircle size={12} className="text-blue-500 cursor-help" />
                                   <div className="hidden group-hover:block absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-[10px] rounded shadow-lg z-50">
                                       Use {'{nome}'} para o nome do plano e {'{valor}'} para o preço. Ex: {'{nome} - R$ {valor}'}
                                   </div>
                               </div>
                           </div>
                           <input 
                               type="text" 
                               value={localConfig.priceLineFormat || '{nome} - R$ {valor}'}
                               onChange={(e) => handleChange('priceLineFormat', e.target.value)}
                               className="w-full p-2 text-xs font-mono rounded-xl bg-gray-100 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                           />
                      </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 h-full overflow-hidden">
                      {/* Sidebar / List of Groups */}
                      <div className="w-full md:w-1/3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[200px] md:max-h-none">
                          {(localConfig.planGroups || []).map(group => (
                              <div 
                                key={group.id}
                                onClick={() => setSelectedPlanGroup(group.id)}
                                className={`p-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 flex justify-between items-center hover:bg-gray-100 dark:hover:bg-gray-700/50 ${selectedPlanGroup === group.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''}`}
                              >
                                  <span className={`text-sm font-medium ${selectedPlanGroup === group.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                      {group.label}
                                  </span>
                                  {group.id !== 'default' && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeletePlanGroup(group.id); }}
                                        className="p-1.5 rounded-xl bg-gray-100 hover:bg-red-100 dark:bg-slate-700 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                                        title="Apagar Tabela"
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                  )}
                              </div>
                          ))}
                          
                          {/* Inline Add New Group Form */}
                          {isAddingGroup && (
                              <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 animate-in fade-in">
                                  <input
                                      ref={newGroupInputRef}
                                      type="text"
                                      value={newGroupName}
                                      onChange={(e) => setNewGroupName(e.target.value)}
                                      placeholder="Nome (Ex: 4 Telas)"
                                      className="w-full p-2 text-sm rounded-xl bg-gray-100 dark:bg-slate-800 mb-2 outline-none"
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveNewGroup();
                                          if (e.key === 'Escape') handleCancelNewGroup();
                                      }}
                                  />
                                  <div className="flex justify-end gap-2">
                                      <button
                                          onClick={handleCancelNewGroup}
                                          className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-500 dark:text-slate-400 transition-colors"
                                      >
                                          <X size={14} />
                                      </button>
                                      <button
                                          onClick={handleSaveNewGroup}
                                          className="p-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                                      >
                                          <Check size={14} />
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>

                      {/* Plans Editor */}
                      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
                          {currentGroup ? (
                              <>
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                                    <h4 className="font-bold text-gray-800 dark:text-white">{currentGroup.label}</h4>
                                    <button
                                        onClick={() => handleAddPlanToGroup(currentGroup.id)}
                                        className="flex items-center gap-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-3 py-2.5 rounded-xl text-xs transition-colors"
                                    >
                                        <Plus size={13} /> Adicionar Preço
                                    </button>
                                </div>

                                {/* Per-Group Title Override */}
                                <div className="mb-4 bg-gray-50 dark:bg-gray-700/30 p-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Título desta Tabela (Opcional)</label>
                                    <input 
                                        type="text" 
                                        value={currentGroup.title || ''}
                                        onChange={(e) => handleUpdateGroupTitle(currentGroup.id, e.target.value)}
                                        placeholder={`Padrão: ${localConfig.plansTitle} ${currentGroup.id !== 'default' ? `(${currentGroup.label})` : ''}`}
                                        className="w-full p-2 text-sm rounded-xl bg-gray-100 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Se preenchido, este título substituirá o padrão global apenas para este grupo.</p>
                                </div>

                                <div className="space-y-2 sm:space-y-3">
                                    {currentGroup.plans.map((plan) => (
                                        <div key={plan.id} className="flex items-center gap-2 sm:gap-3">
                                            <input 
                                                type="text" 
                                                value={plan.label}
                                                onChange={(e) => handleUpdatePlanInGroup(currentGroup.id, plan.id, 'label', e.target.value)}
                                                placeholder="Nome (ex: 1 Mês)"
                                                className="flex-1 min-w-0 p-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary outline-none"
                                            />
                                            <div className="relative w-24 sm:w-24 flex-shrink-0">
                                                <span className="absolute left-2.5 top-2 text-gray-400 text-xs">R$</span>
                                                <input 
                                                    type="number" 
                                                    value={plan.price}
                                                    onChange={(e) => handleUpdatePlanInGroup(currentGroup.id, plan.id, 'price', parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-7 p-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary outline-none"
                                                />
                                            </div>
                                            <button 
                                                onClick={() => handleDeletePlanFromGroup(currentGroup.id, plan.id)}
                                                className="p-2 rounded-xl bg-gray-100 hover:bg-red-100 dark:bg-slate-700 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                                                title="Remover Plano"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {currentGroup.plans.length === 0 && (
                                        <p className="text-center text-gray-400 text-xs py-4">Nenhum plano nesta tabela.</p>
                                    )}
                                </div>
                              </>
                          ) : (
                              <p className="text-center text-gray-400 mt-10">Selecione uma tabela à esquerda.</p>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'receipt' && (
              <div className="space-y-4">
                  <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg flex items-start gap-3 border border-orange-100 dark:border-orange-800">
                        <FileText className="text-orange-500 mt-1" size={20} />
                        <div>
                            <h3 className="text-sm font-bold text-orange-800 dark:text-orange-200">Modelo de Recibo</h3>
                            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                Este modelo é usado quando você clica no botão "Gerar Recibo" no card do cliente.
                            </p>
                        </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      <div className="bg-gray-100 dark:bg-gray-900/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                          Variáveis disponíveis: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{`{nome}`}</code> <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{`{data_vencimento}`}</code> <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{`{valor}`}</code>
                      </div>
                      <textarea 
                        value={localConfig.templates.receipt}
                        onChange={(e) => handleTemplateChange('receipt', e.target.value)}
                        rows={10}
                        className="w-full p-4 bg-white dark:bg-gray-800 focus:outline-none font-mono text-sm resize-y"
                        placeholder="Configure seu modelo de recibo aqui..."
                      />
                  </div>
              </div>
          )}

          {activeTab === 'tags' && (
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                           <Tag size={16} /> Etiquetas Personalizadas
                        </h3>
                        <p className="text-xs text-gray-500">Crie etiquetas para organizar seus clientes (VIP, Revenda, etc).</p>
                    </div>
                    <button
                        onClick={handleAddTag}
                        className="flex items-center gap-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-3 py-2.5 rounded-xl text-xs transition-colors"
                    >
                        <Plus size={13} /> Nova Tag
                    </button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     {(localConfig.tags || []).map((tag) => (
                         <div key={tag.id} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden relative">
                             <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl flex-shrink-0" style={{ backgroundColor: tag.color }} />
                             <label className="ml-1 cursor-pointer flex-shrink-0 relative" title="Alterar cor">
                                 <Tag size={18} style={{ color: tag.color }} />
                                 <input
                                    type="color"
                                    value={tag.color}
                                    onChange={(e) => handleUpdateTag(tag.id, 'color', e.target.value)}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                 />
                             </label>
                             <input
                                type="text"
                                value={tag.label}
                                onChange={(e) => handleUpdateTag(tag.id, 'label', e.target.value)}
                                className="flex-1 text-xs font-semibold bg-transparent border-none focus:ring-0 text-gray-800 dark:text-white outline-none min-w-0"
                                placeholder="Nome da Tag"
                             />
                             <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color + '22', color: tag.color }}>
                                 {tag.label || 'Tag'}
                             </span>
                             <button
                                onClick={() => handleDeleteTag(tag.id)}
                                className="p-1.5 rounded-xl bg-gray-100 hover:bg-red-100 dark:bg-slate-700 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                             >
                                <Trash2 size={13} />
                             </button>
                         </div>
                     ))}
                     {(localConfig.tags || []).length === 0 && (
                         <div className="col-span-full text-center py-10 text-gray-400 dark:text-slate-600 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                             <Tag size={24} className="mx-auto mb-2 opacity-30" />
                             <p className="text-xs">Nenhuma etiqueta criada.</p>
                         </div>
                     )}
                 </div>
              </div>
          )}

          {activeTab === 'links' && (
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                           <LinkIcon size={16} /> Banco de Links Rápidos
                        </h3>
                        <p className="text-xs text-gray-500">Links úteis para copiar rapidamente (Tutoriais, Apps, Redes Sociais).</p>
                    </div>
                    <button
                        onClick={handleAddLink}
                        className="flex items-center gap-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-3 py-2.5 rounded-xl text-xs transition-colors"
                    >
                        <Plus size={13} /> Novo Link
                    </button>
                 </div>

                 <div className="space-y-3">
                     {(localConfig.quickLinks || []).map((link) => (
                         <div key={link.id} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
                             <input 
                                type="text"
                                value={link.label}
                                onChange={(e) => handleUpdateLink(link.id, 'label', e.target.value)}
                                className="w-1/3 text-sm font-bold bg-gray-100 dark:bg-slate-800 rounded-xl p-2 focus:ring-1 focus:ring-blue-500 outline-none text-gray-800 dark:text-white"
                                placeholder="Nome (ex: App Android)"
                             />
                             <input 
                                type="text"
                                value={link.url}
                                onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)}
                                className="flex-1 text-xs bg-transparent border-none focus:ring-0 text-blue-600 dark:text-blue-400 font-mono"
                                placeholder="https://..."
                             />
                             <button 
                                onClick={() => handleDeleteLink(link.id)}
                                className="p-1.5 rounded-xl bg-gray-100 hover:bg-red-100 dark:bg-slate-700 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                             >
                                <Trash2 size={16} />
                             </button>
                         </div>
                     ))}
                     {(localConfig.quickLinks || []).length === 0 && (
                         <div className="col-span-full text-center py-8 text-gray-400 italic bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                             Nenhum link cadastrado.
                         </div>
                     )}
                 </div>
              </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end flex-shrink-0">
            <button 
                onClick={() => onSave(localConfig)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-600 text-white px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors"
            >
                <Save size={18} />
                Salvar Configurações
            </button>
        </div>
      </div>
    </div>
  );
};

// Icon helper
const SettingsIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

export default ConfigModal;
