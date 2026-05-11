
import React, { useState, useEffect } from 'react';
import { ParsedClient, AppConfig } from '../types';
import { Save, X, Sparkles, RefreshCcw, Tag } from 'lucide-react';
import { extractPhone, formatDate } from '../utils/helpers';

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ParsedClient | null;
  config: AppConfig;
  onSave: (updatedClient: ParsedClient) => void;
}

const EditClientModal: React.FC<EditClientModalProps> = ({ isOpen, onClose, client, config, onSave }) => {
  const [formData, setFormData] = useState<{
    name: string;
    dueDate: string;
    phone: string;
    notesWithoutPhone: string;
    customNotes: string;
    customMessage: string;
    tags: string[];
  }>({ name: '', dueDate: '', phone: '', notesWithoutPhone: '', customNotes: '', customMessage: '', tags: [] });

  useEffect(() => {
    if (client) {
      const { cleanText, original: originalPhone } = extractPhone(client.rawNotes);
      // Format date for input type="date" (YYYY-MM-DD)
      const yyyy = client.dueDate.getFullYear();
      const mm = String(client.dueDate.getMonth() + 1).padStart(2, '0');
      const dd = String(client.dueDate.getDate()).padStart(2, '0');

      setFormData({
        name: client.name,
        dueDate: `${yyyy}-${mm}-${dd}`,
        phone: originalPhone,
        notesWithoutPhone: cleanText,
        customNotes: client.customNotes || '',
        customMessage: client.customMessage || '',
        tags: client.tags || []
      });
    }
  }, [client, isOpen]);

  const generateDefaultMessage = () => {
    if (!client) return;
    
    // Determine which template to use based on current form date
    const [y, m, d] = formData.dueDate.split('-').map(Number);
    const venc = new Date(y, m - 1, d);
    
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const vencCheck = new Date(venc);
    vencCheck.setHours(0,0,0,0);
    
    const isExpired = vencCheck < hoje;
    const template = isExpired ? config.templates.expired : config.templates.normal;

    // Load the template with Dynamic Tags PRESERVED ({nome}, {vencimento})
    let preFilled = template
      .replace(/{pix}/g, config.pixKey);
      
    // Legacy replacement support if template still has them, though new uses {tabela_precos} handled by ClientCard.
    // However, when editing a custom message, the user probably wants the prices hardcoded in the text or the placeholder {tabela_precos}.
    // We will leave {tabela_precos} as is, so it updates dynamically.
    
    // Legacy support for fixed indices if they exist in the template
    if (config.plans) {
        if (config.plans.length > 0) preFilled = preFilled.replace(/{plano1}/g, String(config.plans[0].price));
        if (config.plans.length > 1) preFilled = preFilled.replace(/{plano2}/g, String(config.plans[1].price));
        if (config.plans.length > 2) preFilled = preFilled.replace(/{plano3}/g, String(config.plans[2].price));
        if (config.plans.length > 3) preFilled = preFilled.replace(/{plano6}/g, String(config.plans[3].price));
    }

    setFormData(prev => ({ ...prev, customMessage: preFilled }));
  };

  const toggleTag = (tagId: string) => {
    setFormData(prev => {
        const exists = prev.tags.includes(tagId);
        return {
            ...prev,
            tags: exists ? prev.tags.filter(t => t !== tagId) : [...prev.tags, tagId]
        };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    // Reconstruct date
    const [y, m, d] = formData.dueDate.split('-').map(Number);
    const newDate = new Date(client.dueDate);
    newDate.setFullYear(y);
    newDate.setMonth(m - 1);
    newDate.setDate(d);

    // Reconstruct raw notes
    let newRawNotes = formData.notesWithoutPhone;
    if (formData.phone) {
      newRawNotes = `${formData.phone} ${newRawNotes}`.trim();
    }

    onSave({
      ...client,
      name: formData.name,
      dueDate: newDate,
      rawNotes: newRawNotes,
      customNotes: formData.customNotes,
      customMessage: formData.customMessage,
      tags: formData.tags
    });
  };

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Editar Cliente</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          <form id="edit-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* Tags Selection */}
            {config.tags && config.tags.length > 0 && (
                <div>
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                        <Tag size={14} /> Etiquetas (Tags)
                     </label>
                     <div className="flex flex-wrap gap-2">
                        {config.tags.map(tag => {
                            const isActive = formData.tags.includes(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => toggleTag(tag.id)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${isActive ? 'ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-gray-400' : 'opacity-60 grayscale'}`}
                                    style={{ 
                                        backgroundColor: tag.color, 
                                        color: '#fff',
                                        borderColor: tag.color
                                    }}
                                >
                                    {tag.label}
                                </button>
                            );
                        })}
                     </div>
                </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Vencimento</label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={e => setFormData({...formData, dueDate: e.target.value})}
                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas (Exceto telefone)</label>
              <input 
                type="text" 
                value={formData.notesWithoutPhone}
                onChange={e => setFormData({...formData, notesWithoutPhone: e.target.value})}
                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observação Adicional (Privada)</label>
              <textarea
                rows={2}
                value={formData.customNotes}
                onChange={e => setFormData({...formData, customNotes: e.target.value})}
                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary focus:outline-none text-sm"
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone / WhatsApp</label>
              <input
                type="text"
                placeholder="+55..."
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* Custom Message Section */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                        <Sparkles size={14} /> Mensagem Personalizada
                    </label>
                    <button 
                        type="button"
                        onClick={generateDefaultMessage}
                        className="text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        title="Carregar modelo atual (mantendo tags dinâmicas)"
                    >
                        <RefreshCcw size={10} /> Carregar Padrão
                    </button>
                </div>
                <textarea 
                  rows={6}
                  value={formData.customMessage}
                  onChange={e => setFormData({...formData, customMessage: e.target.value})}
                  placeholder="Você pode usar {nome} e {vencimento} para que eles sejam preenchidos automaticamente."
                  className="w-full p-2.5 rounded-lg border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-900/10 focus:ring-2 focus:ring-purple-500 focus:outline-none text-xs font-mono"
                ></textarea>
                <p className="text-[10px] text-gray-400 mt-1">
                    Mantenha <strong>{`{nome}`}</strong> e <strong>{`{vencimento}`}</strong> para cálculo automático da data.
                </p>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
            <button 
                type="submit"
                form="edit-form"
                className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97]"
            >
                <Save size={13} />
                Salvar Alterações
            </button>
        </div>
      </div>
    </div>
  );
};

export default EditClientModal;
