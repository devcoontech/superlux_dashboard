import { useEffect, useState } from 'react';
import { FiFileText, FiPlus } from 'react-icons/fi';
import { api, useApi } from '../../lib/api';
import { TextField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox, Loading } from '../../components/feedback';
import { Badge, Empty, Panel } from '../../components/ui';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { fmtDateTime } from '../../lib/format';

type Version = { id: string; version: string; title: string; body: string; status: 'draft' | 'published' | 'retired'; publishedAt: string | null; createdAt: string; updatedAt: string };
type Detail = Version & { preview: string; acceptances: number };

const STATUS: Record<Version['status'], [string, string]> = { draft: ['draft', 'Draft'], published: ['active', 'Live'], retired: ['inactive', 'Retired'] };

/**
 * Terms & Conditions customers accept when they book. Write a draft, check the preview (figures are filled in from
 * Settings), then publish: the published version is frozen, and every booking records which version was accepted.
 */
export default function Terms() {
  const { data, error, loading, reload } = useApi<{ items: Version[]; placeholders: string[] }>('/terms');
  const [openId, setOpenId] = useState<string | null>(null);
  const act = useAction();
  useEffect(() => { if (data && !openId) setOpenId((data.items.find((v) => v.status === 'draft') ?? data.items.find((v) => v.status === 'published') ?? data.items[0])?.id ?? null); }, [data, openId]);
  const newDraft = () => act.run(async () => { const d = await api<Version>('/terms', { method: 'POST', body: {} }); reload(); setOpenId(d.id); }, 'New draft started from the live version');
  const hasDraft = data?.items.some((v) => v.status === 'draft');
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(220px, 300px) 1fr', gap: 20, alignItems: 'start' }}>
      <Panel title="Versions" action={!hasDraft ? <button className="btn gold sm" disabled={act.busy} onClick={newDraft}><FiPlus /> New version</button> : undefined}>
        <ErrorBox error={error} retry={reload} /><ErrorBox error={act.error} />
        {loading && !data ? <Loading /> : null}
        {data && !data.items.length ? <Empty icon={FiFileText} title="No terms yet">Start the first version.</Empty> : null}
        <div className="stack" style={{ display: 'grid', gap: 8 }}>
          {data?.items.map((v) => (
            <button key={v.id} className={`btn${openId === v.id ? ' gold' : ''}`} style={{ justifyContent: 'space-between', width: '100%' }} onClick={() => setOpenId(v.id)}>
              <span>Version {v.version}</span><Badge status={STATUS[v.status][0]} label={STATUS[v.status][1]} />
            </button>
          ))}
        </div>
        {data?.placeholders.length ? (
          <div className="note small" style={{ marginTop: 16 }}>
            <div className="strong" style={{ marginBottom: 6 }}>Figures filled in automatically</div>
            {data.placeholders.map((p) => <div key={p}><code>{`{{${p}}}`}</code></div>)}
            <div className="muted" style={{ marginTop: 6 }}>They always match Settings and Additional charges, so you never need to edit the terms when a rate changes.</div>
          </div>
        ) : null}
      </Panel>
      {openId ? <VersionEditor key={openId} id={openId} onChanged={reload} onGone={() => { setOpenId(null); reload(); }} /> : null}
    </div>
  );
}

function VersionEditor({ id, onChanged, onGone }: { id: string; onChanged: () => void; onGone: () => void }) {
  const { data, error, reload } = useApi<Detail>(`/terms/${id}`);
  const [v, setV] = useState<{ version: string; title: string; body: string } | null>(null);
  const [confirm, setConfirm] = useState<'publish' | 'delete' | null>(null);
  const { run, busy, error: actError } = useAction();
  useEffect(() => { if (data) setV({ version: data.version, title: data.title, body: data.body }); }, [data]);
  if (!data || !v) return <Panel title="Terms"><ErrorBox error={error} retry={reload} /><Loading /></Panel>;
  const draft = data.status === 'draft';
  const dirty = draft && (v.version !== data.version || v.title !== data.title || v.body !== data.body);
  const save = () => run(async () => { await api(`/terms/${id}`, { method: 'PUT', body: v }); reload(); onChanged(); }, 'Draft saved');
  return (
    <>
      <Panel title={`${data.title} · version ${data.version}`} action={<Badge status={STATUS[data.status][0]} label={STATUS[data.status][1]} />}
        hint={draft ? 'Edit the draft, save it, check the preview, then publish. Customers accept the live version when they book.'
          : `${data.status === 'published' ? 'Live' : 'Was live'} from ${data.publishedAt ? fmtDateTime(data.publishedAt) : '—'}. Accepted with ${data.acceptances} booking${data.acceptances === 1 ? '' : 's'}. Published versions cannot be changed: start a new version instead.`}>
        <div className="form-grid">
          <TextField label="Version" value={v.version} onChange={(x) => setV({ ...v, version: x })} disabled={!draft} />
          <TextField label="Title" value={v.title} onChange={(x) => setV({ ...v, title: x })} disabled={!draft} />
        </div>
        <div className="field">
          <label>Terms (## heading, ### sub-heading, - list item, **bold**)</label>
          <textarea value={v.body} readOnly={!draft} onChange={(e) => setV({ ...v, body: e.target.value })} rows={22} style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 13, lineHeight: 1.5 }} />
        </div>
        <ErrorBox error={actError} />
        {draft ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn gold" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save draft'}</button>
            <button className="btn" disabled={busy || dirty} onClick={() => setConfirm('publish')} title={dirty ? 'Save the draft first' : undefined}>Publish this version</button>
            <button className="btn danger" disabled={busy} onClick={() => setConfirm('delete')}>Delete draft</button>
          </div>
        ) : null}
      </Panel>
      <Panel title="Preview" hint="As customers see it, with today's figures from Settings.">
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{data.preview}</pre>
      </Panel>
      {confirm === 'publish' ? <ConfirmDialog title={`Publish version ${data.version}?`} confirmLabel="Publish" onClose={() => setConfirm(null)}
        message="New bookings will need customers to accept this version. The current live version is retired and kept with the bookings that accepted it. Published terms cannot be edited."
        onConfirm={async () => { await api(`/terms/${id}/publish`, { method: 'POST', body: {} }); reload(); onChanged(); }} /> : null}
      {confirm === 'delete' ? <ConfirmDialog title="Delete this draft?" danger confirmLabel="Delete" onClose={() => setConfirm(null)} message="The draft is removed. Published versions are not affected."
        onConfirm={async () => { await api(`/terms/${id}`, { method: 'DELETE' }); onGone(); }} /> : null}
    </>
  );
}
