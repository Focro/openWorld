export const MINUTES_PER_DAY = 1440;
export const START_MINUTE = 8 * 60;

export const dayOf = (minute: number) => Math.floor(minute / MINUTES_PER_DAY) + 1;
export const hourOf = (minute: number) => Math.floor((minute % MINUTES_PER_DAY) / 60);

const pad = (n: number) => String(n).padStart(2, "0");

export function formatClock(minute: number): string {
  const m = minute % MINUTES_PER_DAY;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Час попадает в [from, to); если from > to, интервал переходит через полночь. */
export function hourInRange(hour: number, from: number, to: number): boolean {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** Велорийский год начинается с 742 KL; год содержит 365 дней в текущей модели. */
export const yearKLOf = (minute: number, startYearKL = 742): number => startYearKL + Math.floor(Math.max(0, Math.floor(minute / MINUTES_PER_DAY)) / 365);
export const dayOfYear = (minute: number): number => (Math.max(0, Math.floor(minute / MINUTES_PER_DAY)) % 365) + 1;


/** Короткая дата для контекста ИИ и журнала: внутриигровой год и порядковый день. */
export function formatWorldDate(minute: number, startYearKL = 742): string {
  return `${yearKLOf(minute, startYearKL)} КЛ, день ${dayOfYear(minute)} из 365`;
}
