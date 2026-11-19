import { Fragment, useEffect, useState } from 'react';
import { FiCalendar, FiInbox, FiMail, FiPhone, FiSearch, FiX } from 'react-icons/fi';
import { api, qs, useApi } from '../../lib/api';
import { useAction, useDebounced } from '../../lib/hooks';
import { Pager } from '../../components/Pager';
import { ErrorBox, Loading } from '../../components/feedback';
import { SelectField, TextField } from '../../components/forms';
import { Badge, Drawer, Empty, Panel, Tabs } from '../../components/ui';
import { fmtDate, fmtDateTime, humanize } from '../../lib/format';
import { go } from '../../lib/nav';
import { NewBooking } from '../bookings/NewBooking';

/*
 * Enquiries from the website: the contact and home-page forms, quote requests (a vehicle priced on application)
 * and requests for a pick-up time the calendar showed as taken. Staff reply by phone or email, then mark progress
 * here, and link the booking once one is made.
 */

export type Enquiry = {
  id: string; ref: string; kind: 'contact' | 'query' | 'quote' | 'slot' | 'chat' | 'support'; status: string; name: string; email: string | null; phone: string | null;
  service: string | null; vehicleLabel: string | null; vehicleId: string | null; pickup: string | null; dropoff: string | null;
  requestedDate: string | null; requestedTime: string | null; passengers: number | null; luggage: number | null; message: string | null;
  adminNotes: string | null; bookingId: string | null; bookingRef: string | null; handledBy: string | null; createdAt: string; updatedAt: string;
  source: 'website_form' | 'chatbot'; assignedTo: string | null; assignedName: string | null; conversationId: string | null;
  bookingStatus: string | null; paymentStatus: string | null; checkoutAbandoned: boolean | null;
  details: { summary?: string; interest?: string; budget?: string | null; callbackRequested?: boolean; quotedTotal?: string; handover?: { reason: string; at: string }; checkout?: { reference: string; startedAt: string }; request?: string; bookingRef?: string } | null;
};

const KIND: Record<Enquiry['kind'], string> = { contact: 'Contact form', query: 'Website query', quote: 'Quote request', slot: 'Unavailable time', chat: 'Chat lead', support: 'Chat: booking change' };
const STATUSES = ['new', 'contacted', 'interested', 'follow_up', 'in_progress', 'quoted', 'converted', 'lost', 'closed'];
export const ENQUIRIES_CHANGED = 'enquiries-changed';

export default function Enquiries({ openId }: { openId?: string }) {
  const [tab, setTab] = useState<'open' | 'all' | 'abandoned' | 'mine'>('open');
  const [kind, setKind] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<{ items: Enquiry[]; total: number; counts: Record<string, number> }>(
    '/enquiries' + qs({ open: tab === 'open' ? 'true' : '', abandoned: tab === 'abandoned' ? 'true' : '', assigned: tab === 'mine' ? 'me' : '', kind, source, status, from, to, q: dq, limit: 25, offset }));
  const [opened, setOpened] = useState<string | null>(openId ?? null);
  const [booking, setBooking] = useState<Enquiry | null>(null);
  useEffect(() => setOpened(openId ?? null), [openId]);
  const open = data?.items.find((e) => e.id === opened);
  const openCount = ['new', 'contacted', 'in_progress', 'interested', 'follow_up'].reduce((n, k) => n + (data?.counts[k] ?? 0), 0);

  return (
    <>
      <Panel title="Enquiries" hint="Leads, messages and quote requests from the website forms and the chat assistant. Contact the customer, then update the status here, or create the booking.">
        <Tabs value={tab} onChange={(t) => { setTab(t); setOffset(0); }} items={[{ value: 'open', label: 'To answer', count: openCount }, { value: 'mine', label: 'Assigned to me' }, { value: 'abandoned', label: 'Checkout not paid' }, { value: 'all', label: 'All' }]} />
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
            <select className="input bk-select" value={source} onChange={(e) => { setSource(e.target.value); setOffset(0); }} aria-label="Source">
              <option value="">All sources</option><option value="website_form">Website forms</option><option value="chatbot">Chat assistant</option>
            </select>
            <select className="input bk-select" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }} aria-label="Status">
              <option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{s === 'converted' ? 'Booked' : humanize(s)}</option>)}
            </select>
            <input className="input bk-select" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0); }} aria-label="Received from" title="Received from" />
            <input className="input bk-select" type="date" value={to} onChange={(e) => { setTo(e.target.value); setOffset(0); }} aria-label="Received to" title="Received to" />
          </div>
        </div>
        <ErrorBox error={error} retry={reload} />
        {loading && !data ? <Loading /> : null}
        {data && !data.items.length ? <Empty icon={FiInbox} title={tab === 'open' ? 'Nothing to answer' : 'No enquiries yet'}>Enquiries from the website's forms appear here.</Empty> : null}
        {data?.items.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Reference</th><th>From</th><th>Type</th><th>About</th><th>Received</th><th>Assigned</th><th>Status</th></tr></thead>
            <tbody>{data.items.map((e) => (
              <tr key={e.id} className="click" onClick={() => setOpened(e.id)}>
                <td className="cell-title">{e.ref}</td>
                <td><div>{e.name}</div><div className="cell-sub">{e.phone ?? e.email}</div></td>
                <td>{KIND[e.kind]}</td>
                <td><div>{e.vehicleLabel ?? e.service ?? '—'}</div>
                  <div className="cell-sub">{e.requestedDate ? `${fmtDate(e.requestedDate)}${e.requestedTime ? ` at ${e.requestedTime}` : ''}` : (e.details?.summary ?? e.message ?? '').slice(0, 60)}</div></td>
                <td>{fmtDateTime(e.createdAt)}</td>
                <td>{e.assignedName ?? '—'}</td>
                <td><Badge status={e.status} />{e.bookingRef ? <div className="cell-sub">{e.bookingRef}{e.checkoutAbandoned ? ' · not paid' : ''}</div> : null}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : null}
        {data ? <Pager total={data.total} limit={25} offset={offset} onChange={setOffset} /> : null}
      </Panel>
      {open && !booking ? <EnquiryDrawer e={open} onClose={() => setOpened(null)} onBook={() => setBooking(open)} onSaved={() => { reload(); window.dispatchEvent(new Event(ENQUIRIES_CHANGED)); }} /> : null}
      {booking ? <NewBooking fromEnquiry={booking} onClose={() => setBooking(null)}
        onCreated={(id) => { setBooking(null); setOpened(null); window.dispatchEvent(new Event(ENQUIRIES_CHANGED)); go('bookings/' + id); }} /> : null}
    </>
  );
}

function EnquiryDrawer({ e, onClose, onSaved, onBook }: { e: Enquiry; onClose: () => void; onSaved: () => void; onBook: () => void }) {
  const [status, setStatus] = useState(e.status);
  const [notes, setNotes] = useState(e.adminNotes ?? '');
  const [bookingRef, setBookingRef] = useState(e.bookingRef ?? '');
  const [assignedTo, setAssignedTo] = useState(e.assignedTo ?? '');
  const { data: staff } = useApi<{ items: { id: string; name: string }[] }>('/enquiries/assignees');
  const { run, busy, error } = useAction();
  const save = async () => {
    const r = await run(() => api(`/enquiries/${e.id}`, { method: 'PATCH', body: { status, adminNotes: notes.trim() || null, ...(assignedTo !== (e.assignedTo ?? '') ? { assignedTo: assignedTo || null } : {}), ...(bookingRef.trim() !== (e.bookingRef ?? '') ? { bookingRef: bookingRef.trim() || null } : {}) } }), 'Enquiry updated');
    if (r) onSaved();
  };
  const rows: [string, string | null][] = [
    ['Type', KIND[e.kind]], ['Source', e.source === 'chatbot' ? 'Chat assistant' : 'Website form'], ['Interested in', e.details?.interest ?? null], ['Service', e.service], ['Vehicle', e.vehicleLabel],
    ['Budget', e.details?.budget ?? null], ['Quoted in chat', e.details?.quotedTotal ?? null], ['Callback requested', e.details?.callbackRequested ? 'Yes' : null],
    ['Asked for the team', e.details?.handover ? `${humanize(e.details.handover.reason)}, ${fmtDateTime(e.details.handover.at)}` : null],
    ['Checkout', e.details?.checkout ? `${e.details.checkout.reference} started ${fmtDateTime(e.details.checkout.startedAt)}${e.checkoutAbandoned ? ' · not paid yet' : e.paymentStatus ? ` · ${humanize(e.paymentStatus)}` : ''}` : null],
    ['Requested', e.requestedDate ? `${fmtDate(e.requestedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${e.requestedTime ? ` at ${e.requestedTime}` : ''}` : null],
    ['Pick-up', e.pickup], ['Drop-off', e.dropoff], ['Passengers', e.passengers != null ? String(e.passengers) : null], ['Luggage', e.luggage != null ? String(e.luggage) : null],
    ['Received', fmtDateTime(e.createdAt)], ['Last handled by', e.handledBy],
  ];
  return (
    <Drawer title={`${e.ref} · ${e.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Close</button><button className="btn gold" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <div className="row wrap" style={{ gap: 8 }}>
        {e.email ? <a className="btn sm" href={`mailto:${e.email}?subject=${encodeURIComponent(`Your enquiry ${e.ref}`)}`}><FiMail /> {e.email}</a> : null}
        {e.phone ? <a className="btn sm" href={`tel:${e.phone}`}><FiPhone /> {e.phone}</a> : null}
        {!e.bookingId ? <button className="btn sm gold" onClick={onBook}><FiCalendar /> Create booking</button> : null}
      </div>
      <dl className="kv">{rows.filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
      {e.details?.summary && e.details.summary !== e.message ? <div className="field"><label>Conversation summary</label><div className="pre">{e.details.summary}</div></div> : null}
      {e.message ? <div className="field"><label>Message</label><div className="pre">{e.message}</div></div> : null}
      {e.conversationId ? <button className="link-btn small" onClick={() => go('chatbot')}>See the chat in Chat assistant &gt; Conversations</button> : null}
      <SelectField label="Assigned to" value={assignedTo} onChange={setAssignedTo} options={[{ value: '', label: 'Nobody' }, ...(staff?.items ?? []).map((x) => ({ value: x.id, label: x.name }))]} />
      <SelectField label="Status" value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: s === 'converted' ? 'Booked' : humanize(s) }))} />
      <TextField label="Booking reference" value={bookingRef} onChange={(v) => setBookingRef(v.toUpperCase())} placeholder="e.g. SLX-50012"
        hint="Create booking (above) links it automatically. For a booking made another way, enter its reference; the enquiry is marked as Booked" />
      {e.bookingId ? <button className="link-btn small" onClick={() => go('bookings/' + e.bookingId)}>Open booking {e.bookingRef}</button> : null}
      <TextField label="Internal notes" value={notes} onChange={setNotes} multiline hint="Only staff see these" />
      <ErrorBox error={error} />
    </Drawer>
  );
}
