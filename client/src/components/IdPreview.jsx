import { useEffect, useState } from 'react';
import { FileText, IdCard, Loader2, Eye } from 'lucide-react';
import { supabaseStaff as supabase } from '../lib/supabase';
import { DocViewer } from './ui';

function Thumb({ label, path, onView }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(!!path);

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    supabase.storage.from('id-documents').createSignedUrl(path, 3600).then(({ data }) => {
      if (active) { setUrl(data?.signedUrl || null); setLoading(false); }
    });
    return () => { active = false; };
  }, [path]);

  if (!path) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-400/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
        <IdCard className="h-4 w-4 shrink-0" />{label} not submitted.
      </div>
    );
  }
  if (loading) {
    return <div className="flex items-center gap-2 rounded-lg border border-white/10 p-2.5 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading {label}&hellip;</div>;
  }
  const isPdf = path.toLowerCase().endsWith('.pdf');
  return (
    <button type="button" onClick={() => url && onView({ url, label, isPdf })} className="flex w-full items-center gap-3 rounded-lg border border-white/10 p-2.5 text-left hover:border-brand-400/40 hover:bg-brand-500/10">
      {isPdf ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-400"><FileText className="h-5 w-5" /></div>
      ) : (
        <img src={url} alt={label} className="h-10 w-10 shrink-0 rounded-md border border-white/10 object-cover" />
      )}
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-200">{label}</span></span>
      <Eye className="h-4 w-4 shrink-0 text-slate-500" />
    </button>
  );
}

export default function IdPreview({ frontPath, backPath, selfiePath, vehiclePhotoPath, vehicleFrontPath, vehicleSidePath, vehicleBackPath, proofPath, receiptPath }) {
  const [view, setView] = useState(null);
  const vehicleThumbs = (vehicleFrontPath || vehicleSidePath || vehicleBackPath)
    ? [['Vehicle - Front', vehicleFrontPath], ['Vehicle - Side', vehicleSidePath], ['Vehicle - Back', vehicleBackPath]]
    : [['Vehicle Photo', vehiclePhotoPath]];
  const cols = 2 + [selfiePath, ...vehicleThumbs.map(([, p]) => p), proofPath, receiptPath].filter(Boolean).length;
  return (
    <>
      <div className={`grid gap-2 ${cols >= 4 ? 'sm:grid-cols-4' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <Thumb label="ID - Front" path={frontPath} onView={setView} />
        <Thumb label="ID - Back" path={backPath} onView={setView} />
        {selfiePath && <Thumb label="Selfie with ID" path={selfiePath} onView={setView} />}
        {vehicleThumbs.map(([label, path]) => path && <Thumb key={label} label={label} path={path} onView={setView} />)}
        {proofPath && <Thumb label="Proof of Ownership" path={proofPath} onView={setView} />}
        {receiptPath && <Thumb label="Payment Receipt" path={receiptPath} onView={setView} />}
      </div>
      <DocViewer doc={view} onClose={() => setView(null)} />
    </>
  );
}
