import { useState } from 'react';
import { FiPlus, FiSend, FiTrash2 } from 'react-icons/fi';
import { api, useApi } from '../../lib/api';
import { NumberField, SelectField, TextField, ToggleField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox, Loading } from '../../components/feedback';
import { Panel } from '../../components/ui';

/*
 * Settings > Chat assistant. Everything the website's AI assistant uses: the provider key (stored encrypted; only its
 * last characters are ever shown), the model, its name and look, what it may do, and business knowledge for general
 * questions. Prices, times and bookings always come from the booking system, never from these settings.
 */

export type ChatConfig = {
  enabled: boolean; maintenance: boolean; maintenanceMessage: string; provider: Provider; model: string; effort: 'low' | 'medium' | 'high';
  maxReplyTokens: number; instructions: string; name: string; welcomeMessage: string; suggestions: string[];
  appearance: { accent: string; position: 'bottom-right' | 'bottom-left'; icon: 'chat' | 'concierge' | 'car' }; languages: string[];
  maxMessagesPerConversation: number; retentionDays: number;
  features: { availability: boolean; pricing: boolean; booking: boolean; bookingLookup: boolean; leadCapture: boolean; humanHandover: boolean };
  knowledge: { question: string; answer: string }[];
};
type Provider = 'anthropic' | 'openai';
type KeyStatus = { configured: boolean; hint: string | null };
type Payload = { config: ChatConfig; models: { id: string; label: string; provider: Provider }[]; providers: Provider[]; apiKey: KeyStatus; apiKeys: Record<Provider, KeyStatus> };

const PROVIDERS: Record<Provider, { label: string; placeholder: string; hint: string }> = {
  anthropic: { label: 'Anthropic (Claude)', placeholder: 'sk-ant-...', hint: 'From console.anthropic.com > API keys' },
  openai: { label: 'OpenAI (GPT)', placeholder: 'sk-...', hint: 'From platform.openai.com > API keys' },
};

const FEATURES: [keyof ChatConfig['features'], string, string][] = [
  ['availability', 'Check availability', 'Shows free pick-up times from the live diary.'],
  ['pricing', 'Give prices', 'Exact prices from the pricing engine, with the deposit.'],
  ['booking', 'Take bookings', 'Shows a booking summary; the customer accepts the terms and pays on the normal payment page.'],
  ['bookingLookup', 'Existing bookings', 'After an emailed code: status, payment links, and change or cancellation requests for the team.'],
  ['leadCapture', 'Save leads', 'Saves interested visitors to Enquiries with a summary.'],
  ['humanHandover', 'Speak to the team', 'Lets visitors ask for a person; the request goes to Enquiries and the owner is emailed.'],
];

export function ChatbotSettings() {
  const { data, error, loading, reload } = useApi<Payload>('/chatbot/settings');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} retry={reload} />;
  return <Editor key={JSON.stringify(data)} data={data} onSaved={reload} />;
}

function Editor({ data, onSaved }: { data: Payload; onSaved: () => void }) {
  const [c, setC] = useState<ChatConfig>(data.config);
  const [key, setKey] = useState('');
  const { run, busy, error } = useAction();
  const set = <K extends keyof ChatConfig>(k: K, v: ChatConfig[K]) => setC((x) => ({ ...x, [k]: v }));
  // Each provider keeps its own saved key; the fields below always show the chosen provider's.
  const saved = data.apiKeys?.[c.provider] ?? data.apiKey;
  const meta = PROVIDERS[c.provider];
  const models = data.models.filter((m) => m.provider === c.provider);
  const setProvider = (p: Provider) => { setKey(''); setC((x) => ({ ...x, provider: p, model: data.models.find((m) => m.provider === p)?.id ?? x.model })); };
  const save = async () => {
    const r = await run(() => api('/chatbot/settings', { method: 'PUT', body: { config: c, ...(key.trim() ? { apiKey: key.trim(), provider: c.provider } : {}) } }), 'Chat assistant saved');
    if (r) { setKey(''); onSaved(); }
  };
  const clearKey = async () => {
    if (!confirm(`Remove the saved ${meta.label} API key? The chat assistant stops answering until a new key is saved.`)) return;
    const r = await run(() => api('/chatbot/settings', { method: 'PUT', body: { clearApiKey: true, provider: c.provider, config: { ...c, enabled: false } } }), 'API key removed');
    if (r) onSaved();
  };
  const knowledge = (i: number, patch: Partial<ChatConfig['knowledge'][number]> | null) =>
    set('knowledge', patch ? c.knowledge.map((k, j) => (j === i ? { ...k, ...patch } : k)) : c.knowledge.filter((_, j) => j !== i));

  return (
    <>
      <Panel title="Chat assistant" hint="An AI assistant on the website that answers questions, checks availability, gives exact prices and helps customers book. It only uses information from your booking system and the knowledge below.">
        <div className="form-grid">
          <ToggleField label="Show on the website" checked={c.enabled} onChange={(v) => set('enabled', v)} onText="On" offText="Off" hint={saved.configured || key ? undefined : 'Save an API key first'} />
          <ToggleField label="Maintenance mode" checked={c.maintenance} onChange={(v) => set('maintenance', v)} onText="On" offText="Off" hint="Shows the message below instead of answering." />
        </div>
        {c.maintenance ? <TextField label="Maintenance message" value={c.maintenanceMessage} onChange={(v) => set('maintenanceMessage', v)} /> : null}
      </Panel>

      <Panel title="AI provider" hint="The key is stored encrypted on the server and never sent to the website or shown again.">
        <div className="form-grid">
          <SelectField label="Provider" value={c.provider} onChange={(v) => setProvider(v as Provider)}
            options={(data.providers ?? ['anthropic']).map((p) => ({ value: p, label: PROVIDERS[p]?.label ?? p }))} />
          <SelectField label="Model" value={c.model} onChange={(v) => set('model', v)} options={models.map((m) => ({ value: m.id, label: m.label }))} />
          <TextField label={saved.configured ? `${meta.label} API key (saved, ending ${saved.hint})` : `${meta.label} API key`} type="password" value={key} onChange={setKey}
            placeholder={saved.configured ? 'Leave blank to keep the saved key' : meta.placeholder} hint={meta.hint} />
          <SelectField label="Response depth" value={c.effort} onChange={(v) => set('effort', v as ChatConfig['effort'])}
            hint="How much the model thinks before answering: Quick replies fastest; Careful is slowest but most thorough."
            options={[{ value: 'low', label: 'Quick' }, { value: 'medium', label: 'Balanced (recommended)' }, { value: 'high', label: 'Careful' }]} />
          <NumberField label="Longest reply (tokens)" value={c.maxReplyTokens} min={256} max={16000} onChange={(v) => set('maxReplyTokens', v ?? 2048)} hint="About 750 words per 1,000 tokens" />
        </div>
        {saved.configured ? <button className="btn sm" onClick={clearKey}><FiTrash2 /> Remove saved key</button> : null}
      </Panel>

      <Panel title="Name and look">
        <div className="form-grid">
          <TextField label="Assistant name" value={c.name} onChange={(v) => set('name', v)} />
          <TextField label="Accent colour" value={c.appearance.accent} onChange={(v) => set('appearance', { ...c.appearance, accent: v })} hint="Like #FFD700" />
          <SelectField label="Position" value={c.appearance.position} onChange={(v) => set('appearance', { ...c.appearance, position: v as ChatConfig['appearance']['position'] })} options={[{ value: 'bottom-right', label: 'Bottom right' }, { value: 'bottom-left', label: 'Bottom left' }]} />
          <SelectField label="Icon" value={c.appearance.icon} onChange={(v) => set('appearance', { ...c.appearance, icon: v as ChatConfig['appearance']['icon'] })} options={[{ value: 'chat', label: 'Speech bubble' }, { value: 'concierge', label: 'Concierge' }, { value: 'car', label: 'Car' }]} />
        </div>
        <TextField label="Welcome message" value={c.welcomeMessage} onChange={(v) => set('welcomeMessage', v)} multiline />
        <TextField label="Suggested questions" value={c.suggestions.join('\n')} onChange={(v) => set('suggestions', v.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 6))} multiline hint="One per line, up to 6" />
        <TextField label="Languages" value={c.languages.join(', ')} onChange={(v) => set('languages', v.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))} hint="Two-letter codes, e.g. en, fr, ar. The assistant replies in the visitor's language when it is one of these." />
      </Panel>

      <Panel title="What it can do">
        {FEATURES.map(([k, label, hint]) => <ToggleField key={k} label={label} hint={hint} checked={c.features[k]} onChange={(v) => set('features', { ...c.features, [k]: v })} onText="On" offText="Off" />)}
        <div className="form-grid">
          <NumberField label="Messages per conversation" value={c.maxMessagesPerConversation} min={5} max={200} onChange={(v) => set('maxMessagesPerConversation', v ?? 40)} hint="Then the visitor starts a new chat" />
          <NumberField label="Keep conversations for (days)" value={c.retentionDays} min={1} max={730} onChange={(v) => set('retentionDays', v ?? 90)} hint="Then they are deleted; leads stay in Enquiries" />
        </div>
      </Panel>

      <Panel title="Instructions and knowledge" hint="General information the assistant may use. Never put prices or availability here: those always come from the booking system.">
        <TextField label="Extra instructions" value={c.instructions} onChange={(v) => set('instructions', v)} multiline
          hint="Tone, what to mention, what to avoid. These are added to the built-in rules (accuracy, privacy, payment safety), which they cannot switch off." />
        {c.knowledge.map((k, i) => (
          <div key={i} className="note" style={{ marginBottom: 8 }}>
            <TextField label={`Question ${i + 1}`} value={k.question} onChange={(v) => knowledge(i, { question: v })} />
            <TextField label="Answer" value={k.answer} onChange={(v) => knowledge(i, { answer: v })} multiline />
            <button className="btn sm" onClick={() => knowledge(i, null)}><FiTrash2 /> Remove</button>
          </div>
        ))}
        <button className="btn sm" onClick={() => set('knowledge', [...c.knowledge, { question: '', answer: '' }])}><FiPlus /> Add a question and answer</button>
      </Panel>

      <ErrorBox error={error} />
      <div className="row" style={{ marginBottom: 16 }}><button className="btn gold" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></div>

      <TestConsole config={c} apiKey={key.trim() || null} />
    </>
  );
}

type Turn = { role: 'user' | 'assistant'; text: string; detail?: string };

/** Try the settings above (saved or not) before publishing. Nothing is stored and no lead, code or email is sent. */
function TestConsole({ config, apiKey }: { config: ChatConfig; apiKey: string | null }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const { run, busy, error } = useAction();
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    const r = await run(() => api<{ text: string; cards: { type: string }[]; error: string | null; toolsUsed: string[] }>('/chatbot/test', {
      body: { config: { ...config, knowledge: config.knowledge.filter((k) => k.question.trim() && k.answer.trim()) }, ...(apiKey ? { apiKey } : {}), history: turns.map(({ role, text: x }) => ({ role, text: x })), text: t },
    }));
    if (r) {
      setText('');
      const detail = [r.toolsUsed.length ? `Used: ${r.toolsUsed.join(', ')}` : null, r.cards.length ? `Cards: ${r.cards.map((k) => k.type).join(', ')}` : null, r.error ? `Problem: ${r.error}` : null].filter(Boolean).join(' · ');
      setTurns((x) => [...x, { role: 'user', text: t }, { role: 'assistant', text: r.text || '(no reply)', detail }]);
    }
  };
  return (
    <Panel title="Try it" hint="Uses the settings above, even before you save them. It reads real prices and times; it does not save leads, send codes or contact the team.">
      <div className="list" style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 8 }}>
        {turns.map((m, i) => (
          <div key={i} className="list-item" style={{ display: 'block' }}>
            <div className="small muted">{m.role === 'user' ? 'You' : config.name}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
            {m.detail ? <div className="small muted">{m.detail}</div> : null}
          </div>
        ))}
        {!turns.length ? <div className="muted small" style={{ padding: 8 }}>Ask something a customer might, e.g. "How much is a Heathrow transfer in an S-Class on Friday at 9am?"</div> : null}
      </div>
      <ErrorBox error={error} />
      <div className="row">
        <input className="input" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Type a test message" />
        <button className="btn gold" disabled={busy || !text.trim()} onClick={send}><FiSend /> {busy ? 'Waiting…' : 'Send'}</button>
        {turns.length ? <button className="btn" onClick={() => setTurns([])}>Clear</button> : null}
      </div>
    </Panel>
  );
}
