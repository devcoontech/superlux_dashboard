import { useState } from 'react';
import { FiPlus, FiNavigation } from 'react-icons/fi';
import { DeleteDialog } from '../../components/RowActions';
import { api, useApi } from '../../lib/api';
import { NumberField, SelectField, TextField, ToggleField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox, Loading } from '../../components/feedback';
import { Badge, Drawer, Empty, Panel } from '../../components/ui';

export type Airport = {
  id: string; slug: string; name: string; code: string; kind: 'commercial' | 'private'; address: string; lat: number; lng: number;
  location: string | null; terminals: string | null; distance: string | null; blurb: string | null; about: string | null; tip: string | null;
  imageUrl: string | null; active: boolean; sortOrder: number;
};

/**
 * Airports customers can choose as a pick-up or drop-off, and the website's airport pages. Each has an exact point
 * on the map, so journeys to and from it are measured from the right place.
 */
export default function Airports() {
  const { data, error, loading, reload } = useApi<{ items: Airport[] }>('/airports');
  const [editing, setEditing] = useState<Airport | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Airport | null>(null);
  return (
    <Panel title="Airports" hint="Shown first when customers type a pick-up or drop-off, and as pages on the website. Switch one off to hide it without deleting it."
      action={<button className="btn gold sm" onClick={() => setEditing('new')}><FiPlus /> Add airport</button>}>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && !data.items.length ? <Empty icon={FiNavigation} title="No airports yet">Add the airports you cover.</Empty> : null}
      {data?.items.length ? (
        <div className="table-wrap"><table>
          <thead><tr><th>Airport</th><th>Code</th><th>Type</th><th>Website page</th><th>Status</th><th className="actions-cell" /></tr></thead>
          <tbody>{data.items.map((a) => (
            <tr key={a.id}>
              <td><div className="cell-title">{a.name}</div><div className="cell-sub">{a.address}</div></td>
              <td>{a.code}</td>
              <td>{a.kind === 'private' ? 'Private aviation' : 'Commercial'}</td>
              <td className="muted small">/airports/{a.slug}</td>
              <td><Badge status={a.active ? 'active' : 'inactive'} label={a.active ? 'Shown' : 'Hidden'} /></td>
              <td className="actions-cell"><div className="row" style={{ gap: 6 }}><button className="btn sm" onClick={() => setEditing(a)}>Edit</button><button className="btn sm danger" onClick={() => setDeleting(a)}>Delete</button></div></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : null}
      {editing ? <AirportForm a={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
      {deleting ? <DeleteDialog what={`${deleting.name} Airport`} path={`/airports/${deleting.id}`} note="Bookings already made keep their addresses. To hide it for now, switch it off instead." onClose={() => setDeleting(null)} onDone={reload} /> : null}
    </Panel>
  );
}

function AirportForm({ a, onClose, onSaved }: { a: Airport | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({
    slug: a?.slug ?? '', name: a?.name ?? '', code: a?.code ?? '', kind: a?.kind ?? 'commercial', address: a?.address ?? '', lat: a?.lat ?? null as number | null, lng: a?.lng ?? null as number | null,
    location: a?.location ?? '', terminals: a?.terminals ?? '', distance: a?.distance ?? '', blurb: a?.blurb ?? '', about: a?.about ?? '', tip: a?.tip ?? '',
    imageUrl: a?.imageUrl ?? '', active: a?.active ?? true, sortOrder: a?.sortOrder ?? 100,
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const { run, busy, error, fieldErrors } = useAction();
  const slugFrom = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ok = v.name.trim() && v.code.trim() && v.address.trim() && v.slug && v.lat != null && v.lng != null;
  const save = async () => {
    const nul = (s: string) => s.trim() || null;
    const body = { ...v, slug: v.slug.trim(), name: v.name.trim(), code: v.code.trim(), address: v.address.trim(), location: nul(v.location), terminals: nul(v.terminals), distance: nul(v.distance),
      blurb: nul(v.blurb), about: nul(v.about), tip: nul(v.tip), imageUrl: nul(v.imageUrl) };
    if (await run(() => api(a ? `/airports/${a.id}` : '/airports', { method: a ? 'PUT' : 'POST', body }), 'Airport saved')) onSaved();
  };
  return (
    <Drawer title={a ? `Edit ${a.name}` : 'Add an airport'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn gold" disabled={busy || !ok} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <div className="form-grid">
        <TextField label="Name *" value={v.name} onChange={(x) => { set('name', x); if (!a) set('slug', slugFrom(x)); }} placeholder="e.g. Farnborough" error={fieldErrors['name']} />
        <TextField label="Airport code *" value={v.code} onChange={(x) => set('code', x.toUpperCase())} placeholder="e.g. FAB" error={fieldErrors['code']} />
        <SelectField label="Type" value={v.kind} onChange={(x) => set('kind', x as typeof v.kind)} options={[{ value: 'commercial', label: 'Commercial airport' }, { value: 'private', label: 'Private aviation' }]} />
        <TextField label="Web address *" value={v.slug} onChange={(x) => set('slug', x)} hint={`superluxe.uk/airports/${v.slug || '…'}`} error={fieldErrors['slug']} />
      </div>
      <TextField label="Address used for bookings *" value={v.address} onChange={(x) => set('address', x)} placeholder="e.g. Farnborough Airport (FAB), Farnborough GU14" error={fieldErrors['address']} />
      <div className="form-grid">
        <NumberField label="Latitude *" value={v.lat} onChange={(x) => set('lat', x)} min={-90} max={90} hint="From Google Maps: right-click the terminal" />
        <NumberField label="Longitude *" value={v.lng} onChange={(x) => set('lng', x)} min={-180} max={180} />
        <TextField label="Area" value={v.location} onChange={(x) => set('location', x)} placeholder="e.g. Hampshire" />
        <TextField label="Distance from central London" value={v.distance} onChange={(x) => set('distance', x)} placeholder="e.g. About 35 miles" />
      </div>
      <TextField label="Terminals" value={v.terminals} onChange={(x) => set('terminals', x)} />
      <TextField label="Short description (cards)" value={v.blurb} onChange={(x) => set('blurb', x)} multiline />
      <TextField label="About the airport (page)" value={v.about} onChange={(x) => set('about', x)} multiline />
      <TextField label="Travel tip (page)" value={v.tip} onChange={(x) => set('tip', x)} multiline />
      <TextField label="Photo address" value={v.imageUrl} onChange={(x) => set('imageUrl', x)} placeholder="https://… or /assets/images/airports/…" hint="Optional. Without one, a standard photo is used." error={fieldErrors['imageUrl']} />
      <div className="form-grid">
        <ToggleField label="Shown to customers" checked={v.active} onChange={(x) => set('active', x)} />
        <NumberField label="Order" value={v.sortOrder} onChange={(x) => set('sortOrder', x ?? 0)} min={0} max={10000} />
      </div>
      <ErrorBox error={error} />
    </Drawer>
  );
}
