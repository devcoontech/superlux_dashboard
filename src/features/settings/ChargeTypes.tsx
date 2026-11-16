import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { api, useApi } from '../../lib/api';
import { MoneyField, NumberField, SelectField, TextField, ToggleField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox, Loading } from '../../components/feedback';
import { Badge, Drawer, Panel } from '../../components/ui';
import { gbp } from '../../lib/format';

export type ChargeType = {
  id: string; name: string; category: string; calc: 'waiting' | 'per_mile' | 'fixed'; defaultAmountPence: number | null;
  description: string | null; showInTerms: boolean; active: boolean; sortOrder: number;
};
export type ChargePolicy = { graceMinutes: number; blockMinutes: number; blockRateBp: number; excessMilePence: number; includedMiles: number };

export const CATEGORIES = [
  { value: 'waiting_time', label: 'Waiting time' }, { value: 'mileage', label: 'Mileage' }, { value: 'cleaning', label: 'Cleaning' },
  { value: 'damage', label: 'Vehicle damage' }, { value: 'journey_change', label: 'Extra stop or journey change' }, { value: 'other', label: 'Other' },
];
const CALCS = [
  { value: 'fixed', label: 'An amount (set below, or entered each time)' },
  { value: 'waiting', label: 'Waiting time policy (minutes waited × vehicle rate)' },
  { value: 'per_mile', label: 'Additional mileage rate (miles × price per mile)' },
];

export const amountLabel = (t: ChargeType, p?: ChargePolicy) =>
  t.calc === 'waiting' ? `${p ? `${p.blockRateBp / 100}% of hourly rate per ${p.blockMinutes} min after ${p.graceMinutes} free` : 'Waiting time policy'}`
  : t.calc === 'per_mile' ? `${p ? gbp(p.excessMilePence) : ''} per mile`
  : t.defaultAmountPence != null ? gbp(t.defaultAmountPence) : 'Entered each time';

/** Settings > Additional charges: the charges staff can add after a journey, and the fee list in the Terms & Conditions. */
export function ChargeTypes() {
  const { data, error, loading, reload } = useApi<{ items: ChargeType[]; policy: ChargePolicy }>('/charge-types');
  const [editing, setEditing] = useState<ChargeType | 'new' | null>(null);
  return (
    <Panel title="Additional charges" hint="Charges you can add to a booking after the journey (Bookings > a booking > Add charge). Those marked for the Terms & Conditions are listed there with their amounts, so customers know them before booking."
      action={<button className="btn gold sm" onClick={() => setEditing('new')}><FiPlus /> New charge type</button>}>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="table-wrap"><table>
          <thead><tr><th>Charge</th><th>Type</th><th>Amount</th><th>In T&amp;Cs</th><th>Status</th><th className="actions-cell" /></tr></thead>
          <tbody>{data.items.map((t) => (
            <tr key={t.id}>
              <td><div className="cell-title">{t.name}</div>{t.description ? <div className="cell-sub">{t.description}</div> : null}</td>
              <td>{CATEGORIES.find((c) => c.value === t.category)?.label}</td>
              <td>{amountLabel(t, data.policy)}</td>
              <td>{t.showInTerms ? 'Yes' : 'No'}</td>
              <td><Badge status={t.active ? 'active' : 'inactive'} label={t.active ? 'In use' : 'Off'} /></td>
              <td className="actions-cell"><button className="btn sm" onClick={() => setEditing(t)}>Edit</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : null}
      {editing ? <ChargeTypeForm t={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
    </Panel>
  );
}

function ChargeTypeForm({ t, onClose, onSaved }: { t: ChargeType | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({
    name: t?.name ?? '', category: t?.category ?? 'cleaning', calc: t?.calc ?? 'fixed', defaultAmountPence: t?.defaultAmountPence ?? null as number | null,
    description: t?.description ?? '', showInTerms: t?.showInTerms ?? true, active: t?.active ?? true, sortOrder: t?.sortOrder ?? 100,
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const { run, busy, error } = useAction();
  const save = async () => {
    const body = { ...v, name: v.name.trim(), description: v.description.trim() || null, defaultAmountPence: v.calc === 'fixed' ? v.defaultAmountPence : null };
    if (await run(() => api(t ? `/charge-types/${t.id}` : '/charge-types', { method: t ? 'PUT' : 'POST', body }), 'Charge type saved')) onSaved();
  };
  return (
    <Drawer title={t ? 'Edit charge type' : 'New charge type'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn gold" disabled={busy || v.name.trim().length < 2} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <TextField label="Name *" value={v.name} onChange={(x) => set('name', x)} placeholder="e.g. Cleaning: vomit or bodily fluids" />
      <SelectField label="Kind" value={v.category} onChange={(x) => set('category', x)} options={CATEGORIES} />
      <SelectField label="How the amount is worked out" value={v.calc} onChange={(x) => set('calc', x as typeof v.calc)} options={CALCS} />
      {v.calc === 'fixed' ? <MoneyField label="Set amount" value={v.defaultAmountPence} onChange={(x) => set('defaultAmountPence', x)} hint="Leave empty to enter the amount each time (e.g. damage, which depends on the repair)" /> : null}
      <TextField label="Description for customers" value={v.description} onChange={(x) => set('description', x)} multiline hint="Shown in the Terms & Conditions fee list" />
      <ToggleField label="List in the Terms & Conditions" checked={v.showInTerms} onChange={(x) => set('showInTerms', x)} onText="Listed" offText="Not listed" />
      <ToggleField label="Can be used" checked={v.active} onChange={(x) => set('active', x)} />
      <NumberField label="Order" value={v.sortOrder} onChange={(x) => set('sortOrder', x ?? 0)} min={0} max={10000} />
      <ErrorBox error={error} />
    </Drawer>
  );
}
