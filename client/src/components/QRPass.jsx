import { QRCodeCanvas } from 'qrcode.react';
import { Download, Printer } from 'lucide-react';
import { Logo, Modal, StatusBadge } from './ui';
import { passStatus, vehicleCode, passCode, vehicleStatus } from '../lib/db';
import { downloadQR, fmtDate, fmtDateTime } from '../lib/utils';

const Row = ({ k, v }) => (
  <div><div className="text-[11px] uppercase tracking-wide text-slate-400">{k}</div><div className="text-sm font-semibold text-slate-800">{v || '—'}</div></div>
);

export function VehiclePassModal({ vehicle, owner, onClose }) {
  if (!vehicle) return null;
  const st = vehicleStatus(vehicle);
  const id = `qr-${vehicle.id}`;
  return (
    <Modal open onClose={onClose} title="Vehicle QR Pass">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5">
        <div className="mb-4 flex items-center justify-between"><Logo /><StatusBadge status={st} /></div>
        <div id={id} className="mx-auto flex w-fit rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <QRCodeCanvas value={vehicleCode(vehicle)} size={240} level="M" includeMargin />
        </div>
        <div className="mt-1 text-center font-mono text-xs text-slate-400">{vehicleCode(vehicle)}</div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Row k="Plate number" v={vehicle.plate} />
          <Row k="Vehicle" v={`${vehicle.make} ${vehicle.model}`} />
          <Row k="Type / Color" v={`${vehicle.type} / ${vehicle.color}`} />
          <Row k="Owner" v={owner?.name} />
          <Row k="Valid until" v={fmtDate(vehicle.validUntil)} />
          <Row k="Issued" v={fmtDate(vehicle.approvedAt)} />
        </div>
      </div>
      {st !== 'approved' && <p className="mt-3 text-center text-sm text-amber-600">This pass is not valid for entry while its status is &quot;{st}&quot;.</p>}
      <div className="no-print mt-4 flex gap-2">
        <button className="btn-secondary flex-1" onClick={() => downloadQR(id, `GateQR-${vehicle.plate}.png`)}><Download className="h-4 w-4" />Download</button>
        <button className="btn-primary flex-1" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</button>
      </div>
    </Modal>
  );
}

export function VisitorPassModal({ pass, onClose }) {
  if (!pass) return null;
  const id = `qr-${pass.id}`;
  return (
    <Modal open onClose={onClose} title="Visitor QR Pass">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5">
        <div className="mb-4 flex items-center justify-between"><Logo /><StatusBadge status={passStatus(pass)} /></div>
        <div className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-amber-600">Visitor - Short-term pass</div>
        <div id={id} className="mx-auto flex w-fit rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <QRCodeCanvas value={passCode(pass)} size={240} level="M" includeMargin />
        </div>
        <div className="mt-1 text-center font-mono text-xs text-slate-400">{passCode(pass)}</div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Row k="Visitor" v={pass.visitorName} />
          <Row k="Plate number" v={pass.plate} />
          <Row k="Purpose" v={pass.purpose} />
          <Row k="Host / Office" v={pass.host} />
          <Row k="Valid until" v={fmtDateTime(pass.validUntil)} />
          <Row k="Vehicle type" v={pass.vehicleType} />
        </div>
      </div>
      <div className="no-print mt-4 flex gap-2">
        <button className="btn-secondary flex-1" onClick={() => downloadQR(id, `GateQR-Visitor-${pass.plate}.png`)}><Download className="h-4 w-4" />Download</button>
        <button className="btn-primary flex-1" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</button>
      </div>
    </Modal>
  );
}
