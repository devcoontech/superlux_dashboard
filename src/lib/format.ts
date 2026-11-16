export const TZ = 'Europe/London';

/** Pence -> "£1,234.50". Always shows pence so nothing is silently rounded. */
export const gbp = (pence: number | null | undefined) =>
  '£' + ((pence ?? 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "12.50" -> 1250; returns null for blank/invalid. */
export const toPence = (s: string): number | null => {
  const t = s.trim().replace(/^£/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
};
export const fromPence = (p: number | null | undefined) => (p == null ? '' : (p / 100).toFixed(2));

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtDate = (iso: string, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, ...o });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/** yyyy-mm-dd for a Date in London. */
export const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** Status and code words as staff read them. Chauffeur terms where the stored value still says "driver". */
const WORDS: Record<string, string> = {
  driver_assigned: 'Chauffeur assigned', with_driver: 'With chauffeur', self_drive: 'Self-drive', service_started: 'Passenger on board',
  service_complete: 'Journey complete', en_route: 'En route to pick-up', arrived: 'Arrived at pick-up', not_dispatched: 'Not dispatched',
  customer_app: 'Customer app', website: 'Website', one_way: 'One way', later: 'Pay later (old option)', full: 'Card, in full', deposit: 'Card deposit', klarna: 'Klarna (financing)', paypal: 'PayPal (financing)',
};
export const humanize = (s: string) => WORDS[s] ?? s.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());

/** London offset-aware ISO for a local date + hour, used when blocking calendar slots. */
export function londonIso(date: string, hour: number): string {
  // Find the UTC instant whose London wall-clock equals date + hour.
  const guess = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).formatToParts(guess);
  const h = Number(parts.find((p) => p.type === 'hour')!.value) % 24;
  const diff = hour - h;
  return new Date(guess.getTime() + diff * 3600000).toISOString();
}

export const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);
