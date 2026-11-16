import { useRef } from 'react';
import { FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { api } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { TextField } from '../../components/forms';
import { ErrorBox } from '../../components/feedback';
import { Panel } from '../../components/ui';
import { useSettingsForm, type S } from './settingsShared';

const KEYS = ['branding.wordmarkMain', 'branding.wordmarkAccent', 'branding.tagline'];

/** The logo shown on the website, this dashboard and customer emails: the wordmark, or an uploaded image for dark backgrounds. */
export function BrandingSettings({ s, onSaved }: { s: S; onSaved: () => void }) {
  const f = useSettingsForm(s, onSaved);
  const file = useRef<HTMLInputElement>(null);
  const up = useAction();
  const logo = String(f.v['branding.logoUrl'] ?? '');
  const str = (k: string) => String(f.v[k] ?? '');
  const upload = (picked: File | undefined) => {
    if (!picked) return;
    up.run(async () => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(picked.type)) throw new Error('The logo must be a JPEG, PNG or WebP image');
      if (picked.size > 8 * 1024 * 1024) throw new Error('The logo must be 8 MB or smaller');
      const form = new FormData();
      form.append('file', picked);
      await api('/settings/logo?variant=dark', { form });
      onSaved();
    }, 'Logo uploaded');
  };
  const bad = KEYS.slice(0, 2).some((k) => !str(k).trim());
  return (
    <Panel title="Logo and branding" hint="Shown on the website, this dashboard and customer emails, on dark backgrounds. Receipts use the business logo above.">
      <div style={{ background: '#0b0b0c', borderRadius: 12, padding: '18px 22px', display: 'inline-block', marginBottom: 16 }}>
        {logo ? <img src={logo} alt="Logo" style={{ height: 52, display: 'block' }} /> : (
          <div style={{ color: '#fff', lineHeight: 1 }}>
            <div style={{ fontFamily: "Didot, 'Bodoni 72', 'Playfair Display', Georgia, serif", fontSize: 38, fontWeight: 800 }}>{str('branding.wordmarkMain')}<i style={{ fontWeight: 500 }}>{str('branding.wordmarkAccent')}</i></div>
            <div style={{ fontSize: 11, letterSpacing: '0.42em', color: '#c4c4c4', marginTop: 8, fontWeight: 600 }}>{str('branding.tagline')}</div>
          </div>
        )}
      </div>
      <div className="form-grid">
        <TextField label="Logo word" value={str('branding.wordmarkMain')} onChange={(v) => f.set('branding.wordmarkMain', v)} hint="Bold, e.g. SUPER" />
        <TextField label="Logo word in italics" value={str('branding.wordmarkAccent')} onChange={(v) => f.set('branding.wordmarkAccent', v)} hint="e.g. LUXE" />
        <div className="full"><TextField label="Line beneath" value={str('branding.tagline')} onChange={(v) => f.set('branding.tagline', v)} hint="e.g. CHAUFFEURS LONDON" /></div>
      </div>
      <div className="row" style={{ marginTop: 14, flexWrap: 'wrap', gap: 8 }}>
        <button className="btn gold" disabled={f.busy || bad || !KEYS.some((k) => f.changed.includes(k))} onClick={() => f.save(KEYS)}>{f.busy ? 'Saving…' : 'Save logo words'}</button>
        <button className="btn" disabled={up.busy} onClick={() => file.current?.click()}><FiUploadCloud /> {up.busy ? 'Uploading…' : logo ? 'Replace logo image' : 'Upload a logo image instead'}</button>
        {logo ? <button className="btn danger" disabled={up.busy} onClick={() => up.run(async () => { await api('/settings/logo?variant=dark', { method: 'DELETE' }); onSaved(); }, 'Logo image removed')}><FiTrash2 /> Use the wordmark</button> : null}
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <ErrorBox error={f.error} /><ErrorBox error={up.error} />
    </Panel>
  );
}
