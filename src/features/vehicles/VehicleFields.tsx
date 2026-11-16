import { MoneyField, NumberField, SelectField, TextField } from '../../components/forms';
import { AVAILABILITY_MODES, BODY_TYPES, CATEGORIES, FUEL_TYPES, TRANSMISSIONS, type VehicleForm } from './vehicleForm';

/** The vehicle's fields in groups. The add-vehicle wizard shows one group per step; the vehicle page shows them all. */

type P = { f: VehicleForm; set: <K extends keyof VehicleForm>(k: K, v: VehicleForm[K]) => void; err: Record<string, string | undefined> };

const opts = (list: string[], blank?: string) => [...(blank ? [{ value: '', label: blank }] : []), ...list.map((x) => ({ value: x, label: x }))];

export function BasicsFields({ f, set, err }: P) {
  return (
    <div className="form-grid">
      <TextField label="Brand *" value={f.make} onChange={(v) => set('make', v)} error={err.make} placeholder="e.g. Mercedes" />
      <TextField label="Model *" value={f.model} onChange={(v) => set('model', v)} error={err.model} placeholder="e.g. S-Class" />
      <div className="full vw-name"><span className="muted small">Listed as</span><b>{[f.make.trim(), f.model.trim()].filter(Boolean).join(' ') || 'Brand and model'}</b></div>
      <TextField label="Category *" value={f.category} onChange={(v) => set('category', v)} error={err.category} list="vehicle-categories" hint="Shown on the website, e.g. Luxury Saloon" />
      <datalist id="vehicle-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
      <SelectField label="Vehicle type *" value={f.bodyType} onChange={(v) => set('bodyType', v)} options={BODY_TYPES} hint="The website's fleet filter and the home page's classes" />
      <NumberField label="Year of manufacture *" value={f.year} onChange={(v) => set('year', v)} error={err.year} />
      <TextField label="Registration number" value={f.fleetRef} onChange={(v) => set('fleetRef', v.toUpperCase())} error={err.fleetRef} placeholder="e.g. AB12 CDE" hint="Internal only, never shown to customers" />
      <TextField label="Colour" value={f.colour} onChange={(v) => set('colour', v)} placeholder="e.g. Obsidian Black" />
      <TextField label="Website address" value={f.slug} onChange={(v) => set('slug', v.toLowerCase())} error={err.slug} placeholder="Made from the brand and model" hint={`The vehicle's page: /fleet/${f.slug.trim() || 'brand-model'}`} />
      <NumberField label="Order in the fleet" value={f.sortOrder} onChange={(v) => set('sortOrder', v)} min={0} hint="Lower numbers are listed first on the website" />
      <div className="full"><TextField label="Description" value={f.description} onChange={(v) => set('description', v)} multiline error={err.description} hint="Shown on the vehicle's page on the website" /></div>
    </div>
  );
}

export function SpecsFields({ f, set, err }: P) {
  return (
    <div className="form-grid">
      <NumberField label="Passengers *" value={f.seats} onChange={(v) => set('seats', v)} min={1} max={20} error={err.seats} hint="Seats for passengers, not counting the chauffeur" />
      <NumberField label="Large bags *" value={f.luggageLarge} onChange={(v) => set('luggageLarge', v)} min={0} max={60} error={err.luggageLarge} />
      <NumberField label="Small bags *" value={f.luggageSmall} onChange={(v) => set('luggageSmall', v)} min={0} max={60} error={err.luggageSmall} />
      <SelectField label="Transmission" value={f.transmission} onChange={(v) => set('transmission', v)} options={opts(TRANSMISSIONS, 'Not set')} />
      <SelectField label="Fuel type" value={f.fuelType} onChange={(v) => set('fuelType', v)} options={opts(FUEL_TYPES, 'Not set')} />
      <NumberField label="Doors" value={f.doors} onChange={(v) => set('doors', v)} min={1} max={8} error={err.doors} />
      <TextField label="Engine" value={f.engine} onChange={(v) => set('engine', v)} placeholder="e.g. 3.0L hybrid" />
      <NumberField label="Mileage" value={f.mileage} onChange={(v) => set('mileage', v)} min={0} error={err.mileage} hint="Current odometer reading in miles. Internal only" />
      <div className="full"><TextField label="Features" value={f.amenities} onChange={(v) => set('amenities', v)} hint="Separate with commas, e.g. Wi-Fi, Rear entertainment, Privacy glass" /></div>
    </div>
  );
}

export function PricingFields({ f, set, err }: P) {
  return (
    <div className="form-grid">
      <MoneyField label="Hourly rate *" value={f.pricePerHourPence} onChange={(v) => set('pricePerHourPence', v)} error={err.pricePerHourPence}
        hint="Charged for each operational hour of a journey. Mileage beyond the allowance is added (Settings > Booking rules)" />
      <MoneyField label="Deposit due at booking" value={f.depositPence} onChange={(v) => set('depositPence', v)} hint="Only used when payments are set to Deposit. 0 uses the % in Settings" />
      <NumberField label="Shortest booking (hours) *" value={f.minHours} onChange={(v) => set('minHours', v)} min={1} error={err.minHours} />
      <NumberField label="Longest booking (hours) *" value={f.maxHours} onChange={(v) => set('maxHours', v)} min={1} error={err.maxHours} />
      <NumberField label="Turnaround between journeys (minutes)" value={f.bufferMinutes} onChange={(v) => set('bufferMinutes', v)} min={0} max={1440} hint="Kept free before and after each journey. The longer of this and the business setting applies" />
    </div>
  );
}

export function AvailabilityFields({ f, set, err }: P) {
  const mode = AVAILABILITY_MODES.find((m) => m.value === f.availabilityMode);
  return (
    <div className="form-grid">
      <SelectField label="Vehicle status" value={f.operationalStatus} onChange={(v) => set('operationalStatus', v)}
        hint={f.operationalStatus === 'active' ? 'Can be booked' : 'Cannot be booked until it is Active again'}
        options={[{ value: 'active', label: 'Active' }, { value: 'maintenance', label: 'Under maintenance' }, { value: 'inactive', label: 'Inactive' }]} />
      <SelectField label="Online availability" value={f.availabilityMode} onChange={(v) => set('availabilityMode', v)} hint={mode?.hint}
        options={AVAILABILITY_MODES.map(({ value, label }) => ({ value, label }))} />
      <TextField label="City *" value={f.city} onChange={(v) => set('city', v)} error={err.city} placeholder="e.g. London" />
      <TextField label="Area" value={f.area} onChange={(v) => set('area', v)} placeholder="e.g. Mayfair" />
    </div>
  );
}
