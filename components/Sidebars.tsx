import React from 'react';
import { ActionLog, QuickLink } from '../types';
import { X, Copy, ExternalLink, Clock, Link as LinkIcon, Settings } from 'lucide-react';
import { formatDate } from '../utils/helpers';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: ActionLog[];
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ isOpen, onClose, history }) => {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 transition-opacity" 
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 z-[60] border-l border-gray-200 dark:border-gray-700 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Clock size={18} className="text-gray-500" /> Histórico de Sessão
          </h3>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-400 p-2 rounded-xl transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm italic">
              Nenhuma ação registrada hoje.
            </div>
          ) : (
            <div className="space-y-1">
              {history.map((log, idx) => (
                <div key={`${log.clientId}-${idx}`} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700/50 text-sm">
                   <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-gray-700 dark:text-gray-200 truncate pr-2">{log.clientName}</span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                   </div>
                   <div className="text-xs text-gray-500 flex items-center gap-1">
                      {log.action === 'whatsapp' && <span className="text-emerald-600">Enviado WhatsApp</span>}
                      {log.action === 'copy' && <span className="text-blue-600">Copiado</span>}
                      {log.action === 'mark' && <span className="text-gray-600">Marcado Manualmente</span>}
                      {log.action === 'receipt' && <span className="text-orange-600">Recibo Gerado</span>}
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

interface LinksSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  links: QuickLink[];
  onCopy: (text: string) => void;
  onManage: () => void;
}

export const LinksSidebar: React.FC<LinksSidebarProps> = ({ isOpen, onClose, links, onCopy, onManage }) => {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 transition-opacity" 
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 z-[60] border-l border-gray-200 dark:border-gray-700 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-blue-50 dark:bg-blue-900/10">
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <LinkIcon size={18} className="text-blue-500" /> Links Rápidos
          </h3>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-400 p-2 rounded-xl transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {links.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">
              Nenhum link cadastrado.
            </div>
          ) : (
            links.map(link => (
                <div key={link.id} className="group bg-white dark:bg-gray-700/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 transition-all shadow-sm hover:shadow-md">
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-800 dark:text-white text-sm">{link.label}</span>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500">
                            <ExternalLink size={14} />
                        </a>
                    </div>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 text-[10px] bg-gray-100 dark:bg-gray-800 p-1.5 rounded text-gray-500 truncate font-mono">
                            {link.url}
                        </code>
                        <button
                            onClick={() => onCopy(link.url)}
                            className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                            title="Copiar"
                        >
                            <Copy size={14} />
                        </button>
                    </div>
                </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
                onClick={onManage}
                className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors"
            >
                <Settings size={13} /> Gerenciar Links
            </button>
        </div>
      </div>
    </>
  );
};