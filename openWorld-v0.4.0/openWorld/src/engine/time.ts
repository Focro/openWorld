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
