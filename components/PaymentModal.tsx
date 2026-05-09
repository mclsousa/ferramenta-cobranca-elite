
import React, { useState, useEffect, useRef } from 'react';
import { ParsedClient } from '../types';
import { DollarSign, X } from 'lucide-react';

interface PaymentModalProps {
  client: ParsedClient | null;
  onClose: () => void;
  onConfirm: (client: ParsedClient, amount: number) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ client, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (client) {
      setAmount('');
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [client]);

  if (!client) return null;

  const handleConfirm = () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (isNaN(value) || value <= 0) return;
    onConfirm(client, value);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-slate-700 animate-bounce-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Registrar pagamento</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[180px]">{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Valor recebido (R$)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 font-semibold text-sm">R$</span>
              <input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                placeholder="0,00"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white text-base outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="p-5 pt-0 flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={!amount || parseFloat(amount.replace(',', '.')) <= 0}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
          >
            Confirmar pagamento
          </button>
          <button onClick={onClose} className="px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
