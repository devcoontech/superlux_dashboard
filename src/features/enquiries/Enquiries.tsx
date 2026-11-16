import { Fragment, useEffect, useState } from 'react';
import { FiInbox, FiMail, FiPhone, FiSearch, FiX } from 'react-icons/fi';
import { api, qs, useApi } from '../../lib/api';
import { useAction, useDebounced } from '../../lib/hooks';
import { Pager } from '../../components/Pager';
import { ErrorBox, Loading } from '../../components/feedback';
import { SelectField, TextField } from '../../components/forms';
import { Badge, Drawer, Empty, Panel, Tabs } from '../../components/ui';
import { fmtDate, fmtDateTime, humanize } from '../../lib/format';
import { go } from '../../lib/nav';

/*
 * Enquiries from the website: the contact and home-page forms, quote requests (a vehicle priced on application)
 * and requests for a pick-up time the calendar showed as taken. Staff reply by phone or email, then mark progress
 * here, and link the booking once one is made.
 */

export type Enquiry = {
  id: string; ref: string; kind: 'contact' | 'query' | 'quote' | 'slot'; status: string; name: string; email: string; phone: string;
  service: string | null; vehicleLabel: string | null; vehicleId: string | null; pickup: string | null; dropoff: string | null;
  requestedDate: string | null; requestedTime: string | null; passengers: number | null; luggage: number | null; message: string | null;
  adminNotes: string | null; bookingId: string | null; bookingRef: string | null; handledBy: string | null; createdAt: string; updatedAt: string;
};

const KIND: Record<Enquiry['kind'], string> = { contact: 'Contact form', query: 'Website query', quote: 'Quote request', slot: 'Unavailable time' };
const STATUSES = ['new', 'in_progress', 'quoted', 'converted', 'closed'];
export const ENQUIRIES_CHANGED = 'enquiries-changed';

export default function Enquiries({ openId }: { openId?: string }) {
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<{ items: Enquiry[]; total: number; counts: Record<string, number> }>(
    '/enquiries' + qs({ open: tab === 'open' ? 'true' : '', kind, q: dq, limit: 25, offset }));
  const [opened, setOpened] = useState<string | null>(openId ?? null);
  useEffect(() => setOpened(openId ?? null), [openId]);
  const open = data?.items.find((e) => e.id === opened);
  const openCount = (data?.counts.new ?? 0) + (data?.counts.in_progress ?? 0);

  return (
    <>
      <Panel title="Enquiries" hint="Messages and quote requests from the website. Reply to the customer, then update the status here.">
        <Tabs value={tab} onChange={(t) => { setTab(t); setOffset(0); }} items={[{ value: 'open', label: 'To answer', count: openCount }, { value: 'all', label: 'All' }]} />
        <div className="bk-filters" style={{ marginTop: 12 }}>
          <div className="bk-row bk-main">
            <label className="bk-search">
              <FiSearch size={17} />
              <input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="Search reference, name, email or phone" aria-label="Search enquiries" />
              {q ? <button type="button" className="bk-clear-x" aria-label="Clear search" onClick={() => setQ('')}><FiX size={15} /></button> : null}
            </label>
            <select className="input bk-select" value={kind} onChange={(e) => { setKind(e.target.value); setOffset(0); }} aria-label="Type">
              <option value="">All types</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <ErrorBox error={error} retry={reload} />
        {loading && !data ? <Loading /> : null}
        {data && !data.items.length ? <Empty icon={FiInbox} title={tab === 'open' ? 'Nothing to answer' : 'No enquiries yet'}>Enquiries from the website's forms appear here.</Empty> : null}
        {data?.items.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Reference</th><th>From</th><th>Type</th><th>About</th><th>Received</th><th>Status</th></tr></thead>
            <tbody>{data.items.map((e) => (
              <tr key={e.id} className="click" onClick={() => setOpened(e.id)}>
                <td className="cell-title">{e.ref}</td>
                <td><div>{e.name}</div><div className="cell-sub">{e.phone}</div></td>
                <td>{KIND[e.kind]}</td>
                <td><div>{e.vehicleLabel ?? e.service ?? '—'}</div>
                  <div className="cell-sub">{e.requestedDate ? `${fmtDate(e.requestedDate)}${e.requestedTime ? ` at ${e.requestedTime}` : ''}` : (e.message ?? '').slice(0, 60)}</div></td>
                <td>{fmtDateTime(e.createdAt)}</td>
                <td><Badge status={e.status} />{e.bookingRef ? <div className="cell-sub">{e.bookingRef}</div> : null}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : null}
        {data ? <Pager total={data.total} limit={25} offset={offset} onChange={setOffset} /> : null}
      </Panel>
      {open ? <EnquiryDrawer e={open} onClose={() => setOpened(null)} onSaved={() => { reload(); window.dispatchEvent(new Event(ENQUIRIES_CHANGED)); }} /> : null}
    </>
  );
}

function EnquiryDrawer({ e, onClose, onSaved }: { e: Enquiry; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(e.status);
  const [notes, setNotes] = useState(e.adminNotes ?? '');
  const [bookingRef, setBookingRef] = useState(e.bookingRef ?? '');
  const { run, busy, error } = useAction();
  const save = async () => {
    const r = await run(() => api(`/enquiries/${e.id}`, { method: 'PATCH', body: { status, adminNotes: notes.trim() || null, ...(bookingRef.trim() !== (e.bookingRef ?? '') ? { bookingRef: bookingRef.trim() || null } : {}) } }), 'Enquiry updated');
    if (r) onSaved();
  };
  const rows: [string, string | null][] = [
    ['Type', KIND[e.kind]], ['Service', e.service], ['Vehicle', e.vehicleLabel],
    ['Requested', e.requestedDate ? `${fmtDate(e.requestedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${e.requestedTime ? ` at ${e.requestedTime}` : ''}` : null],
    ['Pick-up', e.pickup], ['Drop-off', e.dropoff], ['Passengers', e.passengers != null ? String(e.passengers) : null], ['Luggage', e.luggage != null ? String(e.luggage) : null],
    ['Received', fmtDateTime(e.createdAt)], ['Last handled by', e.handledBy],
  ];
  return (
    <Drawer title={`${e.ref} · ${e.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Close</button><button className="btn gold" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <div className="row wrap" style={{ gap: 8 }}>
        <a className="btn sm" href={`mailto:${e.email}?subject=${encodeURIComponent(`Your enquiry ${e.ref}`)}`}><FiMail /> {e.email}</a>
        <a className="btn sm" href={`tel:${e.phone}`}><FiPhone /> {e.phone}</a>
      </div>
      <dl className="kv">{rows.filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
      {e.message ? <div className="field"><label>Message</label><div className="pre">{e.message}</div></div> : null}
      <SelectField label="Status" value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: s === 'converted' ? 'Booked' : humanize(s) }))} />
      <TextField label="Booking reference" value={bookingRef} onChange={(v) => setBookingRef(v.toUpperCase())} placeholder="e.g. SLX-50012"
        hint="Once you have made the booking (Bookings > New booking), link it here; the enquiry is marked as Booked" />
      {e.bookingId ? <button className="link-btn small" onClick={() => go('bookings/' + e.bookingId)}>Open booking {e.bookingRef}</button> : null}
      <TextField label="Internal notes" value={notes} onChange={setNotes} multiline hint="Only staff see these" />
      <ErrorBox error={error} />
    </Drawer>
  );
}
