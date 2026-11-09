import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Car, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUserAuth } from '../../context/AuthContext';
import { userApi as api, VEHICLE_TYPES, maxVehiclesForRole } from '../../lib/db';
import { Alert, Field, PageHeader, Spinner } from '../../components/ui';
import FileUpload from '../../components/FileUpload';
import { cx } from '../../lib/utils';

const MOTOR_BRANDS = [
  'Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Kymco', 'SYM', 'Rusi', 'Skygo', 'Motorstar', 'TVS', 'Bajaj', 'Keeway', 'CFMoto',
  'Benelli', 'Royal Enfield', 'Vespa', 'Piaggio', 'Ducati', 'KTM', 'BMW Motorrad', 'Harley-Davidson', 'Triumph', 'Aprilia',
  'Husqvarna', 'GPX', 'QJMotor', 'Zontes', 'Kiden', 'Racal', 'Daelim', 'Moto Guzzi', 'Indian',
];
const EMPTY = { type: 'Motorcycle', plate: '', make: '', model: '', color: '', year: '', orcrNo: '', licenseNo: '', licenseExpiry: '', idFront: null, idBack: null, selfie: null, vehicleFront: null, vehicleSide: null, vehicleBack: null, proofDoc: null };

const STEPS = [
  { n: 1, label: 'Vehicle' },
  { n: 2, label: 'Driver' },
  { n: 3, label: 'Verification' },
];

// Which form fields belong to which step, used to validate and clear errors one step at a time.
const STEP_FIELDS = {
  1: ['plate', 'make', 'model', 'color', 'year', 'orcrNo'],
  2: ['licenseNo', 'licenseExpiry'],
  3: ['idFront', 'idBack', 'selfie', 'vehicleFront', 'vehicleSide', 'vehicleBack'],
};

export default function RegisterVehicle() {
  const { user } = useUserAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [f, setF] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [slots, setSlots] = useState(null);
  const [mine, setMine] = useState(null);
  const [customMake, setCustomMake] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api.getSlotStats().then(setSlots);
    api.listVehicles(user.id).then((v) => setMine(v.filter((x) => ['pending', 'approved'].includes(x.status)).length));
  }, [user.id]);

  const validateStep = (s) => {
    const x = {};
    if (s === 1) {
      if (!/^[A-Za-z0-9 -]{5,10}$/.test(f.plate.trim())) x.plate = 'Enter a valid plate number (e.g. ABC 1234).';
      if (!f.make.trim()) x.make = 'Required.';
      if (!f.model.trim()) x.model = 'Required.';
      if (!f.color.trim()) x.color = 'Required.';
      if (!/^(19|20)\d{2}$/.test(f.year)) x.year = 'Enter a valid year.';
      if (!f.orcrNo.trim()) x.orcrNo = 'OR/CR number is required.';
    } else if (s === 2) {
      if (!f.licenseNo.trim()) x.licenseNo = "Driver's license number is required.";
      if (!f.licenseExpiry) x.licenseExpiry = 'Required.';
      else if (new Date(f.licenseExpiry) < new Date()) x.licenseExpiry = 'License is already expired.';
    } else if (s === 3) {
      if (!f.idFront) x.idFront = 'Please scan or upload the front of your ID.';
      if (!f.idBack) x.idBack = 'Please scan or upload the back of your ID.';
      if (!f.selfie) x.selfie = 'Please take a selfie holding your ID for verification.';
      if (!f.vehicleFront) x.vehicleFront = 'Front view of your vehicle is required.';
      if (!f.vehicleSide) x.vehicleSide = 'Side view of your vehicle is required.';
      if (!f.vehicleBack) x.vehicleBack = 'Back view of your vehicle is required.';
    }
    setErrs((prev) => {
      const next = { ...prev };
      STEP_FIELDS[s].forEach((k) => delete next[k]);
      return { ...next, ...x };
    });
    return !Object.keys(x).length;
  };

  const goNext = () => { if (validateStep(step)) { setErr(''); setStep((s) => Math.min(3, s + 1)); } };
  const goBack = () => { setErr(''); setStep((s) => Math.max(1, s - 1)); };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!validateStep(3)) return;
    setBusy(true);
    try { await api.addVehicle(user.id, f); setDone(true); } catch (x) { setErr(x.message); api.getSlotStats().then(setSlots); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md pt-10">
        <div className="card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
          <h2 className="text-xl font-bold text-white">Registration submitted</h2>
          <p className="mt-2 text-sm text-slate-500">Your vehicle is now pending review by the administrator. Once approved, your QR pass will be available in My Vehicles.</p>
          <div className="mt-6 flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => { setF(EMPTY); setErrs({}); setStep(1); setDone(false); api.listVehicles(user.id).then((v) => setMine(v.filter((x) => ['pending', 'approved'].includes(x.status)).length)); }}>Register another</button>
            <button className="btn-primary flex-1" onClick={() => nav('/app/vehicles')}>View my vehicles</button>
          </div>
        </div>
      </div>
    );
  }

  const isFull = slots?.full;
  const maxVehicles = maxVehiclesForRole(user.role);
  const atMax = mine != null && mine >= maxVehicles;

  return (
    <div>
      <PageHeader title="Register a Vehicle" subtitle="Provide accurate vehicle and driver information. Your request will be reviewed by the administrator." />

      {slots && (
        <div className={cx('mb-6 flex items-center gap-4 rounded-xl border p-4', isFull ? 'border-red-200 bg-red-50' : slots.available <= Math.max(5, slots.total * 0.1) ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50')}>
          <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', isFull ? 'bg-red-100 text-red-600' : slots.available <= Math.max(5, slots.total * 0.1) ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600')}><Car className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className={cx('font-semibold', isFull ? 'text-red-800' : slots.available <= Math.max(5, slots.total * 0.1) ? 'text-amber-800' : 'text-emerald-800')}>
              {isFull ? 'No vehicle pass slots available' : `${slots.available} of ${slots.total} vehicle pass slots available`}
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/70">
              <div className={cx('h-full rounded-full', isFull ? 'bg-red-500' : 'bg-brand-600')} style={{ width: `${Math.min(100, (slots.used / slots.total) * 100)}%` }} />
            </div>
            <div className={cx('mt-1 text-xs', isFull ? 'text-red-600' : 'text-slate-500')}>
              {isFull ? 'Please check back later or contact the administrator for assistance.' : `${slots.used} slots currently reserved by pending and approved registrations.`}
            </div>
          </div>
        </div>
      )}

      {mine != null && (
        <div className={cx('mb-6 flex items-center gap-4 rounded-xl border p-4', atMax ? 'border-red-500/30 bg-red-500/10' : 'border-white/10 bg-white/5')}>
          <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', atMax ? 'bg-red-500/15 text-red-400' : 'bg-brand-500/15 text-brand-300')}><Car className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className={cx('font-semibold', atMax ? 'text-red-300' : 'text-white')}>
              {atMax ? 'Vehicle registration limit reached' : `You have ${mine} of ${maxVehicles} registered vehicles`}
            </div>
            <div className={cx('mt-1 text-xs', atMax ? 'text-red-400' : 'text-slate-500')}>
              {atMax ? `Your account can register up to ${maxVehicles} vehicles. Delete a vehicle in My Vehicles to free a slot.` : `Your account can register up to ${maxVehicles} vehicles.`}
            </div>
          </div>
        </div>
      )}

      {/* Horizontal step indicator */}
      <div className="mb-6 flex items-center">
        {STEPS.map(({ n, label }, i) => (
          <div key={n} className={cx('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
            <button type="button" onClick={() => n < step && setStep(n)} disabled={n >= step}
              className={cx('flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold transition',
                n === step ? 'bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-400/30' : n < step ? 'text-emerald-400' : 'text-slate-500')}>
              <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                n === step ? 'bg-brand-500 text-white' : n < step ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400')}>
                {n < step ? <Check className="h-4 w-4" /> : n}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && <div className={cx('mx-1 h-0.5 flex-1 rounded-full', n < step ? 'bg-emerald-500' : 'bg-white/10')} />}
          </div>
        ))}
      </div>

      <form onSubmit={submit} className={cx((isFull || atMax) && 'pointer-events-none opacity-50')}>
        {err && <div className="mb-4"><Alert>{err}</Alert></div>}

        {step === 1 && (
          <section className="card mx-auto max-w-2xl p-6">
            <h2 className="mb-4 font-semibold text-white">Vehicle information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vehicle type"><select className="input" value={f.type} onChange={set('type')}>{VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Plate number" error={errs.plate}><input className="input uppercase" placeholder="ABC 1234" value={f.plate} onChange={set('plate')} /></Field>
              <Field label="Make / Brand" error={errs.make}>
                <select className="input" value={customMake || (f.make && !MOTOR_BRANDS.includes(f.make)) ? 'Other' : f.make}
                  onChange={(e) => { const v = e.target.value; setCustomMake(v === 'Other'); setF({ ...f, make: v === 'Other' ? '' : v }); }}>
                  <option value="">Select brand</option>
                  {MOTOR_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                  <option value="Other">Other (type brand)</option>
                </select>
                {(customMake || (f.make && !MOTOR_BRANDS.includes(f.make))) && <input className="input mt-2" placeholder="Enter brand" value={f.make} onChange={set('make')} />}
              </Field>
              <Field label="Model" error={errs.model}><input className="input" placeholder="Click 125" value={f.model} onChange={set('model')} /></Field>
              <Field label="Color" error={errs.color}><input className="input" placeholder="Red" value={f.color} onChange={set('color')} /></Field>
              <Field label="Year model" error={errs.year}><input className="input" placeholder="2022" maxLength={4} value={f.year} onChange={set('year')} /></Field>
              <div className="sm:col-span-2"><Field label="OR/CR number" error={errs.orcrNo}><input className="input" placeholder="Official Receipt / Certificate of Registration no." value={f.orcrNo} onChange={set('orcrNo')} /></Field></div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="card mx-auto max-w-2xl p-6">
            <h2 className="mb-4 font-semibold text-white">Driver information</h2>
            <div className="mb-4 grid gap-4 rounded-lg bg-white/5 p-4 text-sm sm:grid-cols-3">
              <div><div className="text-xs text-slate-400">Owner</div><div className="font-medium">{user.name}</div></div>
              <div><div className="text-xs text-slate-400">ID number</div><div className="font-medium">{user.idNumber || '—'}</div></div>
              <div><div className="text-xs text-slate-400">Contact</div><div className="font-medium">{user.phone || '—'}</div></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Driver's license number" error={errs.licenseNo}><input className="input" placeholder="N01-23-456789" value={f.licenseNo} onChange={set('licenseNo')} /></Field>
              <Field label="License expiry date" error={errs.licenseExpiry}><input type="date" className="input" value={f.licenseExpiry} onChange={set('licenseExpiry')} /></Field>
            </div>
          </section>
        )}

        {step === 3 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <section className="card p-5 md:col-span-2">
              <h2 className="mb-1 font-semibold text-white">ID verification</h2>
              <p className="mb-4 text-sm text-slate-500">Scan or upload both sides of a valid school / employee ID or government-issued ID for verification by the administrator.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FileUpload
                  label="ID - Front side"
                  value={f.idFront}
                  error={errs.idFront}
                  camera={false}
                  dropHint="Upload a clear photo or PDF of the front of your ID."
                  onChange={(doc, fileErr) => { setF({ ...f, idFront: doc }); setErrs({ ...errs, idFront: fileErr || undefined }); }}
                />
                <FileUpload
                  label="ID - Back side"
                  value={f.idBack}
                  error={errs.idBack}
                  camera={false}
                  dropHint="Upload a clear photo or PDF of the back of your ID."
                  onChange={(doc, fileErr) => { setF({ ...f, idBack: doc }); setErrs({ ...errs, idBack: fileErr || undefined }); }}
                />
              </div>
            </section>
            <section className="card p-5">
              <h3 className="mb-1 font-semibold text-white">Selfie with ID</h3>
              <p className="mb-4 text-sm text-slate-500">Take a selfie holding your ID so the guard at the gate can verify it's really you.</p>
              <FileUpload
                label="Selfie holding your ID"
                value={f.selfie}
                error={errs.selfie}
                capture="user"
                camLabel="Take selfie"
                dropHint="Use your front camera to take a selfie while holding your ID."
                onChange={(doc, fileErr) => { setF({ ...f, selfie: doc }); setErrs({ ...errs, selfie: fileErr || undefined }); }}
              />
            </section>
            <section className="card p-5 md:col-span-2 xl:col-span-3">
              <h3 className="mb-1 font-semibold text-white">Vehicle photos</h3>
              <p className="mb-4 text-sm text-slate-500">Take clear photos of your vehicle from three angles — front, side, and back — with the plate number visible, for verification at the gate.</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <FileUpload
                  label="Front view"
                  value={f.vehicleFront}
                  error={errs.vehicleFront}
                  camLabel="Take photo"
                  dropHint="Photo of the front of your vehicle."
                  onChange={(doc, fileErr) => { setF({ ...f, vehicleFront: doc }); setErrs({ ...errs, vehicleFront: fileErr || undefined }); }}
                />
                <FileUpload
                  label="Side view"
                  value={f.vehicleSide}
                  error={errs.vehicleSide}
                  camLabel="Take photo"
                  dropHint="Photo of the side of your vehicle."
                  onChange={(doc, fileErr) => { setF({ ...f, vehicleSide: doc }); setErrs({ ...errs, vehicleSide: fileErr || undefined }); }}
                />
                <FileUpload
                  label="Back view"
                  value={f.vehicleBack}
                  error={errs.vehicleBack}
                  camLabel="Take photo"
                  dropHint="Photo of the back of your vehicle, plate visible."
                  onChange={(doc, fileErr) => { setF({ ...f, vehicleBack: doc }); setErrs({ ...errs, vehicleBack: fileErr || undefined }); }}
                />
              </div>
            </section>
            <section className="card p-5">
              <h3 className="mb-1 font-semibold text-white">Proof of ownership <span className="font-normal text-slate-500">(optional)</span></h3>
              <p className="mb-4 text-sm text-slate-500">Add a PDF or photo of a deed of sale, OR/CR, or other document proving the vehicle is really yours. This can speed up approval.</p>
              <FileUpload
                label="Proof of ownership document"
                value={f.proofDoc}
                onChange={(doc, fileErr) => { setF({ ...f, proofDoc: doc }); setErrs({ ...errs, proofDoc: fileErr || undefined }); }}
              />
            </section>
          </div>
        )}

        <div className="mt-6 flex justify-between gap-2">
          <button type="button" className="btn-secondary" onClick={() => (step === 1 ? nav('/app/vehicles') : goBack())}>
            <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 3 ? (
            <button type="button" className="btn-primary" onClick={goNext}>Next<ChevronRight className="h-4 w-4" /></button>
          ) : (
            <button className="btn-primary" disabled={busy || isFull || atMax}>{busy ? <Spinner /> : 'Submit registration'}</button>
          )}
        </div>
      </form>
    </div>
  );
}
