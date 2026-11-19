import { Fragment, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiDollarSign, FiHeadphones, FiInbox, FiMessageSquare, FiSearch, FiShoppingCart, FiUserPlus } from 'react-icons/fi';
import { qs, useApi } from '../../lib/api';
import { useDebounced } from '../../lib/hooks';
import { Pager } from '../../components/Pager';
import { ErrorBox, Loading } from '../../components/feedback';
import { TextField } from '../../components/forms';
import { Badge, Drawer, Empty, Panel, Stat, Tabs } from '../../components/ui';
import { addDays, fmtDateTime, gbp, humanize, ymd } from '../../lib/format';
import { go } from '../../lib/nav';
import { ChatbotSettings } from './ChatbotSettings';

/*
 * Chat assistant (owner and administrators): what the website chat is doing (from the conversation, lead and booking
 * records), the conversations themselves, and its settings. Leads it captures are worked in Enquiries.
 */

type Analytics = {
  conversations: number; inquiries: number; leads: number; handovers: number; priceChecks: number; availabilityChecks: number; bookingSummaries: number;
  bookingsStarted: number; bookingsCompleted: number; checkoutAbandoned: number; awaitingConfirmation: number; paidPence: number;
  checkoutAbandonmentRate: number; leadConversionRate: number; leadsLost: number; errors: number;
  topQuestions: { question: string; count: number }[]; topServices: { service: string; count: number }[];
};
type Conv = {
  id: string; createdAt: string; lastMessageAt: string; messages: number; intents: string[]; services: string[]; handoverAt: string | null; errors: number;
  firstMessage: string | null; enquiryId: string | null; leadRef: string | null; leadName: string | null; leadStatus: string | null; bookingRef: string | null; bookingStatus: string | null; paymentStatus: string | null;
};
type Transcript = Conv & { bookingId: string | null; transcript: { role: string; text: string | null; cards: { type: string; reference?: string; totalPence?: number }[]; tools: string[]; createdAt: string }[] };

export default function Chatbot() {
  const [tab, setTab] = useState<'overview' | 'conversations' | 'settings'>('overview');
  const [from, setFrom] = useState(ymd(addDays(new Date(), -30)));
  const [to, setTo] = useState(ymd(new Date()));
  return (
    <>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Overview' }, { value: 'conversations', label: 'Conversations' }, { value: 'settings', label: 'Settings' }]} />
      {tab !== 'settings' ? (
        <div className="form-grid" style={{ maxWidth: 420, marginTop: 12 }}>
          <TextField label="From" type="date" value={from} onChange={setFrom} />
          <TextField label="To" type="date" value={to} onChange={setTo} />
        </div>
      ) : null}
      {tab === 'overview' ? <Overview from={from} to={to} /> : null}
      {tab === 'conversations' ? <Conversations from={from} to={to} /> : null}
      {tab === 'settings' ? <ChatbotSettings /> : null}
    </>
  );
}

function Overview({ from, to }: { from: string; to: string }) {
  const { data: a, error, loading, reload } = useApi<Analytics>('/chatbot/analytics' + qs({ from, to }));
  if (loading && !a) return <Loading />;
  if (!a) return <ErrorBox error={error} retry={reload} />;
  return (
    <>
      <div className="grid g-4">
        <Stat icon={FiMessageSquare} label="Conversations" value={String(a.conversations)} delta={`${a.inquiries} with a question`} />
        <Stat icon={FiUserPlus} label="Leads" value={String(a.leads)} delta={`${a.leadConversionRate}% booked · ${a.leadsLost} lost`} />
        <Stat icon={FiShoppingCart} label="Bookings started" value={String(a.bookingsStarted)} delta={`${a.bookingSummaries} summaries shown`} />
        <Stat icon={FiCheckCircle} label="Bookings paid" value={String(a.bookingsCompleted)} delta={gbp(a.paidPence)} feature />
        <Stat icon={FiAlertCircle} label="Checkout abandoned" value={String(a.checkoutAbandoned)} delta={`${a.checkoutAbandonmentRate}% of started${a.awaitingConfirmation ? ` · ${a.awaitingConfirmation} awaiting our confirmation` : ''}`} trend={a.checkoutAbandoned ? 'down' : undefined} />
        <Stat icon={FiHeadphones} label="Asked for the team" value={String(a.handovers)} />
        <Stat icon={FiDollarSign} label="Price checks" value={String(a.priceChecks)} delta={`${a.availabilityChecks} availability checks`} />
        <Stat icon={FiAlertCircle} label="Could not answer" value={String(a.errors)} delta="Provider or system errors" />
      </div>
      <div className="grid g-2" style={{ marginTop: 16 }}>
        <Panel title="Most asked" hint="The first message of each conversation">
          {a.topQuestions.length ? <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>{a.topQuestions.map((q) => <Fragment key={q.question}><dt>{q.question}</dt><dd>{q.count}</dd></Fragment>)}</dl> : <span className="muted small">No conversations in this period.</span>}
        </Panel>
        <Panel title="Most requested services" hint="Services customers asked for prices or bookings on">
          {a.topServices.length ? <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>{a.topServices.map((s) => <Fragment key={s.service}><dt>{s.service}</dt><dd>{s.count}</dd></Fragment>)}</dl> : <span className="muted small">None yet.</span>}
        </Panel>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => go('enquiries')}><FiInbox /> Work the leads in Enquiries</button>
      </div>
    </>
  );
}

function Conversations({ from, to }: { from: string; to: string }) {
  const [filter, setFilter] = useState<'all' | 'handover' | 'booking'>('all');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<{ items: Conv[]; total: number }>('/chatbot/conversations' + qs({ from, to, q: dq, handover: filter === 'handover' ? 'true' : '', booking: filter === 'booking' ? 'true' : '', limit: 25, offset }));
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <Panel title="Conversations" hint="What visitors asked and what the assistant replied. Conversations are deleted after the retention period in Settings.">
      <Tabs value={filter} onChange={(f) => { setFilter(f); setOffset(0); }} items={[{ value: 'all', label: 'All' }, { value: 'handover', label: 'Asked for the team' }, { value: 'booking', label: 'Started a booking' }]} />
      <label className="bk-search" style={{ margin: '12px 0' }}><FiSearch size={17} /><input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="Search messages, names, references" aria-label="Search conversations" /></label>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && !data.items.length ? <Empty icon={FiMessageSquare} title="No conversations">Conversations from the website chat appear here.</Empty> : null}
      {data?.items.length ? (
        <div className="table-wrap"><table>
          <thead><tr><th>Started</th><th>First message</th><th>Messages</th><th>Lead</th><th>Booking</th></tr></thead>
          <tbody>{data.items.map((c) => (
            <tr key={c.id} className="click" onClick={() => setOpened(c.id)}>
              <td>{fmtDateTime(c.createdAt)}{c.handoverAt ? <div className="cell-sub">Asked for the team</div> : null}</td>
              <td><div className="cell-title">{(c.firstMessage ?? '').slice(0, 80)}</div><div className="cell-sub">{c.intents.map(humanize).join(', ')}</div></td>
              <td>{c.messages}</td>
              <td>{c.leadRef ? <><div>{c.leadName}</div><Badge status={c.leadStatus ?? 'new'} /></> : '—'}</td>
              <td>{c.bookingRef ? <><div>{c.bookingRef}</div><Badge status={c.paymentStatus === 'unpaid' ? c.bookingStatus ?? 'pending' : c.paymentStatus ?? ''} /></> : '—'}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : null}
      {data ? <Pager total={data.total} limit={25} offset={offset} onChange={setOffset} /> : null}
      {opened ? <TranscriptDrawer id={opened} onClose={() => setOpened(null)} /> : null}
    </Panel>
  );
}

function TranscriptDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, loading } = useApi<Transcript>(`/chatbot/conversations/${id}`);
  return (
    <Drawer title="Conversation" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <div className="row wrap" style={{ gap: 8 }}>
            {data.enquiryId ? <button className="btn sm" onClick={() => go('enquiries/' + data.enquiryId)}>Lead {data.leadRef}</button> : null}
            {data.bookingId ? <button className="btn sm" onClick={() => go('bookings/' + data.bookingId)}>Booking {data.bookingRef}</button> : null}
          </div>
          <div className="list">
            {data.transcript.map((m, i) => (
              <div key={i} className="list-item" style={{ display: 'block', background: m.role === 'user' ? 'var(--gold-soft)' : undefined }}>
                <div className="small muted">{m.role === 'user' ? 'Visitor' : 'Assistant'} · {fmtDateTime(m.createdAt)}{m.tools.length ? ` · checked: ${m.tools.map(humanize).join(', ')}` : ''}</div>
                {m.text ? <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div> : null}
                {m.cards.length ? <div className="small muted">Shown: {m.cards.map((c) => humanize(c.type) + (c.totalPence != null ? ` ${gbp(c.totalPence)}` : '') + (c.reference ? ` ${c.reference}` : '')).join(', ')}</div> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
