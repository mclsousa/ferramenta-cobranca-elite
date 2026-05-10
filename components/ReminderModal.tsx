
import React, { useState, useEffect } from 'react';
import { ParsedClient } from '../types';
import { Bell, X, BellRing, AlertCircle } from 'lucide-react';

interface ReminderModalProps {
  client: ParsedClient | null;
  defaultTime: string;
  onClose: () => void;
  onConfirm: (client: ParsedClient, scheduledFor: number) => void;
}

const ReminderModal: React.FC<ReminderModalProps> = ({ client, defaultTime, onClose, onConfirm }) => {
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState(defaultTime || '20:00');

  useEffect(() => {
    if (client) {
      const today = new Date();
      setSelectedDate(today.toISOString().split('T')[0]);
      setSelectedTime(defaultTime || '20:00');
      if ('Notification' in window) setNotifPerm(Notification.permission);
    }
  }, [client, defaultTime]);

  if (!client) return null;

  const requestPermission = async () => {
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    const [h, m] = selectedTime.split(':').map(Number);
    const dt = new Date(selectedDate);
    dt.setHours(h, m, 0, 0);
    onConfirm(client, dt.getTime());
    onClose();
  };

  const scheduledLabel = (() => {
    if (!selectedDate || !selectedTime) return '';
    const [h, m] = selectedTime.split(':').map(Number);
    const dt = new Date(selectedDate);
    dt.setHours(h, m, 0, 0);
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const dtDay = new Date(dt); dtDay.setHours(0,0,0,0);
    const prefix = dtDay.getTime() === today.getTime() ? 'Hoje' : dtDay.getTime() === tomorrow.getTime() ? 'Amanhã' : dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
    return `${prefix} às ${selectedTime}`;
  })();

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-slate-700 animate-bounce-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
              <Bell size={18} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Agendar lembrete</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[180px]">{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Atalhos de data */}
          <div className="flex gap-2">
            {['Hoje', 'Amanhã', '+2 dias'].map((label, i) => (
              <button
                key={label}
                onClick={() => setQuickDate(i)}
                className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-violet-100 dark:bg-slate-700 dark:hover:bg-violet-900/30 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-violet-700 dark:hover:text-violet-300 transition-all"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Data + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Data</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:[color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Hora</label>
              <input
                type="time"
                value={selectedTime}
                onChange={e => setSelectedTime(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:[color-scheme:dark]"
              />
            </div>
          </div>

          {/* Preview */}
          {scheduledLabel && (
            <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 p-3 rounded-xl">
              <BellRing size={14} className="text-violet-500 flex-shrink-0" />
              <span className="text-sm text-violet-700 dark:text-violet-300 font-medium">{scheduledLabel}</span>
            </div>
          )}

          {/* Aviso de notificação */}
          {'Notification' in window && notifPerm !== 'granted' && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-3 rounded-xl">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {notifPerm === 'denied'
                    ? 'Notificações bloqueadas. Ative nas configurações do navegador.'
                    : 'Ative notificações para receber o alerta mesmo com a aba em segundo plano.'}
                </p>
                {notifPerm === 'default' && (
                  <button onClick={requestPermission} className="mt-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 underline underline-offset-2">
                    Ativar notificações
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 pt-0 flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={!selectedDate || !selectedTime}
            className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
          >
            Agendar
          </button>
          <button onClick={onClose} className="px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-sm text-gray-600 dark:text-slate-400 transition-all">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReminderModal;
