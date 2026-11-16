import { useEffect, useState } from 'react';
import { api, useApi } from '../../../lib/api';
import { MoneyField, NumberField, SelectField, TextField } from '../../../components/forms';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { gbp } from '../../../lib/format';
import type { ChargePolicy, ChargeType } from '../../settings/ChargeTypes';
import type { Detail } from '../bookingDetail.types';

/**
 * An additional charge after (or during) a journey: waiting time and extra mileage are worked out from the policy in
 * Settings, cleaning and damage use the set amount or one staff enter. The customer is emailed with the reason and can
 * pay online from Manage Booking.
 */
export function ExtraChargeDialog({ b, onClose, onDone }: { b: Detail; onClose: () => void; onDone: () => void }) {
  const { data } = useApi<{ items: ChargeType[]; policy: ChargePolicy }>('/charge-types');
  const types = (data?.items ?? []).filter((t) => t.active);
  const [typeId, setTypeId] = useState('');
  const [quantity, setQuantity] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [details, setDetails] = useState('');
  const [preview, setPreview] = useState<{ amountPence: number; explanation: string | null } | null>(null);
  const t = types.find((x) => x.id === typeId);
  useEffect(() => { if (!typeId && types[0]) setTypeId(types[0].id); }, [types, typeId]);
  useEffect(() => { setAmount(t?.calc === 'fixed' ? t.defaultAmountPence : null); setQuantity(null); setPreview(null); }, [typeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The amount, worked out by the server from the policy, as staff type the minutes or miles.
  useEffect(() => {
    if (!t || t.calc === 'fixed' || quantity == null) { setPreview(null); return; }
    let live = true;
    const h = setTimeout(() => {
      api<{ amountPence: number; explanation: string | null }>(`/bookings/${b.id}/extra-charges/preview`, { body: { chargeTypeId: t.id, quantity } })
        .then((r) => { if (live) setPreview(r); }).catch(() => { if (live) setPreview(null); });
    }, 250);
    return () => { live = false; clearTimeout(h); };
  }, [t, quantity, b.id]);

  const total = t?.calc === 'fixed' ? amount ?? 0 : preview?.amountPence ?? 0;
  return (
    <ConfirmDialog title="Add an additional charge" confirmLabel="Add to booking" onClose={onClose}
      message="Added to the booking total straight away. The customer is emailed the reason and a link to pay, and a charge note is issued."
      extra={<>
        <SelectField label="Charge" value={typeId} onChange={setTypeId} options={types.map((x) => ({ value: x.id, label: x.name }))} />
        {t?.calc === 'waiting' ? <NumberField label="Minutes waited (from the scheduled pick-up time)" value={quantity} onChange={setQuantity} min={0} max={1440}
          hint={data ? `${data.policy.graceMinutes} minutes free, then ${data.policy.blockRateBp / 100}% of the vehicle's hourly rate per ${data.policy.blockMinutes} minutes or part` : undefined} /> : null}
        {t?.calc === 'per_mile' ? <NumberField label="Additional miles" value={quantity} onChange={setQuantity} min={0} max={5000}
          hint={data ? `${gbp(data.policy.excessMilePence)} per mile, e.g. for extra stops or a changed destination` : undefined} /> : null}
        {t?.calc === 'fixed' ? <MoneyField label={t.defaultAmountPence != null ? 'Amount (set amount, you can change it)' : 'Amount *'} value={amount} onChange={setAmount} /> : null}
        {preview?.explanation ? <div className="note small">{preview.explanation}</div> : null}
        <TextField label="Description (shown to the customer)" value={description} onChange={setDescription} placeholder={t?.name} />
        <TextField label="Supporting information (shown to the customer)" value={details} onChange={setDetails} multiline placeholder="What happened, when, and any evidence (e.g. photos taken by the chauffeur)" />
        <div className="muted small">Charge {gbp(total)} · new booking total {gbp(b.finance.finalTotalPence + total)}</div>
      </>}
      onConfirm={async () => {
        if (!t) throw new Error('Choose a charge.');
        if (t.calc !== 'fixed' && quantity == null) throw new Error(t.calc === 'waiting' ? 'Enter the minutes waited.' : 'Enter the additional miles.');
        if (t.calc === 'fixed' && !amount) throw new Error('Enter the amount.');
        await api(`/bookings/${b.id}/extra-charges`, { body: { chargeTypeId: t.id, quantity, amountPence: t.calc === 'fixed' ? amount : null, description: description.trim() || null, details: details.trim() || null } });
        onDone();
      }} />
  );
}
