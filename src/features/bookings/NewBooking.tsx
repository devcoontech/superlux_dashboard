import { Fragment, useEffect, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { ApiError, api, qs, useApi } from '../../lib/api';
import { CheckField, NumberField, SelectField, TextField } from '../../components/forms';
import { useAction, useDebounced } from '../../lib/hooks';
import { ErrorBox } from '../../components/feedback';
import { Drawer } from '../../components/ui';
import { addDays, fmtDate, gbp, ymd } from '../../lib/format';
import type { Enquiry } from '../enquiries/Enquiries';
/** The "New booking" drawer: pick a customer, then one or more journeys (a return is a second journey), and see the price before saving. */

type Cust = { id: string; name: string; email: string; phone: string | null; bookings?: number; lastBookingAt?: string | null };

type FleetCar = { id: string; make: string; model: string; operational_status: string; delivery_available: boolean; stationary_available: boolean; chauffeur_available: boolean; self_drive_available: boolean; min_hours: number; max_hours: number };

type AdminAddon = { id: string; name: string; pricePence: number; active: boolean; pricingType: 'fixed' | 'per_hour' | 'per_unit'; maxQuantity: number; allVehicles: boolean; vehicleIds: string[] };

/** Search existing customers by name, email or phone; pick one with the mouse or the keyboard. */
function CustomerPicker({ onPick, initial }: { onPick: (c: Cust, isNew?: boolean) => void; initial?: { name: string; email: string; phone: string } }) {
  const [q, setQ] = useState(initial?.email || initial?.phone || '');
  const [active, setActive] = useState(0);
  const dq = useDebounced(q);
  const { data: found, loading } = useApi<{ items: Cust[] }>(dq.trim().length >= 2 ? '/customers' + qs({ q: dq.trim(), limit: 8 }) : null);
  const [creating, setCreating] = useState<{ name: string; email: string; phone: string } | null>(null);
  const { run, busy, error } = useAction();
  const items = dq.trim().length >= 2 ? found?.items ?? [] : [];

  const startCreate = () => {
    if (initial) { setCreating({ ...initial }); return; }
    const t = q.trim();
    setCreating({ name: /@|\d{4,}/.test(t) ? '' : t, email: t.includes('@') ? t : '', phone: /^[+\d\s()-]{6,}$/.test(t) ? t : '' });
  };
  const create = async () => {
    if (!creating) return;
    const r = await run(() => api<{ customer: Cust }>('/customers', { body: { name: creating.name.trim(), email: creating.email.trim(), phone: creating.phone.trim() || undefined } }), 'Customer created');
    if (r) onPick(r.customer, true);
  };
  // The server refuses a second record for the same email and says who it is, so staff can select them instead.
  const dupe = error instanceof ApiError && error.code === 'email_taken' ? (error.details as { customer?: Cust } | undefined)?.customer ?? null : null;

  if (creating) {
    return (
      <div className="field">
        <label>New customer</label>
        <div className="form-grid">
          <TextField label="Name *" value={creating.name} onChange={(v) => setCreating({ ...creating, name: v })} />
          <TextField label="Email *" type="email" value={creating.email} onChange={(v) => setCreating({ ...creating, email: v })} />
          <TextField label="Phone" value={creating.phone} onChange={(v) => setCreating({ ...creating, phone: v })} />
        </div>
        {dupe ? (
          <div className="note row between wrap"><span><b>{dupe.name}</b> already has an account with that email.</span><button className="btn sm gold" onClick={() => onPick(dupe)}>Use {dupe.name.split(' ')[0]}</button></div>
        ) : <ErrorBox error={error} />}
        <div className="row"><button className="btn gold sm" disabled={busy || !creating.name.trim() || !creating.email.trim()} onClick={create}>{busy ? 'Creating…' : 'Create customer'}</button><button className="btn sm" onClick={() => setCreating(null)}>Back to search</button></div>
      </div>
    );
  }
  return (
    <div className="field">
      <label htmlFor="cust-search">Customer *</label>
      <input id="cust-search" className="input" placeholder="Search name, email or phone" value={q} autoComplete="off"
        role="combobox" aria-expanded={items.length > 0} aria-controls="cust-results" aria-activedescendant={items[active] ? `cust-${items[active].id}` : undefined}
        onChange={(e) => { setQ(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && items[active]) { e.preventDefault(); onPick(items[active]); }
        }} />
      {items.length ? (
        <div className="list" id="cust-results" role="listbox">
          {items.map((c, i) => (
            <button key={c.id} id={`cust-${c.id}`} role="option" aria-selected={i === active} className="list-item click"
              style={{ textAlign: 'left', width: '100%', background: i === active ? 'var(--gold-soft)' : undefined }} onMouseEnter={() => setActive(i)} onClick={() => onPick(c)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="strong">{c.name}</div>
                <div className="muted small">{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
              </div>
              <div className="muted small" style={{ textAlign: 'right' }}>{c.bookings ? `${c.bookings} booking${c.bookings === 1 ? '' : 's'}` : 'No bookings yet'}{c.lastBookingAt ? <div>Last {fmtDate(c.lastBookingAt)}</div> : null}</div>
            </button>
          ))}
        </div>
      ) : null}
      {dq.trim().length >= 2 && found && !items.length && !loading ? <span className="muted small">No customer matches "{dq.trim()}".</span> : null}
      <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={startCreate}><FiPlus /> New customer</button>
    </div>
  );
}

type ItemDraft = {
  key: number; vehicleId: string; eventTypeId: string; date: string; time: string; hours: number | null; experience: string; driverOption: string; address: string; pickup: string; dropoff: string; qty: Record<string, number>;
  leg: '' | 'outbound' | 'return'; stops: string; flight: string; terminal: string; passengers: number | null; large: number | null; small: number | null;
};

type EventOpt = { id: string; title: string; archived_at: string | null; pricing_basis: string; min_hours: number | null; slug: string };

type QuoteLine = { key: string; label: string; amountPence: number };

type OrderQuote = {
  order: { subtotalPence: number; discountPence: number; taxablePence: number; taxPence: number; serviceFeePence: number; totalPence: number; depositDuePence: number;
    tax: { enabled: boolean; rateBp: number; label: string; policy: string }; offers: { title: string; code: string | null; discountPence: number; conditions: string }[]; notApplied: { title: string; reason: string }[] };
  items: { vehicleId: string; vehicle: string; subtotalPence: number; discountPence: number; taxPence: number; totalPence: number; lines: QuoteLine[]; available: boolean; unavailableReason: string | null }[];
};

let nextKey = 1;
const blankItem = (from?: ItemDraft): ItemDraft => ({
  key: nextKey++, vehicleId: '', eventTypeId: from?.eventTypeId ?? '', date: from?.date ?? ymd(addDays(new Date(), 7)), time: from?.time ?? '11:00', hours: from?.hours ?? 3,
  experience: from?.experience ?? 'stationary', driverOption: '', address: from?.address ?? '', pickup: '', dropoff: '', qty: {},
  leg: '', stops: '', flight: '', terminal: '', passengers: from?.passengers ?? 1, large: from?.large ?? 0, small: from?.small ?? 0,
});
/** The return leg of a journey: same vehicle and party, the route reversed, later the same day by default. */
const returnOf = (o: ItemDraft): ItemDraft => ({
  ...blankItem(o), vehicleId: o.vehicleId, driverOption: o.driverOption, pickup: o.dropoff, dropoff: o.pickup, leg: 'return', time: o.time < '18:00' ? '18:00' : o.time,
});

/** Which driving arrangements a car offers, and the one to use (a car offering only one selects it). */
const driverChoicesFor = (veh: FleetCar | undefined, isDistance: boolean) => [
  ...(veh?.chauffeur_available || isDistance ? [{ value: 'with_driver', label: 'With chauffeur' }] : []),
  ...(veh?.self_drive_available && !isDistance ? [{ value: 'self_drive', label: 'Without chauffeur (self-drive)' }] : []),
];

const driverFor = (it: ItemDraft, veh: FleetCar | undefined, isDistance: boolean) => {
  const ch = driverChoicesFor(veh, isDistance);
  return ch.length === 1 ? ch[0].value : ch.some((d) => d.value === it.driverOption) ? it.driverOption : '';
};

/** One vehicle in a staff booking: its own car, time, duration, driver, collection and add-ons. */
function VehicleItem({ it, n, count, fleet, events, extras, today, maxDate, buffer, quote, onChange, onRemove }: {
  it: ItemDraft; n: number; count: number; fleet: FleetCar[]; events: EventOpt[]; extras: AdminAddon[]; today: string; maxDate: string; buffer: number;
  quote?: OrderQuote['items'][number]; onChange: (patch: Partial<ItemDraft>) => void; onRemove: () => void;
}) {
  const veh = fleet.find((v) => v.id === it.vehicleId);
  const svc = events.find((e) => e.id === it.eventTypeId);
  const isDistance = svc?.pricing_basis === 'distance' || svc?.pricing_basis === 'transfer';
  const hourly = !svc || svc.pricing_basis === 'hourly';
  const choices = driverChoicesFor(veh, isDistance);
  const driver = driverFor(it, veh, isDistance);
  const offered = extras.filter((a) => a.active && it.vehicleId && (a.allVehicles || a.vehicleIds.includes(it.vehicleId)));
  return (
    <div className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row between"><b>{it.leg === 'return' ? 'Return journey' : `Journey ${n + 1}`}{veh ? `: ${veh.make} ${veh.model}` : ''}</b>{count > 1 ? <button className="btn sm danger" onClick={onRemove}>Remove</button> : null}</div>
      <SelectField label="Service *" value={it.eventTypeId} onChange={(v) => onChange({ eventTypeId: v })} options={[{ value: '', label: 'Choose a service' }, ...events.filter((e) => !e.archived_at).map((e) => ({ value: e.id, label: e.title }))]} />
      <SelectField label="Vehicle *" value={it.vehicleId} onChange={(v) => onChange({ vehicleId: v, qty: {} })} options={[{ value: '', label: 'Choose a vehicle' }, ...fleet.filter((v) => v.operational_status === 'active').map((v) => ({ value: v.id, label: `${v.make} ${v.model}` }))]} />
      <TextField label="Pick-up *" value={it.pickup} onChange={(v) => onChange({ pickup: v })} placeholder="Address, postcode or airport" />
      {!hourly ? <TextField label="Drop-off *" value={it.dropoff} onChange={(v) => onChange({ dropoff: v })} placeholder="Address, postcode or airport" hint="The route is measured on the map; miles beyond the allowance are added to the price" /> : null}
      <TextField label="Stops on the way" value={it.stops} onChange={(v) => onChange({ stops: v })} />
      <div className="form-grid">
        <TextField label="Flight number" value={it.flight} onChange={(v) => onChange({ flight: v.toUpperCase() })} placeholder="e.g. BA117" />
        <TextField label="Terminal" value={it.terminal} onChange={(v) => onChange({ terminal: v })} />
        <NumberField label="Passengers" value={it.passengers} onChange={(v) => onChange({ passengers: v })} min={1} max={60} />
        <NumberField label="Large bags" value={it.large} onChange={(v) => onChange({ large: v })} min={0} max={60} />
        <NumberField label="Small bags" value={it.small} onChange={(v) => onChange({ small: v })} min={0} max={60} />
      </div>
      <div className="form-grid">
        <TextField label="Date *" type="date" value={it.date} onChange={(v) => onChange({ date: v })} min={today} max={maxDate} error={it.date < today ? 'Choose today or a later date' : undefined} />
        <TextField label="Pick-up time *" type="time" value={it.time} onChange={(v) => onChange({ time: v })} hint={`On the hour or a quarter hour. ${buffer} minutes are kept free before and after.`} />
        <SelectField label="Book by" value={(it.hours ?? 0) >= 24 ? 'day' : 'hour'} onChange={(v) => onChange({ hours: v === 'day' ? 24 : (veh?.min_hours ?? 1) })}
          options={[{ value: 'hour', label: 'The hour' }, { value: 'day', label: 'The day (24 hours)' }]} />
        {(it.hours ?? 0) >= 24 ? (
          <NumberField label="Days *" value={(it.hours ?? 24) / 24} onChange={(v) => onChange({ hours: v ? v * 24 : null })} min={1} max={60} hint="Ends at the same time on the last day" />
        ) : (
          <NumberField label="Hours *" value={it.hours} onChange={(v) => onChange({ hours: v })} min={veh?.min_hours ?? 1} max={veh?.max_hours}
            hint={!hourly ? `Operational hours charged${svc?.min_hours ? ` (at least ${svc.min_hours})` : ''}` : undefined} />
        )}
        <SelectField label="Chauffeur *" value={driver} onChange={(v) => onChange({ driverOption: v })} disabled={choices.length < 2}
          options={choices.length === 1 ? choices : [{ value: '', label: it.vehicleId ? 'Choose' : 'Choose a vehicle first' }, ...choices]} />
      </div>
      {isDistance || !veh?.delivery_available ? null : (
        <>
          <SelectField label="Collection" value={it.experience} onChange={(v) => onChange({ experience: v })} options={[
            ...(veh && !veh.stationary_available ? [] : [{ value: 'stationary', label: 'Collect from showroom' }]),
            ...(veh && !veh.delivery_available ? [] : [{ value: 'delivered', label: 'Deliver to customer location' }]),
          ]} />
          {it.experience === 'delivered' ? (
            <>
              <TextField label="Delivery address *" value={it.address} onChange={(v) => onChange({ address: v })} />
              <div className="note small">Add the delivery charge on the booking page once you've worked it out. The customer is emailed the new total.</div>
            </>
          ) : null}
        </>
      )}
      {offered.length ? (
        <div className="field">
          <label>Extras</label>
          {offered.map((a) => {
            const unit = a.pricingType === 'per_hour' ? `${gbp(a.pricePence)}/h` : gbp(a.pricePence);
            return a.maxQuantity > 1 ? (
              <div key={a.id} className="row between"><span>{a.name} <span className="muted small">({unit} each, up to {a.maxQuantity})</span></span>
                <input className="input" type="number" min={0} max={a.maxQuantity} style={{ width: 90 }} aria-label={`${a.name} quantity`} value={it.qty[a.id] ?? 0}
                  onChange={(e) => onChange({ qty: { ...it.qty, [a.id]: Math.max(0, Math.min(a.maxQuantity, Math.trunc(Number(e.target.value) || 0))) } })} /></div>
            ) : <CheckField key={a.id} label={`${a.name} (${unit})`} checked={!!it.qty[a.id]} onChange={(c) => onChange({ qty: { ...it.qty, [a.id]: c ? 1 : 0 } })} />;
          })}
        </div>
      ) : null}
      {quote ? (
        <div className={quote.available ? 'note small' : 'error-box'}>
          {quote.available ? <>
            {quote.lines.map((l) => <div key={l.key} className="row between"><span>{l.label}</span><span>{gbp(l.amountPence)}</span></div>)}
            <div className="row between strong"><span>This vehicle{quote.discountPence ? ` (after ${gbp(quote.discountPence)} discount)` : ''}</span><span>{gbp(quote.totalPence)}</span></div>
          </> : <>Not available: {quote.unavailableReason}</>}
        </div>
      ) : null}
    </div>
  );
}

/** The journey a website enquiry asked for, as the first item of a new booking. */
const itemFromEnquiry = (e: Enquiry): ItemDraft => ({
  ...blankItem(), vehicleId: e.vehicleId ?? '', pickup: e.pickup ?? '', dropoff: e.dropoff ?? '',
  ...(e.requestedDate ? { date: e.requestedDate } : {}), ...(e.requestedTime ? { time: e.requestedTime.slice(0, 5) } : {}),
  ...(e.passengers ? { passengers: e.passengers } : {}),
});

export function NewBooking({ onClose, onCreated, fromEnquiry }: { onClose: () => void; onCreated: (id: string) => void; fromEnquiry?: Enquiry }) {
  const { data: fleet } = useApi<{ items: FleetCar[] }>('/vehicles?limit=200');
  const { data: ev } = useApi<{ items: EventOpt[] }>('/event-types');
  const { data: extras } = useApi<{ items: AdminAddon[] }>('/addons');
  const { data: cfg } = useApi<{ settings: Record<string, unknown> }>('/settings');
  const [customer, setCustomer] = useState<Cust | null>(null);
  const [newCustomer, setNewCustomer] = useState(false);
  const today = ymd(new Date());
  const maxDate = ymd(addDays(new Date(), Number(cfg?.settings['booking.maxAdvanceDays'] ?? 365)));
  const maxVehicles = Number(cfg?.settings['booking.maxVehiclesPerOrder'] ?? 10);
  const [items, setItems] = useState<ItemDraft[]>(() => [fromEnquiry ? itemFromEnquiry(fromEnquiry) : blankItem()]);
  const [initialStatus, setInitialStatus] = useState('awaiting_payment');
  const { run, busy, error } = useAction();
  const buffer = Number(cfg?.settings['booking.bufferMinutes'] ?? 60);
  const events = ev?.items ?? [];
  const cars = fleet?.items ?? [];
  // The enquiry names its service by title; select that service once the list has loaded.
  useEffect(() => {
    const svc = fromEnquiry?.service?.trim().toLowerCase();
    const match = svc ? events.find((x) => !x.archived_at && (x.title.toLowerCase() === svc || x.slug === svc)) : undefined;
    if (match) setItems((p) => p.map((i, n) => (n === 0 && !i.eventTypeId ? { ...i, eventTypeId: match.id } : i)));
  }, [ev, fromEnquiry]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = (i: ItemDraft) => {
    const veh = cars.find((v) => v.id === i.vehicleId);
    const isDistance = events.find((e) => e.id === i.eventTypeId)?.pricing_basis === 'distance';
    const offered = (extras?.items ?? []).filter((a) => a.active && (a.allVehicles || a.vehicleIds.includes(i.vehicleId)));
    return {
      vehicleId: i.vehicleId, eventTypeId: i.eventTypeId || null, date: i.date, time: i.time, hours: i.hours, experience: isDistance ? 'stationary' : i.experience,
      driverOption: driverFor(i, veh, isDistance) || null, address: i.address || null, pickupAddress: i.pickup || null, dropoffAddress: i.dropoff || null,
      addons: offered.filter((a) => i.qty[a.id]).map((a) => ({ id: a.id, quantity: i.qty[a.id] })),
      journey: {
        leg: i.leg || (items.some((x) => x.leg === 'return') ? 'outbound' : null), journeyType: items.some((x) => x.leg === 'return') ? 'return' : 'one_way',
        stops: i.stops.trim() || null, flightNumber: i.flight.trim() || null, terminal: i.terminal.trim() || null,
        passengers: i.passengers, luggageLarge: i.large, luggageSmall: i.small, leadPassengerName: customer?.name ?? null, leadPassengerPhone: customer?.phone ?? null,
      },
    };
  };
  const basisOf = (i: ItemDraft) => events.find((e) => e.id === i.eventTypeId)?.pricing_basis;
  const isJourney = (i: ItemDraft) => basisOf(i) === 'distance' || basisOf(i) === 'transfer';
  const complete = items.every((i) => i.vehicleId && i.eventTypeId && i.hours && i.date >= today && i.pickup.trim() && (!isJourney(i) || i.dropoff.trim())
    && driverFor(i, cars.find((v) => v.id === i.vehicleId), isJourney(i)));

  // Live price from the server (same engine as the booking), refreshed as the vehicles change.
  const quoteKey = complete ? JSON.stringify({ items: items.map(body), customerId: customer?.id }) : '';
  const dKey = useDebounced(quoteKey, 500);
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteError, setQuoteError] = useState<Error | null>(null);
  useEffect(() => {
    if (!dKey) { setQuote(null); setQuoteError(null); return; }
    let live = true;
    api<OrderQuote>('/orders/quote', { body: JSON.parse(dKey) }).then((q) => { if (live) { setQuote(q); setQuoteError(null); } }, (e) => { if (live) { setQuote(null); setQuoteError(e); } });
    return () => { live = false; };
  }, [dKey]);

  const update = (key: number, patch: Partial<ItemDraft>) => setItems((p) => p.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const create = async () => {
    const r = await run(() => api<{ bookingId: string }>('/orders', { body: {
      customerId: customer!.id, items: items.map(body), initialStatus, enquiryId: fromEnquiry?.id ?? null,
    } }), items.length > 1 ? `Booking created with ${items.length} vehicles` : 'Booking created');
    if (r) onCreated(r.bookingId);
  };
  const o = quote?.order;
  const allAvailable = !quote || quote.items.every((i) => i.available);

  return (
    <Drawer title={fromEnquiry ? `New booking from ${fromEnquiry.ref}` : 'New booking'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn gold" disabled={busy || !customer || !complete || !allAvailable} onClick={create}>{busy ? 'Creating…' : items.length > 1 ? `Create booking (${items.length} vehicles)` : 'Create booking'}</button></>}>
      {customer ? (
        <div className="field">
          <label>Customer *</label>
          <div className="note">
            <div className="row between wrap"><b>{customer.name}</b><button className="btn sm" onClick={() => { setCustomer(null); setNewCustomer(false); }}>Change</button></div>
            <div className="small">{customer.email}{customer.phone ? ` · ${customer.phone}` : ''}</div>
            {customer.bookings != null ? <div className="muted small">{customer.bookings ? `${customer.bookings} previous booking${customer.bookings === 1 ? '' : 's'}` : 'First booking'}</div> : null}
          </div>
          {newCustomer ? <div className="note">New customer. Emails about this booking go to <b>{customer.email}</b>; they can check it on the website under Manage Booking with its reference.</div> : null}
        </div>
      ) : <CustomerPicker initial={fromEnquiry ? { name: fromEnquiry.name, email: fromEnquiry.email ?? '', phone: fromEnquiry.phone ?? '' } : undefined} onPick={(c, isNew) => { setCustomer(c); setNewCustomer(!!isNew); }} />}
      {fromEnquiry?.message ? <div className="note small"><b>Enquiry message:</b> {fromEnquiry.message}</div> : null}

      {items.map((it, n) => (
        <VehicleItem key={it.key} it={it} n={n} count={items.length} fleet={cars} events={events} extras={extras?.items ?? []} today={today} maxDate={maxDate}
          buffer={buffer} quote={quote?.items[n]} onChange={(patch) => update(it.key, patch)} onRemove={() => setItems((p) => p.filter((x) => x.key !== it.key))} />
      ))}
      {items.length < maxVehicles ? (
        <div className="row wrap">
          {items.length === 1 && isJourney(items[0]) && items[0].pickup && items[0].dropoff ? <button className="btn" onClick={() => setItems((p) => [p[0], returnOf(p[0])])}><FiPlus /> Add return journey</button> : null}
          <button className="btn" onClick={() => setItems((p) => [...p, blankItem(p[p.length - 1])])}><FiPlus /> Add another vehicle</button>
        </div>
      ) : null}

      <SelectField label="Start as" value={initialStatus} onChange={setInitialStatus} hint="The booking is confirmed once the deposit is received. Record cash or card payments on the booking page."
        options={[{ value: 'awaiting_payment', label: 'Awaiting payment' }, { value: 'pending', label: 'Pending review' }, ...(cfg?.settings['payment.allowUnpaidConfirmation'] === true ? [{ value: 'confirmed', label: 'Confirmed (no payment yet)' }] : [])]} />

      <div className="panel" style={{ padding: 16 }}>
        <div className="strong" style={{ marginBottom: 8 }}>Price (worked out by the server)</div>
        {!complete ? <span className="muted small">Choose a service, vehicle, pick-up (and drop-off for journeys) and time to see the price.</span> : null}

        <ErrorBox error={quoteError} />
        {o ? (
          <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
            <dt className="dim">Rental subtotal ({items.length} vehicle{items.length === 1 ? '' : 's'})</dt><dd style={{ textAlign: 'right' }}>{gbp(o.subtotalPence)}</dd>
            {o.offers.map((x) => <Fragment key={x.title}><dt className="dim">Discount: {x.title}{x.code ? ` (${x.code})` : ''}<div className="muted small">{x.conditions}</div></dt><dd style={{ textAlign: 'right' }}>-{gbp(x.discountPence)}</dd></Fragment>)}
            {o.tax.enabled ? <><dt className="dim">Taxable amount</dt><dd style={{ textAlign: 'right' }}>{gbp(o.taxablePence)}</dd>
              <dt className="dim">{o.tax.label} at {o.tax.rateBp / 100}%</dt><dd style={{ textAlign: 'right' }}>{gbp(o.taxPence)}</dd></> : null}
            {o.serviceFeePence ? <><dt className="dim">Service fee</dt><dd style={{ textAlign: 'right' }}>{gbp(o.serviceFeePence)}</dd></> : null}
            <dt className="strong">Total</dt><dd className="strong" style={{ textAlign: 'right' }}>{gbp(o.totalPence)}</dd>
            {o.depositDuePence < o.totalPence ? <><dt className="dim">Deposit due</dt><dd style={{ textAlign: 'right' }}>{gbp(o.depositDuePence)}</dd></> : null}
          </dl>
        ) : null}
        {o?.notApplied.map((n) => <div key={n.title} className="muted small">{n.title}: {n.reason}</div>)}
      </div>
      <ErrorBox error={error} />
    </Drawer>
  );
}
