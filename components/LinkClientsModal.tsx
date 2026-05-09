
import React, { useState, useEffect } from 'react';
import { ParsedClient } from '../types';
import { X, Link as LinkIcon, Search, CheckCircle, UserPlus, Trash2 } from 'lucide-react';
import { formatDate } from '../utils/helpers';

interface LinkClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterClient: ParsedClient | null;
  allClients: ParsedClient[]; // Flattened list of available clients
  onSave: (master: ParsedClient, selectedDependents: string[]) => void; // returns names of dependents
}

const LinkClientsModal: React.FC<LinkClientsModalProps> = ({ isOpen, onClose, masterClient, allClients, onSave }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNames, setSelectedNames] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && masterClient) {
      // Pre-select existing links if any
      const existing = masterClient.linked?.map(c => c.name) || [];
      setSelectedNames(existing);
      setSearchTerm('');
    }
  }, [isOpen, masterClient]);

  const toggleSelection = (name: string) => {
    setSelectedNames(prev => 
      prev.includes(name) 
        ? prev.filter(n => n !== name) 
        : [...prev, name]
    );
  };

  const handleSave = () => {
    if (masterClient) {
      onSave(masterClient, selectedNames);
      onClose();
    }
  };

  if (!isOpen || !masterClient) return null;

  // Filter candidates:
  // 1. Exclude the master client itself
  // 2. Filter by search term
  const candidates = allClients.filter(c => 
    c.name !== masterClient.name && 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10 rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <LinkIcon size={20} className="text-blue-500" /> Vincular Contas
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Titular: <span className="font-bold text-blue-600 dark:text-blue-400">{masterClient.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
             <input 
                type="text" 
                placeholder="Buscar dependente..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
             />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {candidates.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
               <p className="text-sm">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            candidates.map(client => {
               const isSelected = selectedNames.includes(client.name);
               return (
                 <div 
                    key={client.id}
                    onClick={() => toggleSelection(client.name)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                 >
                    <div className="flex flex-col">
                        <span className={`text-sm font-bold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                            {client.name}
                        </span>
                        <span className="text-xs text-gray-400">
                            Vence: {formatDate(client.dueDate)}
                        </span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                        {isSelected && <CheckCircle size={12} />}
                    </div>
                 </div>
               );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl flex justify-between items-center">
            <div className="text-xs text-gray-500">
                {selectedNames.length} selecionado(s)
            </div>
            <button 
                onClick={handleSave}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95"
            >
                <LinkIcon size={16} /> Salvar Vínculos
            </button>
        </div>

      </div>
    </div>
  );
};

export default LinkClientsModal;
