import { useState } from 'react';
import { FiArrowDown, FiArrowUp, FiCalendar, FiPlus } from 'react-icons/fi';
import { api, useApi } from '../../lib/api';
import ImageUpload from '../../components/ImageUpload';
import { CheckField, NumberField, SelectField, TextField, ToggleField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBox, Loading } from '../../components/feedback';
import { Badge, Drawer, Empty, Panel, Switch } from '../../components/ui';
import { DeleteDialog, RowActions } from '../../components/RowActions';

type EventRow = {
  id: string; slug: string; title: string; description: string; image_url: string | null; requirements: { notes?: string }; min_hours: number | null;
  published: boolean; pricing_basis: 'hourly' | 'distance' | 'transfer'; sort_order: number; archived_at: string | null; vehicle_ids: string[];
  tagline: string | null; icon: string | null; allow_return: boolean;
};
const BASIS_LABEL: Record<string, string> = { transfer: 'Journey (route hours + mileage)', hourly: 'By the hour', distance: 'Per mile' };
const ICONS = ['Plane', 'Route', 'Clock', 'Briefcase', 'Champagne', 'Gem', 'Presentation', 'MapPin'];
type Veh = { id: string; make: string; model: string };

export default function Events() {
  const { data, error, loading, reload } = useApi<{ items: EventRow[] }>('/event-types');
  const { data: fleet } = useApi<{ items: Veh[] }>('/vehicles?limit=200');
  const [editing, setEditing] = useState<EventRow | 'new' | null>(null);
  const [archiving, setArchiving] = useState<EventRow | null>(null);
  const [deleting, setDeleting] = useState<EventRow | null>(null);
  const { run, busy } = useAction();

  const active = data?.items.filter((e) => !e.archived_at) ?? [];
  const archived = data?.items.filter((e) => e.archived_at) ?? [];

  const move = (i: number, d: number) => {
    const ids = active.map((e) => e.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(async () => { await api('/event-types/order', { method: 'PUT', body: { ids } }); reload(); });
  };

  return (
    <>
      <Panel title="Services" hint="The chauffeur services customers can book on the website. Order here is the order customers see." action={<button className="btn gold" onClick={() => setEditing('new')}><FiPlus /> Add service</button>}>
        <ErrorBox error={error} retry={reload} />
        {loading && !data ? <Loading /> : null}
        {data && !active.length ? <Empty icon={FiCalendar} title="No services yet">Add airport transfers, hourly hire, weddings and anything else you offer.</Empty> : null}
        {active.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Service</th><th>Priced</th><th>Vehicles</th><th>Min hours</th><th>Visible to customers</th><th className="actions-cell">Order</th><th className="actions-cell" /></tr></thead>
            <tbody>
              {active.map((e, i) => (
                <tr key={e.id}>
                  <td><div className="row">
                    <div className="car-thumb" style={e.image_url ? { backgroundImage: `url(${e.image_url})`, backgroundSize: 'cover' } : undefined} />
                    <div><button className="link-btn" onClick={() => setEditing(e)}>{e.title}</button><div className="cell-sub">{e.tagline || e.description.slice(0, 70)}</div></div>
                  </div></td>
                  <td><Badge status={e.pricing_basis === 'hourly' ? 'mute' : 'in_progress'} label={BASIS_LABEL[e.pricing_basis] ?? e.pricing_basis} />{e.allow_return && e.pricing_basis !== 'hourly' ? <div className="cell-sub">Return trips</div> : null}</td>
                  <td>{e.vehicle_ids.length}</td>
                  <td>{e.min_hours ?? (e.pricing_basis === 'transfer' ? 'Settings' : '—')}</td>
                  <td><Switch text label={`${e.title} visible`} checked={e.published} onText="Visible" offText="Hidden" onChange={(v) => run(async () => { await api(`/event-types/${e.id}`, { method: 'PATCH', body: { published: v } }); reload(); })} /></td>
                  <td className="actions-cell">
                    <div className="row-actions">
                      <button className="icon-btn" aria-label={`Move ${e.title} up`} disabled={i === 0 || busy} onClick={() => move(i, -1)}><FiArrowUp size={15} /></button>
                      <button className="icon-btn" aria-label={`Move ${e.title} down`} disabled={i === active.length - 1 || busy} onClick={() => move(i, 1)}><FiArrowDown size={15} /></button>
                    </div>
                  </td>
                  <td className="actions-cell"><RowActions name={e.title} onEdit={() => setEditing(e)} onDelete={() => setDeleting(e)} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : null}
      </Panel>
      {archived.length ? (
        <Panel title="Archived" hint="Hidden from customers. Past bookings keep these labels.">
          <div className="list">{archived.map((e) => (
            <div className="list-item" key={e.id}><span className="cell-title" style={{ flex: 1 }}>{e.title}</span>
              <button className="btn sm" onClick={() => run(async () => { await api(`/event-types/${e.id}/archive`, { method: 'POST', body: { archived: false } }); reload(); }, 'Restored')}>Restore</button></div>
          ))}</div>
        </Panel>
      ) : null}
      {editing ? <EventForm ev={editing === 'new' ? null : editing} fleet={fleet?.items ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} onArchive={(e) => { setEditing(null); setArchiving(e); }} /> : null}
      {deleting ? <DeleteDialog what={`"${deleting.title}"`} path={`/event-types/${deleting.id}`} note="Its pricing rules and vehicle links are removed too. Refused if anyone has booked it; archive it instead so past bookings keep their label." onClose={() => setDeleting(null)} onDone={reload} /> : null}
      {archiving ? <ConfirmDialog title={`Archive "${archiving.title}"?`} confirmLabel="Archive" danger message="Customers will no longer see it. Existing bookings keep their link to it."
        onConfirm={async () => { await api(`/event-types/${archiving.id}/archive`, { method: 'POST', body: { archived: true } }); reload(); }} onClose={() => setArchiving(null)} /> : null}
    </>
  );
}

function EventForm({ ev, fleet, onClose, onSaved, onArchive }: { ev: EventRow | null; fleet: Veh[]; onClose: () => void; onSaved: () => void; onArchive: (e: EventRow) => void }) {
  const [title, setTitle] = useState(ev?.title ?? '');
  const [slug, setSlug] = useState(ev?.slug ?? '');
  const [description, setDescription] = useState(ev?.description ?? '');
  const [imageUrl, setImageUrl] = useState(ev?.image_url ?? '');
  const [minHours, setMinHours] = useState<number | null>(ev?.min_hours ?? null);
  const [notes, setNotes] = useState(ev?.requirements?.notes ?? '');
  const [published, setPublished] = useState(ev?.published ?? false);
  const [basis, setBasis] = useState<string>(ev?.pricing_basis ?? 'transfer');
  const [tagline, setTagline] = useState(ev?.tagline ?? '');
  const [icon, setIcon] = useState(ev?.icon ?? 'Route');
  const [allowReturn, setAllowReturn] = useState(ev?.allow_return ?? true);
  const [vehicleIds, setVehicleIds] = useState<string[]>(ev?.vehicle_ids ?? []);
  const [createdId, setCreatedId] = useState<string | null>(null); // so a retry after a partial failure updates instead of duplicating
  const { run, busy, error, fieldErrors } = useAction();

  const save = async () => {
    const body = {
      title: title.trim(), slug: slug.trim() || undefined, description, imageUrl: imageUrl || null, minHours, requirements: notes.trim() ? { notes: notes.trim() } : {}, published, pricingBasis: basis,
      tagline: tagline.trim() || null, icon, allowReturn: basis !== 'hourly' && allowReturn,
    };
    const saved = await run(async () => {
      const existing = ev?.id ?? createdId;
      const r = await api<{ id: string }>(existing ? `/event-types/${existing}` : '/event-types', { method: existing ? 'PATCH' : 'POST', body });
      setCreatedId(r.id);
      await api(`/event-types/${r.id}/vehicles`, { method: 'PUT', body: { vehicleIds } });
      return r;
    }, 'Service saved');
    if (saved) onSaved();
  };

  return (
    <Drawer title={ev ? 'Edit service' : 'New service'} onClose={onClose}
      footer={<>
        {ev ? <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => onArchive(ev)}>Archive</button> : null}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn gold" disabled={busy || !title.trim()} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </>}>
      <TextField label="Title *" value={title} onChange={setTitle} error={fieldErrors['title']} />
      <TextField label="URL name" value={slug} onChange={setSlug} hint="Lowercase letters, numbers and dashes. Generated from the title if blank. The website's service pages and links use it." error={fieldErrors['slug']} />
      <TextField label="Tagline" value={tagline} onChange={setTagline} placeholder="e.g. Airport Chauffeur Service in London" />
      <TextField label="Description" value={description} onChange={setDescription} multiline />
      <SelectField label="Icon" value={icon} onChange={setIcon} options={ICONS.map((x) => ({ value: x, label: x }))} hint="Shown on the website's booking form" />
      <ImageUpload kind="events" value={imageUrl} onChange={setImageUrl} />
      <SelectField label="How this service is priced" value={basis} onChange={setBasis} options={[
        { value: 'transfer', label: 'Journey: pick-up to drop-off (operational hours from the route, plus mileage)' },
        { value: 'hourly', label: 'By the hour: the customer chooses how many hours' },
        { value: 'distance', label: 'Per mile only (a per-mile price on each vehicle)' },
      ]} hint={basis === 'transfer' ? 'Hours are the driving time of the route, at least the minimum below; miles beyond the allowance in Settings are added.' : basis === 'distance' ? 'Set the per-mile price on each vehicle’s Pricing tab.' : 'Customers choose the hours; at least the minimum below.'} />
      <NumberField label="Minimum hours" value={minHours} onChange={setMinHours} min={1} hint={basis === 'transfer' ? 'Leave blank to use the journey minimum in Settings' : "Leave blank to use each vehicle's own minimum"} />
      {basis !== 'hourly' ? <ToggleField label="Customers can book a return journey" checked={allowReturn} onChange={setAllowReturn} onText="Yes" offText="No" /> : null}
      <TextField label="Booking requirements" value={notes} onChange={setNotes} multiline hint="Internal notes about this service" />
      <ToggleField label="Visible to customers" checked={published} onChange={setPublished} onText="Visible" offText="Hidden" />
      <div className="field">
        <label>Vehicles offered for this service</label>
        {!fleet.length ? <span className="muted small">No vehicles in the fleet yet.</span> : fleet.map((v) => (
          <CheckField key={v.id} label={`${v.make} ${v.model}`} checked={vehicleIds.includes(v.id)} onChange={(c) => setVehicleIds((p) => (c ? [...p, v.id] : p.filter((x) => x !== v.id)))} />
        ))}
      </div>
      <span className="muted small">A service-specific rate for a vehicle can be set on that vehicle’s Pricing tab.</span>

      <ErrorBox error={error} />
    </Drawer>
  );
}
