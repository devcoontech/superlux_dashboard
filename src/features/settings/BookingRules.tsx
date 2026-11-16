import { MoneyField, NumberField, SelectField, ToggleField } from '../../components/forms';
import { ErrorBox } from '../../components/feedback';
import { Panel } from '../../components/ui';
import { useSettingsForm, type S } from './settingsShared';

/** Settings > Booking rules: the pick-up window, journey pricing, holds, cancellation and buffers. */
export function BookingRules({ s, onSaved }: { s: S; onSaved: () => void }) {
  const f = useSettingsForm(s, onSaved);
  const n = (k: string) => f.v[k] as number;
  const keys = ['booking.openHour', 'booking.closeHour', 'booking.minLeadHours', 'booking.requireApproval', 'booking.holdMinutes', 'booking.cancellationFreeHours', 'booking.cancellationLateRefundPercent',
    'driver.bufferMinutes', 'booking.bufferMinutes', 'booking.maxAdvanceDays', 'booking.maxVehiclesPerOrder', 'booking.allowExtensions', 'booking.allowDailyBookings', 'booking.maxDays',
    'pricing.includedMiles', 'pricing.excessMilePence', 'pricing.transferMinHours', 'pricing.mileageAllowanceScope', 'pricing.showHourlyRates', 'booking.slotIntervalMinutes',
    'waiting.graceMinutes', 'waiting.blockMinutes', 'waiting.blockRateBp'];
  const bad = n('booking.closeHour') <= n('booking.openHour') || n('booking.closeHour') > 24 || n('booking.cancellationLateRefundPercent') > 100 || n('booking.maxAdvanceDays') < 1
    || n('booking.bufferMinutes') > 1440 || n('pricing.transferMinHours') < 1 || n('waiting.blockMinutes') < 5;
  const pct = n('waiting.blockRateBp') / 100;
  const example = (rate: number) => `£${((rate * pct) / 100).toFixed(2)}`;
  return (
    <>
      <Panel title="Journey pricing" hint="Every journey is priced as operational hours × the vehicle's hourly rate, plus each mile beyond the allowance. The website, quotes and staff bookings all use these figures.">
        <div className="form-grid">
          <NumberField label="Miles included" value={n('pricing.includedMiles')} onChange={(v) => f.set('pricing.includedMiles', v ?? 0)} min={0} />
          <SelectField label="Allowance applies" value={f.v['pricing.mileageAllowanceScope'] as string} onChange={(v) => f.set('pricing.mileageAllowanceScope', v)}
            options={[{ value: 'booking', label: 'Per booking (a return trip shares it)' }, { value: 'journey', label: 'Per journey (each leg has its own)' }]} />
          <MoneyField label="Price per extra mile" value={n('pricing.excessMilePence')} onChange={(v) => f.set('pricing.excessMilePence', v ?? 0)} hint="Charged for each started mile beyond the allowance" />
          <NumberField label="Minimum hours for a journey" value={n('pricing.transferMinHours')} onChange={(v) => f.set('pricing.transferMinHours', v ?? 1)} min={1} max={24}
            hint="Transfers are charged the driving time of the route, and at least this. A service's own minimum takes priority" error={n('pricing.transferMinHours') < 1 ? 'At least 1 hour' : undefined} />
          <div className="full"><ToggleField label="Show hourly rates on the website" checked={f.v['pricing.showHourlyRates'] as boolean} onChange={(c) => f.set('pricing.showHourlyRates', c)} onText="Shown" offText="Hidden"
            hint="Hidden: customers see the price for their journey but not the vehicles' hourly rates. Rates are still used for prices and waiting time." /></div>
        </div>
      </Panel>
      <Panel title="Waiting time policy" hint="Shown to customers before they book and in the Terms & Conditions. Staff add waiting time after a journey from the booking page (Add charge).">
        <div className="form-grid">
          <NumberField label="Complimentary waiting (minutes)" value={n('waiting.graceMinutes')} onChange={(v) => f.set('waiting.graceMinutes', v ?? 0)} min={0} max={240} />
          <NumberField label="Then charged per (minutes)" value={n('waiting.blockMinutes')} onChange={(v) => f.set('waiting.blockMinutes', v ?? 30)} min={5} max={240} hint="Each period, or part of one" error={n('waiting.blockMinutes') < 5 ? 'At least 5 minutes' : undefined} />
          <NumberField label="Each period costs (% of hourly rate)" value={pct} onChange={(v) => f.set('waiting.blockRateBp', Math.round((v ?? 0) * 100))} min={0} max={1000}
            hint={`For a £100/hr vehicle, each period is ${example(100)}`} />
        </div>
      </Panel>
      <Panel title="Booking rules" hint={`Times are in ${s['booking.timezone']}.`}>
        <div className="form-grid">
          <NumberField label="First pick-up time (hour)" value={n('booking.openHour')} onChange={(v) => f.set('booking.openHour', v ?? 0)} min={0} max={23} hint="Earliest pick-up customers can book online" />
          <NumberField label="Pick-ups before (hour)" value={n('booking.closeHour')} onChange={(v) => f.set('booking.closeHour', v ?? 0)} min={1} max={24}
            hint="Journeys may finish later. Customers call you for other times" error={n('booking.closeHour') <= n('booking.openHour') ? 'Must be after the first pick-up time' : undefined} />
          <SelectField label="Pick-up times offered every" value={String(n('booking.slotIntervalMinutes'))} onChange={(v) => f.set('booking.slotIntervalMinutes', Number(v))}
            options={[{ value: '15', label: '15 minutes' }, { value: '30', label: '30 minutes' }, { value: '60', label: 'Hour' }]} hint="Each time is checked against the vehicle's diary" />
          <NumberField label="Minimum notice (hours)" value={n('booking.minLeadHours')} onChange={(v) => f.set('booking.minLeadHours', v ?? 0)} min={0} />
          <NumberField label="Payment link valid for (minutes)" value={n('booking.holdMinutes')} onChange={(v) => f.set('booking.holdMinutes', v ?? 0)} min={1} hint="How long an approved, unpaid booking holds the vehicle (1440 = 24 hours)" />
          <NumberField label="Unapproved requests released after (hours)" value={n('booking.pendingHoldHours')} onChange={(v) => f.set('booking.pendingHoldHours', v ?? 0)} min={0} max={720} hint="0 keeps them until you act" />
          <NumberField label="Free cancellation up to (hours before)" value={n('booking.cancellationFreeHours')} onChange={(v) => f.set('booking.cancellationFreeHours', v ?? 0)} min={0} />
          <NumberField label="Refund after that (%)" value={n('booking.cancellationLateRefundPercent')} onChange={(v) => f.set('booking.cancellationLateRefundPercent', v ?? 0)} min={0} max={100} />
          <NumberField label="Chauffeur travel buffer (minutes)" value={n('driver.bufferMinutes')} onChange={(v) => f.set('driver.bufferMinutes', v ?? 0)} min={0} hint="Kept free either side of a chauffeur's job" />
          <NumberField label="Vehicle turnaround (minutes)" value={n('booking.bufferMinutes')} onChange={(v) => f.set('booking.bufferMinutes', v ?? 0)} min={0} max={1440} hint="Kept free before and after every journey. Not charged. A return leg may follow straight on" />
          <NumberField label="Book up to (days ahead)" value={n('booking.maxAdvanceDays')} onChange={(v) => f.set('booking.maxAdvanceDays', v ?? 1)} min={1} max={1095} hint="Bookings always start today or later" />
          <NumberField label="Vehicles per booking (max)" value={n('booking.maxVehiclesPerOrder')} onChange={(v) => f.set('booking.maxVehiclesPerOrder', v ?? 1)} min={1} max={20} hint="A return journey counts as two" />
          <NumberField label="Longest day hire (days)" value={n('booking.maxDays')} onChange={(v) => f.set('booking.maxDays', v ?? 1)} min={1} max={60} hint="1 day = 24 hours from the pick-up time" />
          <div className="full"><ToggleField label="Require approval for new bookings" checked={f.v['booking.requireApproval'] as boolean} onChange={(c) => f.set('booking.requireApproval', c)} onText="On" offText="Off" hint="On: every website booking arrives as a request; when you approve it, the customer is emailed a secure payment link. Off: instantly bookable vehicles go straight to payment, and vehicles subject to availability or on request still come to you first. Nothing is confirmed until paid." /></div>
          <div className="full"><ToggleField label="Day hire (whole days)" checked={f.v['booking.allowDailyBookings'] as boolean} onChange={(c) => f.set('booking.allowDailyBookings', c)} onText="On" offText="Off" hint="Lets staff and the customer app book whole days. Set a daily price under Fleet > the vehicle > Pricing > Per day." /></div>
          <div className="full"><ToggleField label="Customers can extend bookings themselves (customer app)" checked={f.v['booking.allowExtensions'] as boolean} onChange={(c) => f.set('booking.allowExtensions', c)} onText="On" offText="Off" hint="Staff can always extend a booking from its page when the vehicle is free." /></div>
        </div>
      </Panel>
      <ErrorBox error={f.error} />
      <div><button className="btn gold" disabled={f.busy || !f.changed.length || bad} onClick={() => f.save([...keys, 'booking.pendingHoldHours'])}>{f.busy ? 'Saving…' : 'Save booking rules'}</button></div>
    </>
  );
}
