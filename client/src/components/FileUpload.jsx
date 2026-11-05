import { useRef } from 'react';
import { Camera, FileText, Upload, X, ExternalLink } from 'lucide-react';
import { cx } from '../lib/utils';

const MAX_MB = 5;

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ file, name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FileUpload({ label, hint, error, value, onChange, accept = 'image/*,.pdf', maxSizeMB = MAX_MB, capture = 'environment', camera = true, camLabel = 'Scan with camera', dropHint = 'Scan your ID with your camera, or upload a clear photo / PDF copy.' }) {
  const fileRef = useRef(null);
  const camRef = useRef(null);

  const handle = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/image\/(jpeg|jpg|png|webp)|application\/pdf/.test(file.type)) return onChange(null, 'Only JPG, PNG, or PDF files are allowed.');
    if (file.size > maxSizeMB * 1024 * 1024) return onChange(null, `File is too large. Maximum size is ${maxSizeMB}MB.`);
    const doc = await readFile(file);
    onChange(doc, '');
  };

  const isPdf = value?.type === 'application/pdf';

  return (
    <div>
      {label && <label className="label">{label}</label>}
      {!value ? (
        <div className={cx('rounded-lg border-2 border-dashed p-5 text-center', error ? 'border-red-500/40 bg-red-500/5' : 'border-white/15 bg-white/5')}>
          <Upload className="mx-auto h-7 w-7 text-slate-500" />
          <p className="mt-2 text-sm text-slate-400">{dropHint}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {camera && <button type="button" className="btn-secondary" onClick={() => camRef.current.click()}><Camera className="h-4 w-4" />{camLabel}</button>}
            <button type="button" className="btn-secondary" onClick={() => fileRef.current.click()}><Upload className="h-4 w-4" />Upload file</button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture={capture} className="hidden" onChange={handle} />
          <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handle} />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
          {isPdf ? (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400"><FileText className="h-7 w-7" /></div>
          ) : (
            <img src={value.dataUrl} alt="ID preview" className="h-14 w-14 shrink-0 rounded-lg border border-white/10 object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-200">{value.name}</div>
            <div className="text-xs text-slate-500">{(value.size / 1024).toFixed(0)} KB</div>
          </div>
          <a href={value.dataUrl} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-brand-400" title="View"><ExternalLink className="h-4 w-4" /></a>
          <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400" title="Remove" onClick={() => onChange(null, '')}><X className="h-4 w-4" /></button>
        </div>
      )}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-400">{error}</p>}
    </div>
  );
}
