import { useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { staffApi as api, DEFAULT_SETTINGS } from '../../lib/db';
import { Alert, Field, PageHeader, Spinner } from '../../components/ui';

export default function Settings() {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.getSettings().then(setF); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    await api.updateSettings({
      campusName: f.campusName.trim(), gateName: f.gateName.trim(),
      defaultValidityMonths: Number(f.defaultValidityMonths), expiryReminderDays: Number(f.expiryReminderDays),
      defaultVisitorHours: Number(f.defaultVisitorHours), maxVisitorHours: Number(f.maxVisitorHours),
      requireLicenseCheck: !!f.requireLicenseCheck, maxVehicleSlots: Number(f.maxVehicleSlots),
    });
    setBusy(false);
    setMsg('System settings updated successfully.');
    setTimeout(() => setMsg(''), 3000);
  };

  const reset = async () => { setF(await api.updateSettings(DEFAULT_SETTINGS)); setMsg('Settings reset to defaults.'); setTimeout(() => setMsg(''), 3000); };

  if (!f) return null;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="System Settings" subtitle="Configure GateQR defaults for registration, passes, and the gate deployment." />
      <form onSubmit={save} className="space-y-6">
        {msg && <Alert tone="green">{msg}</Alert>}

        <section className="card space-y-4 p-6">
          <h2 className="font-semibold text-white">Campus information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Institution name"><input className="input" value={f.campusName} onChange={set('campusName')} required /></Field>
            <Field label="Gate / checkpoint name"><input className="input" value={f.gateName} onChange={set('gateName')} required /></Field>
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="font-semibold text-white">Vehicle pass defaults</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default pass validity" hint="Used when an admin approves a registration.">
              <select className="input" value={f.defaultValidityMonths} onChange={set('defaultValidityMonths')}>{[6, 12, 24].map((m) => <option key={m} value={m}>{m} months</option>)}</select>
            </Field>
            <Field label="Expiry reminder window" hint="Days before expiry to warn vehicle owners.">
              <select className="input" value={f.expiryReminderDays} onChange={set('expiryReminderDays')}>{[7, 15, 30, 60].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" className="h-4 w-4 rounded border-white/15 text-brand-600 focus:ring-brand-500" checked={f.requireLicenseCheck} onChange={set('requireLicenseCheck')} />
            Require a valid (non-expired) driver&apos;s license before a vehicle can be approved
          </label>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="font-semibold text-white">Vehicle pass slots</h2>
          <Field label="Maximum vehicle pass slots" hint="Total number of vehicles (pending + approved) that can be registered at once. New registrations are blocked once this limit is reached.">
            <input type="number" min={1} className="input" value={f.maxVehicleSlots} onChange={set('maxVehicleSlots')} required />
          </Field>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="font-semibold text-white">Visitor pass defaults</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default duration"><select className="input" value={f.defaultVisitorHours} onChange={set('defaultVisitorHours')}>{[2, 4, 8, 12].map((h) => <option key={h} value={h}>{h} hours</option>)}</select></Field>
            <Field label="Maximum duration" hint="Visitor passes are always short-term."><select className="input" value={f.maxVisitorHours} onChange={set('maxVisitorHours')}>{[8, 12, 24].map((h) => <option key={h} value={h}>{h} hours</option>)}</select></Field>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={reset}><RotateCcw className="h-4 w-4" />Reset to defaults</button>
          <button className="btn-primary" disabled={busy}>{busy ? <Spinner /> : <><Save className="h-4 w-4" />Save settings</>}</button>
        </div>
      </form>
    </div>
  );
}
