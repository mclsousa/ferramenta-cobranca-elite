
import React, { useState, useMemo } from 'react';
import { StoredClient } from '../types';
import { Database, Search, Trash2, X, Download, Upload, RotateCcw } from 'lucide-react';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: StoredClient[];
  onLoad: (clients: StoredClient[]) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

const DatabaseModal: React.FC<DatabaseModalProps> = ({ isOpen, onClose, clients, onLoad, onRemove, onClearAll }) => {
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(q));
  }, [clients, search]);

  if (!isOpen) return null;

  const handleLoadAll = () => {
    onLoad(filtered);
    onClose();
  };

  const handleLoadOne = (c: StoredClient) => {
    onLoad([c]);
    onClose();
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });

  const typeLabel = (type: string) => type === 'iptv' ? 'IPTV' : 'P2P';
  const typeBg = (type: string) => type === 'iptv'
    ? 'bg-emerald-600/15 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-gray-200 dark:border-slate-700 animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Database size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Banco de Clientes</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">{clients.length} cliente{clients.length !== 1 ? 's' : ''} salvos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Search + actions */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Pesquisar cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-xs outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 dark:placeholder-slate-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLoadAll}
              disabled={filtered.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white py-2.5 px-3 rounded-xl text-xs font-semibold transition-all"
            >
              <Upload size={14} />
              {search ? `Carregar ${filtered.length} filtrado${filtered.length !== 1 ? 's' : ''}` : 'Carregar todos'}
            </button>
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={clients.length === 0}
                className="px-3.5 py-2.5 rounded-xl bg-gray-100 hover:bg-red-100 dark:bg-slate-700 dark:hover:bg-red-900/30 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 transition-all"
                title="Limpar banco"
              >
                <Trash2 size={15} />
              </button>
            ) : (
              <div className="flex gap-1">
                <button onClick={() => { onClearAll(); setConfirmClear(false); }} className="px-3 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all">Limpar</button>
                <button onClick={() => setConfirmClear(false)} className="px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-500 dark:text-slate-400 text-xs transition-all"><RotateCcw size={13} /></button>
              </div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-slate-600">
              <Database size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{clients.length === 0 ? 'Banco vazio. Processe uma lista para salvar clientes.' : 'Nenhum resultado.'}</p>
            </div>
          ) : (
            filtered.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 group transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">{c.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${typeBg(c.type)}`}>{typeLabel(c.type)}</span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Salvo em {formatDate(c.savedAt)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleLoadOne(c)}
                    className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="Carregar este cliente"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => onRemove(c.id)}
                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    title="Remover do banco"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseModal;
