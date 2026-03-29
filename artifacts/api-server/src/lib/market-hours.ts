export function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  if (day < 1 || day > 5) return false;

  const etOffset = getEasternOffsetMinutes(now);
  const totalMinutesUTC = now.getUTCHours() * 60 + now.getUTCMinutes();
  const totalMinutesET = totalMinutesUTC + etOffset;

  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;

  return totalMinutesET >= marketOpen && totalMinutesET < marketClose;
}

function getEasternOffsetMinutes(date: Date): number {
  const year = date.getUTCFullYear();
  const dstStart = getNthSundayOfMonth(year, 2, 2);
  const dstEnd = getNthSundayOfMonth(year, 10, 1);

  const isDST = date >= dstStart && date < dstEnd;
  return isDST ? -4 * 60 : -5 * 60;
}

function getNthSundayOfMonth(year: number, month: number, nth: number): Date {
  const d = new Date(Date.UTC(year, month - 1, 1, 2, 0, 0));
  const dayOfWeek = d.getUTCDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  d.setUTCDate(1 + daysUntilSunday + (nth - 1) * 7);
  return d;
}
