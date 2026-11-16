import { useEffect, useState } from 'react';
import { FiCheckCircle, FiCopy } from 'react-icons/fi';
import { API_URL, api } from '../../lib/api';
import { NumberField, SelectField, TextField, ToggleField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox } from '../../components/feedback';
import { Badge, Panel } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useSettingsForm, type Payload, type S } from './settingsShared';

/** Settings this page edits; only the changed ones are sent. */
const KEYS = [
  'payment.mode', 'payment.depositPercentBp', 'payment.cardEnabled', 'payment.klarnaEnabled', 'payment.paypalEnabled', 'payment.allowUnpaidConfirmation',
  'booking.checkoutHoldMinutes', 'stripe.publishableKey', 'paypal.environment', 'paypal.clientId', 'paypal.webhookId',
];

function CopyUrl({ url }: { url: string }) {
  const toast = useToast();
  return (
    <div className="row" style={{ marginTop: 6 }}><code style={{ wordBreak: 'break-all' }}>{url}</code>
      <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(url).then(() => toast('Copied'), () => toast('Copy failed')); }}><FiCopy /> Copy</button></div>
  );
}

export function Payments({ s, secrets, onSaved }: { s: S; secrets: Payload['secrets']; onSaved: () => void }) {
  const f = useSettingsForm(s, onSaved);
  const [secretKey, setSecretKey] = useState('');
  const [whsec, setWhsec] = useState('');
  const [ppSecret, setPpSecret] = useState('');
  const [test, setTest] = useState<{ liveMode: boolean; currencies: string[] } | null>(null);
  const [ppTest, setPpTest] = useState<{ environment: string; webhookConfigured: boolean } | null>(null);
  const { run, busy, error } = useAction();
  const dep = (f.v['payment.depositPercentBp'] as number) / 100;
  const sk = secrets['stripe.secretKey'], wh = secrets['stripe.webhookSecret'], pp = secrets['paypal.clientSecret'] ?? { configured: false, hint: null };
  const stripeOn = sk.configured, paypalOn = !!f.v['paypal.clientId'] && pp.configured;
  useEffect(() => setTest(null), [sk.hint]);
  useEffect(() => setPpTest(null), [pp.hint]);

  const typed = !!(secretKey.trim() || whsec.trim() || ppSecret.trim());
  const saveAll = () => run(async () => {
    const settings = Object.fromEntries(KEYS.filter((k) => f.changed.includes(k)).map((k) => [k, f.v[k]]));
    const sec: Record<string, string> = {};
    if (secretKey.trim()) sec.stripeSecretKey = secretKey.trim();
    if (whsec.trim()) sec.stripeWebhookSecret = whsec.trim();
    if (ppSecret.trim()) sec.paypalClientSecret = ppSecret.trim();
    await api('/settings', { method: 'PUT', body: { settings, secrets: sec } });
    setSecretKey(''); setWhsec(''); setPpSecret('');
    onSaved();
  }, 'Payment settings saved');

  const options = [
    { on: f.v['payment.cardEnabled'] && stripeOn, label: f.v['payment.mode'] === 'deposit' ? `Card deposit (${dep}%) or card in full` : 'Card, in full' },
    { on: f.v['payment.klarnaEnabled'] && stripeOn, label: 'Klarna (financing, full amount)' },
    { on: f.v['payment.paypalEnabled'] && paypalOn, label: 'PayPal incl. Pay in 3 (financing, full amount)' },
  ];
  const live = options.filter((o) => o.on);

  const saveBar = (
    <>
      <ErrorBox error={error} /><ErrorBox error={f.error} />
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn gold" disabled={busy || f.busy || (!KEYS.some((k) => f.changed.includes(k)) && !typed)} onClick={saveAll}>{busy ? 'Saving…' : 'Save payment settings'}</button>
      </div>
    </>
  );

  return (
    <>
      <Panel title="How customers pay" hint="Every booking is secured by a payment. Card payers choose a deposit or the full amount; Klarna and PayPal pay you the full amount while the customer spreads the cost."
        action={<Badge status={live.length ? 'active' : 'inactive'} label={live.length ? `${live.length} option${live.length > 1 ? 's' : ''} live` : 'No online payment yet'} />}>
        <div className="form-grid">
          <SelectField label="Card payments" value={f.v['payment.mode'] as string} onChange={(v) => f.set('payment.mode', v)} options={[{ value: 'deposit', label: 'Deposit or full amount (customer chooses)' }, { value: 'full', label: 'Full amount only' }]} />
          <NumberField label="Default deposit (%)" value={dep} onChange={(v) => f.set('payment.depositPercentBp', Math.round((v ?? 0) * 100))} min={1} max={100} hint="Used when a vehicle has no fixed deposit. At least 1%." />
          <ToggleField label="Card (Stripe)" checked={!!f.v['payment.cardEnabled']} onChange={(v) => f.set('payment.cardEnabled', v)} hint={stripeOn ? 'Includes Apple Pay and Google Pay on supported devices' : 'Connect Stripe below first'} onText="Offered" offText="Off" />
          <ToggleField label="Klarna (via Stripe)" checked={!!f.v['payment.klarnaEnabled']} onChange={(v) => f.set('payment.klarnaEnabled', v)} hint="Also switch Klarna on in your Stripe dashboard (Settings > Payment methods)" onText="Offered" offText="Off" />
          <ToggleField label="PayPal" checked={!!f.v['payment.paypalEnabled']} onChange={(v) => f.set('payment.paypalEnabled', v)} hint={paypalOn ? 'Pay in 3 / Pay Later is offered by PayPal to eligible customers' : 'Add your PayPal keys below first'} onText="Offered" offText="Off" />
          <NumberField label="Hold the car while paying (minutes)" value={f.v['booking.checkoutHoldMinutes'] as number} onChange={(v) => f.set('booking.checkoutHoldMinutes', v ?? 30)} min={10} max={1440} hint="An unpaid website booking is released after this" />
          <div className="full"><ToggleField label="Allow staff to confirm unpaid bookings" checked={!!f.v['payment.allowUnpaidConfirmation']} onChange={(v) => f.set('payment.allowUnpaidConfirmation', v)} hint="Off (recommended): a booking is only confirmed once the deposit or payment is received. Record cash and bank transfers on the booking." onText="Allowed" offText="Not allowed" /></div>
        </div>
        {!live.length ? <div className="note" style={{ marginTop: 12 }}>No payment option is live yet, so website bookings arrive as requests and customers are asked to pay by link once you approve them.</div>
          : <div className="muted small" style={{ marginTop: 12 }}>Customers will see: {live.map((o) => o.label).join(' · ')}</div>}
        {saveBar}
      </Panel>

      <Panel title="Stripe (cards and Klarna)" hint="Keys are stored encrypted and are never shown again after saving."
        action={<Badge status={sk.configured ? 'active' : 'inactive'} label={sk.configured ? 'Secret key set' : 'Not connected'} />}>
        <div className="form-grid">
          <div className="full"><TextField label="Publishable key" value={f.v['stripe.publishableKey'] as string} onChange={(v) => f.set('stripe.publishableKey', v.trim())} placeholder="pk_test_…" hint="Public by design." error={(f.v['stripe.publishableKey'] as string) && !/^pk_(test|live)_/.test(f.v['stripe.publishableKey'] as string) ? 'Must start with pk_test_ or pk_live_' : undefined} /></div>
          <TextField label="Secret key" type="password" value={secretKey} onChange={setSecretKey} placeholder={sk.configured ? `Saved (ends ${sk.hint}). Enter a new key to replace.` : 'sk_test_… or rk_test_…'} hint="Use a test-mode key until you go live" />
          <TextField label="Webhook signing secret" type="password" value={whsec} onChange={setWhsec} placeholder={wh.configured ? `Saved (ends ${wh.hint}). Enter a new secret to replace.` : 'whsec_…'} />
        </div>
        <div className="note" style={{ marginTop: 16 }}>
          <div>In the Stripe dashboard add a webhook endpoint pointing to:</div>
          <CopyUrl url={`${API_URL}/api/webhooks/stripe`} />
          <div className="muted small" style={{ marginTop: 6 }}>Events: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, refund.created, refund.updated. Stripe cannot reach localhost; use the Stripe CLI (stripe listen) for local testing.</div>
        </div>
        {test ? <div className="note" style={{ marginTop: 12 }}><FiCheckCircle /> Connected to Stripe in <b>{test.liveMode ? 'LIVE' : 'test'}</b> mode. Balance currencies: {test.currencies.join(', ') || 'none'}.</div> : null}
        {saveBar}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" disabled={busy || !sk.configured || !!secretKey.trim()} onClick={() => run(async () => setTest(await api('/settings/stripe/test', { method: 'POST' })))}>Test Stripe connection</button>
        </div>
      </Panel>

      <Panel title="PayPal" hint="From developer.paypal.com > Apps & Credentials: create a REST app and copy its Client ID and Secret. The secret is stored encrypted."
        action={<Badge status={paypalOn ? 'active' : 'inactive'} label={paypalOn ? `Connected (${f.v['paypal.environment']})` : 'Not connected'} />}>
        <div className="form-grid">
          <SelectField label="Environment" value={f.v['paypal.environment'] as string} onChange={(v) => f.set('paypal.environment', v)} options={[{ value: 'sandbox', label: 'Sandbox (testing)' }, { value: 'live', label: 'Live' }]} hint="Sandbox and live apps have different keys" />
          <TextField label="Client ID" value={f.v['paypal.clientId'] as string} onChange={(v) => f.set('paypal.clientId', v.trim())} placeholder="A…" />
          <TextField label="Client secret" type="password" value={ppSecret} onChange={setPpSecret} placeholder={pp.configured ? `Saved (ends ${pp.hint}). Enter a new secret to replace.` : 'E…'} />
          <TextField label="Webhook ID" value={f.v['paypal.webhookId'] as string} onChange={(v) => f.set('paypal.webhookId', v.trim())} placeholder="e.g. 1AB23456CD789012E" hint="Shown after you add the webhook below" />
        </div>
        <div className="note" style={{ marginTop: 16 }}>
          <div>In your PayPal REST app, add a webhook pointing to:</div>
          <CopyUrl url={`${API_URL}/api/webhooks/paypal`} />
          <div className="muted small" style={{ marginTop: 6 }}>Events: Checkout order approved, Payment capture completed, Payment capture denied, Payment capture refunded. Customers come back through {`${API_URL}/api/public/paypal/return`}, so the API must be reachable on that address (set PUBLIC_API_URL on the server).</div>
        </div>
        {ppTest ? <div className="note" style={{ marginTop: 12 }}><FiCheckCircle /> Connected to PayPal ({ppTest.environment}). {ppTest.webhookConfigured ? 'Webhook ID saved.' : 'Add the webhook ID so PayPal can confirm payments if a customer closes the page early.'}</div> : null}
        {saveBar}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" disabled={busy || !paypalOn || !!ppSecret.trim() || f.changed.some((k) => k.startsWith('paypal.'))} onClick={() => run(async () => setPpTest(await api('/settings/paypal/test', { method: 'POST' })))}>Test PayPal connection</button>
        </div>
      </Panel>
    </>
  );
}
