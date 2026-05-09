// Regras de calendário centralizadas
// Sábado = 6 (getDay), Domingo = 0, Sexta = 5

export type WeekdayMode = 'friday_double' | 'normal';

export interface WeekdayContext {
  mode: WeekdayMode;
  isFriday: boolean;
  todayLabel: string; // ex: "Sexta-feira (09/05/2026)"
  tomorrow: Date;
  dayAfterTomorrow: Date;
}

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira',
  'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
];

export const getWeekdayContext = (now: Date = new Date()): WeekdayContext => {
  const day = now.getDay();
  const isFriday = day === 5;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfter = new Date(now);
  dayAfter.setDate(now.getDate() + 2);
  dayAfter.setHours(0, 0, 0, 0);

  const mode: WeekdayMode = isFriday ? 'friday_double' : 'normal';

  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const todayLabel = `${WEEKDAY_NAMES[day]} (${dd}/${mm}/${yyyy})`;

  return { mode, isFriday, todayLabel, tomorrow, dayAfterTomorrow: dayAfter };
};

/**
 * Retorna o intervalo de datas que o filtro "Próximos" deve usar HOJE.
 * - Sexta: amanhã ATÉ depois de amanhã (cobre sábado e domingo de uma vez)
 * - Demais dias: somente amanhã (start = end = amanhã)
 */
export const getUpcomingRange = (now: Date = new Date()): { start: Date; end: Date } => {
  const ctx = getWeekdayContext(now);
  if (ctx.mode === 'friday_double') {
    return { start: ctx.tomorrow, end: ctx.dayAfterTomorrow };
  }
  return { start: ctx.tomorrow, end: ctx.tomorrow };
};
