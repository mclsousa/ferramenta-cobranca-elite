
import React, { useState, useEffect } from 'react';
import { ParsedClient, AppConfig, PricingPlan } from '../types';
import { X, FileText, Send, Calendar, Zap } from 'lucide-react';
import { toInputDate } from '../utils/helpers';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ParsedClient | null;
  config: AppConfig;
  onConfirm: (date: Date, value: number) => void;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, client, config, onConfirm }) => {
  const [date, setDate] = useState('');
  const [value, setValue] = useState<number>(0);

  useEffect(() => {
    if (isOpen && client) {
      // Default to client's due date
      setDate(toInputDate(client.dueDate));
      
      // Smart Default Price Logic
      let defaultPrice = config.plans?.[0]?.price || 0;
      
      const totalAccounts = 1 + (client.linked?.length || 0);
      if (totalAccounts > 1 && config.planGroups && config.plans && config.plans.length > 0) {
           // If we have linked accounts, try to find the 1 Month price for that group
           // Assume first plan is usually 1 Month
           const firstPlanMonths = parseInt(config.plans[0].label.match(/(\d+)/)?.[0] || '1');
           
           const targetGroup = config.planGroups.find(g => g.label.includes(`${totalAccounts}`));
           if (targetGroup) {
               const specificPlan = targetGroup.plans.find(p => {
                    const m = p.label.match(/(\d+)/);
                    return m && parseInt(m[0]) === firstPlanMonths;
               });
               if (specificPlan) defaultPrice = specificPlan.price;
           }
      }
      
      setValue(defaultPrice);
    }
  }, [isOpen, client, config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const [y, m, d] = date.split('-').map(Number);
    const selectedDate = new Date(y, m - 1, d);
    selectedDate.setHours(12, 0, 0, 0); // avoid timezone issues
    onConfirm(selectedDate, value);
    onClose();
  };

  const handleQuickPlan = (defaultPlan: PricingPlan) => {
      if (!client) return;

      // Extract duration (months) from the button clicked
      const match = defaultPlan.label.match(/(\d+)/);
      const months = match ? parseInt(match[0]) : 1;

      // Smart Pricing Logic: Check if we need to use a specific price table
      let finalPrice = defaultPlan.price;
      const totalAccounts = 1 + (client.linked?.length || 0);

      if (totalAccounts > 1 && config.planGroups) {
          // Try to find a group that matches the number of screens (e.g. "2 Telas")
          const targetGroup = config.planGroups.find(g => g.label.includes(`${totalAccounts}`));
          
          if (targetGroup) {
              // Try to find the plan with the same duration in this group
              const specificPlan = targetGroup.plans.find(p => {
                  const pMatch = p.label.match(/(\d+)/);
                  return pMatch && parseInt(pMatch[0]) === months;
              });

              if (specificPlan) {
                  finalPrice = specificPlan.price;
              }
          }
      }

      // 1. Set Price
      setValue(finalPrice);

      // 2. Calculate Date
      const today = new Date();
      today.setHours(0,0,0,0);

      let baseDate = new Date(client.dueDate);
      baseDate.setHours(0,0,0,0);

      // If expired, use today as base
      if (baseDate < today) {
          baseDate = today;
      }

      const newDate = new Date(baseDate);
      newDate.setMonth(baseDate.getMonth() + months);

      setDate(toInputDate(newDate));
  };

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-2xl w-full max-w-xs border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <FileText size={16} className="text-orange-500" /> Gerar Recibo
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
            {/* Quick Options */}
            {config.plans && config.plans.length > 0 && (
                <div className="mb-4">
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Zap size={10} className="text-yellow-500" /> Rápido
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                        {config.plans.map(plan => (
                            <button
                                key={plan.id}
                                type="button"
                                onClick={() => handleQuickPlan(plan)}
                                className="flex flex-col items-center justify-center p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-200 dark:hover:border-orange-800 transition-all group bg-gray-50/50 dark:bg-gray-800"
                            >
                                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 whitespace-nowrap">
                                    {plan.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <form id="receipt-form" onSubmit={handleSubmit} className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
            <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Novo Vencimento
                </label>
                <div className="relative">
                <Calendar className="absolute left-2.5 top-2 text-gray-400" size={14} />
                <input 
                    type="date" 
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-8 p-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-1 focus:ring-orange-500 outline-none text-xs [color-scheme:light] dark:[color-scheme:dark]"
                />
                </div>
            </div>

            <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Valor Recebido (R$)
                </label>
                <input 
                    type="number"
                    step="0.01"
                    value={value}
                    onChange={(e) => setValue(parseFloat(e.target.value))}
                    className="w-full p-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-1 focus:ring-orange-500 outline-none text-xs"
                />
            </div>
            </form>
        </div>

        <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
            <button 
              type="submit"
              form="receipt-form"
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95"
            >
              <Send size={14} /> Gerar e Enviar
            </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
