import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, CheckCircle2, XCircle, ScanLine, LogIn, LogOut, Keyboard, FileText, ExternalLink, Loader2, IdCard, Maximize, Minimize, X, Image as ImageIcon, Zap, ZapOff, SwitchCamera } from 'lucide-react';
import { useGuardAuth } from '../../context/AuthContext';
import { guardApi as api, vehicleCode } from '../../lib/db';
import { DocViewer, PageHeader, StatusBadge } from '../../components/ui';
import { cx, fmtDate, fmtDateTime, fmtTime } from '../../lib/utils';

// In-app webviews (Facebook/Messenger/Instagram/TikTok/WeChat) use a restricted
// browser engine that can let the camera preview show while still failing to
// reliably decode QR codes (canvas/frame-rate restrictions). Scanning works
// best in the device's real browser (Safari/Chrome), so we warn the guard.
const isInAppBrowser = () => /FBAN|FBAV|Messenger|Instagram|Line\/|MicroMessenger|TikTok/i.test(navigator.userAgent || '');

// Guards a promise with a timeout so a hung/stalled mobile network request
// (which neither resolves nor rejects) can't freeze the scanner forever —
// without this, `check()` would stay `await`-ing indefinitely and the
// `busy` lock would never be released.
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export default function Scanner() {
  const { user } = useGuardAuth();
  const [cam, setCam] = useState(false);
  const [inApp] = useState(isInAppBrowser);
  const [camErr, setCamErr] = useState('');
  const [logErr, setLogErr] = useState('');
  const [verifyErr, setVerifyErr] = useState('');
  const [manual, setManual] = useState('');
  const [res, setRes] = useState(null);
  const [ids, setIds] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [last, setLast] = useState(null);
  const [recent, setRecent] = useState([]);
  const [samples, setSamples] = useState([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [caps, setCaps] = useState(null);
  const [facing, setFacing] = useState('environment');
  const fileRef = useRef(null);
  const startingRef = useRef(false);
  const scanner = useRef(null);
  const busy = useRef(false);
  const stageRef = useRef(null);
  const resultRef = useRef(null);
  // html5-qrcode is handed the `check` callback exactly once, when the user
  // taps "Start camera" — it keeps that single function reference for the
  // entire scanning session (it does not ask React for a fresh one on every
  // frame). Because of normal JS closures, that frozen `check` would forever
  // see `fullscreen` as whatever it was AT THAT MOMENT (almost always
  // `false`, since the camera is started before the guard taps full screen).
  // So a later `if (fullscreen) exitFullscreen()` inside `check` never fired
  // even after going fullscreen — the scan verified fine and computed a
  // result, but the fullscreen camera stayed on top of (and completely hid)
  // the result panel forever. A ref is mutable and always read at call time,
  // so it is immune to this stale-closure trap.
  const fullscreenRef = useRef(false);
  // Diagnostics only: html5-qrcode calls the "error" callback on every frame
  // where no code was found (this is normal/expected, not a real error). We
  // count these so the guard/us can see proof the decode loop is actually
  // alive — if this never increases after "Start camera", the camera stream
  // itself never reached the decoder (a permissions/stream bug), which is a
  // very different problem than "it's scanning but never recognizes a code".
  const scanTickRef = useRef(0);
  const [scanTicks, setScanTicks] = useState(0);

  const loadRecent = () => api.listLogs().then((l) => setRecent(l.slice(0, 8))).catch(() => {});
  useEffect(() => { loadRecent(); api.listVehicles().then((v) => setSamples(v.slice(0, 5))); return () => { stop(); }; }, []);

  // `fullscreen` is a plain local UI state — it does NOT depend on the browser's
  // real Fullscreen API. iOS Safari does not support requestFullscreen() on a
  // <div> at all (it silently fails), which previously left the button doing
  // nothing on iPhone. We now always apply a CSS "fake fullscreen" (fixed,
  // covers the viewport) and only *additionally* try the native API so
  // desktop/Android also get real fullscreen (hides browser chrome) when
  // available. Exiting via Escape/back on browsers that do support it is
  // synced back into this state via the fullscreenchange listener.
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setFullscreen(false); };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => { fullscreenRef.current = fullscreen; }, [fullscreen]);

  // On phones the result card sits BELOW the tall camera stage (mobile
  // order-2), so a successful scan used to render off-screen and look like
  // "nothing happened". Auto-scroll it into view the moment a result lands.
  useEffect(() => {
    if (res) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [res]);

  const exitFullscreen = async () => {
    setFullscreen(false);
    if (document.fullscreenElement) { try { await (document.exitFullscreen?.() || document.webkitExitFullscreen?.()); } catch { /* ignore */ } }
  };

  const toggleFullscreen = async () => {
    if (fullscreen) { await exitFullscreen(); return; }
    setFullscreen(true);
    try {
      const el = stageRef.current;
      await (el?.requestFullscreen?.() || el?.webkitRequestFullscreen?.() || el?.webkitEnterFullscreen?.());
    } catch { /* native fullscreen unsupported (e.g. iOS Safari) — CSS fallback above still applies */ }
  };

  const toggleTorch = async () => {
    const next = !torch;
    try { await scanner.current?.applyVideoConstraints?.({ advanced: [{ torch: next }] }); setTorch(next); } catch { /* torch unsupported on this device */ }
  };

  const applyZoom = async (z) => {
    const prev = zoom;
    setZoom(z);
    try { await scanner.current?.applyVideoConstraints?.({ advanced: [{ zoom: z }] }); } catch { setZoom(prev); }
  };

  // Flip = restart the camera with the other facingMode. start() already
  // disposes the previous instance first, so we just pass the new mode
  // through — it keeps fullscreen open instead of bouncing the guard out.
  const flip = async () => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    await start(next);
  };

  // Scan a QR from a photo/screenshot the guard picks. Uses a throwaway
  // Html5Qrcode bound to a hidden element — calling scanFile() on the
  // RUNNING instance would throw because it's busy with the camera.
  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const fs = new Html5Qrcode('qr-file-reader');
      try {
        const txt = await fs.scanFile(file, false);
        if (txt) check(txt);
      } finally { try { fs.clear(); } catch { /* never started */ } }
    } catch {
      setVerifyErr('No QR code found in that image.');
      setTimeout(() => setVerifyErr(''), 4000);
    }
  };

  const stop = async () => {
    const s = scanner.current;
    scanner.current = null;
    if (s) { try { await s.stop(); s.clear(); } catch { /* already stopped */ } }
    setCam(false);
    setCaps(null); setTorch(false); setZoom(1);
    await exitFullscreen();
  };

  const check = async (code) => {
    if (busy.current) return;
    busy.current = true;
    setLogErr('');
    // Everything below must never throw out of this function uncaught: if it
    // did, `busy.current` would stay `true` forever (the reset below would
    // never run), permanently freezing the scanner after a single failed
    // verify — with nothing visible on screen to explain why. This is the
    // most likely reason scanning appeared to "do nothing" on flaky mobile
    // connections: the very first network hiccup silently broke every scan
    // after it until the page was reloaded.
    try {
      const r = await withTimeout(api.verify(code), 10000, 'The request timed out. Check your internet connection and try again.');
      setRes(r);
      // Haptic nudge so the guard feels the scan land even before looking
      // at the result card (no-op on devices without vibration support).
      try { navigator.vibrate?.(120); } catch { /* unsupported */ }
      setIds(null);
      // The result card is a separate panel outside the camera stage; while in
      // fullscreen the camera covers the whole viewport (z-[60]) so a result
      // would otherwise be computed but never visible to the guard. Drop out
      // of fullscreen as soon as we have something to show. Reads the ref
      // (not the `fullscreen` state) because this function was captured by
      // html5-qrcode once at Start-Camera time — see fullscreenRef comment.
      if (fullscreenRef.current) exitFullscreen();
      if (r.vehicle) api.getIdSignedUrls(r.vehicle).then(setIds).catch(() => {});
      try { setLast(r.refId ? await api.lastAction(r.refId) : null); } catch { setLast(null); }
      if (!r.ok) {
        try {
          await api.recordLog({ code: r.code, type: r.kind || 'unknown', refId: r.refId || '', plate: r.plate || '', name: r.name || '', action: 'entry', result: 'denied', reason: r.reason, guardId: user.id });
          loadRecent();
        } catch (e) { setLogErr(e.message); }
      }
    } catch (e) {
      setVerifyErr(`Could not verify that code (${e.message || 'network error'}). Point the camera at the QR again.`);
      setTimeout(() => setVerifyErr(''), 4000);
    } finally {
      setTimeout(() => { busy.current = false; }, 1500);
    }
  };

  const start = async (fm) => {
    // Guard against re-entrant calls: html5-qrcode's internal state machine
    // throws "Cannot transition to a new state, already under transition"
    // when start() is invoked while a previous start()/stop() on the same
    // mounted element hasn't fully settled yet (e.g. a fast double
    // click/tap, or clicking "Start camera" again right after a failed
    // attempt before its internal cleanup finished). Blocking re-entry here,
    // and fully awaiting cleanup of any leftover instance first, removes
    // that race rather than just reporting it after the fact. A camera flip
    // is the one exception: it passes an explicit facingMode (`fm`) and is
    // allowed through while already running — the cleanup below disposes the
    // live instance before the new one is created.
    if (startingRef.current || (cam && !fm)) return;
    startingRef.current = true;
    setStarting(true);
    setCamErr('');
    if (scanner.current) {
      try { await scanner.current.stop(); scanner.current.clear(); } catch { /* already stopped/never started */ }
      scanner.current = null;
    }
    setCam(true);
    scanTickRef.current = 0;
    setScanTicks(0);
    // IMPORTANT: no `await`/`setTimeout` before requesting the camera. Phone
    // browsers (iOS Safari in particular) only grant getUserMedia() when it
    // is called synchronously within the user's tap — any delay here can
    // make the permission request silently fail on mobile while still
    // working fine on a desktop webcam. The <div id="qr-reader"> is always
    // mounted (only its CSS visibility toggles), so it's safe to grab it
    // immediately without waiting for a re-render.
    try {
      const s = new Html5Qrcode('qr-reader');
      scanner.current = s;
      // qrbox is a FUNCTION of the viewfinder size so the decode zone always
      // matches the big visual frame (~94cqw × 64cqh) instead of being a
      // small hidden square in the middle. With the old fixed {320,260} box,
      // a QR held anywhere outside the center band on the wide desktop frame
      // simply never decoded — scanning "worked" but produced no result.
      // (Earlier breakage attributed to "callback qrbox" came from the batch
      // of other constraint changes tried alongside it; this form stays
      // within the viewfinder by construction.)
      const config = {
        fps: 10,
        qrbox: (vw, vh) => ({
          width: Math.max(50, Math.floor(Math.min(vw * 0.92, 560))),
          height: Math.max(50, Math.floor(Math.min(vh * 0.62, 420))),
        }),
        disableFlip: false,
      };
      const onScan = (txt) => check(txt);
      // Not a real error — html5-qrcode calls this on every frame with no
      // code in view. Used only to prove the decode loop is actually running.
      const onScanFailure = () => {
        scanTickRef.current += 1;
        if (scanTickRef.current % 5 === 0) setScanTicks(scanTickRef.current);
      };
      try {
        // Prefer the rear camera (typical on phones). Bare facingMode is
        // only a preference to getUserMedia, so laptops without a rear
        // camera still work.
        await s.start({ facingMode: fm || facing }, config, onScan, onScanFailure);
      } catch {
        // Some mobile browsers can't honor facingMode — fall back to an
        // enumerated camera matching the requested side (rear on phones).
        // deviceId stays `exact` here since we already enumerated devices.
        const cams = await Html5Qrcode.getCameras();
        if (!cams?.length) throw new Error('No camera found on this device.');
        const wantRear = (fm || facing) !== 'user';
        const pref = cams.find((c) => (wantRear ? /back|rear|environment/i.test(c.label) : /front|user|facetime/i.test(c.label)));
        const chosen = pref || cams[wantRear ? cams.length - 1 : 0];
        await s.start({ deviceId: { exact: chosen.id } }, config, onScan, onScanFailure);
      }
      // Read the opened track's capabilities (torch, zoom) so the overlay
      // only shows controls this device actually supports — iOS Safari
      // reports neither, so the flash/zoom buttons simply never appear.
      try { setCaps(s.getRunningTrackCapabilities?.() || null); } catch { setCaps(null); }
      setTorch(false);
      setZoom(1);
    } catch (e) {
      // Surface the REAL browser error instead of one generic message for
      // every possible failure. html5-qrcode does not always reject with a
      // proper Error/DOMException — it sometimes rejects with a plain
      // STRING, which has no `.name`/`.message`, so reading those directly
      // silently produced an empty, unhelpful result. Normalize to a single
      // text blob first (covering both shapes), then pattern-match on it.
      const raw = (typeof e === 'string' ? e : `${e?.name || ''} ${e?.message || ''}`).trim();
      const specific =
        /NotAllowedError|Permission denied|permission/i.test(raw) ? 'Camera permission was denied. Open the site settings (lock/info icon in the address bar) → Camera → Allow, then reload the page.'
        : /NotReadableError|could not start video source|TrackStartError/i.test(raw) ? 'The camera is already in use by another tab, window, or app. Close other tabs/apps using the camera (including other GateQR tabs) and try again.'
        : /NotFoundError|OverconstrainedError|no camera/i.test(raw) ? 'No usable camera was found on this device.'
        : /SecurityError/i.test(raw) ? 'Camera access requires a secure (https) connection.'
        : `Unable to access the camera${raw ? ` (${raw})` : ''}.`;
      setCamErr(`${specific} You can also use manual entry below.`);
      scanner.current = null;
      setCam(false);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const confirm = async (action) => {
    try {
      await api.recordLog({ code: res.code, type: res.kind, refId: res.refId, plate: res.plate, name: res.name, action, result: 'granted', reason: '', guardId: user.id });
      setRes(null); setManual(''); loadRecent();
    } catch (e) { setLogErr(e.message); }
  };

  const suggested = last === 'entry' ? 'exit' : 'entry';

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader title="Gate Scanner" subtitle="Scan a vehicle or visitor QR pass to verify access and log entry or exit." />
      {inApp && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          <ScanLine className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-semibold">You're viewing this inside an app's built-in browser (e.g. Messenger).</div>
            <p className="mt-1 text-amber-200/80">Camera scanning can be unreliable here. For best results, tap the <b>···</b> menu and choose <b>Open in Safari/Chrome</b>, then sign in again.</p>
          </div>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-7">
        {/* Camera: always first. */}
        <div className="order-1 xl:col-span-4 xl:row-start-1">
          <div className="card p-6">
            <div ref={stageRef} className={cx('relative flex items-center justify-center overflow-hidden bg-slate-950 [container-type:size]', fullscreen ? 'fixed inset-0 z-[60] h-screen w-screen rounded-none' : 'aspect-[3/4] rounded-2xl sm:aspect-auto sm:h-[560px] xl:h-[640px]')}>
              {/* Always mounted with real, non-zero dimensions (never display:none) so
                  html5-qrcode gets a properly sized container the instant start() runs —
                  a hidden (display:none) container at start time is why scanning could
                  silently fail to ever detect a code on some mobile browsers even though
                  the camera light turned on. Visibility of the "camera off" placeholder
                  is handled by a separate overlay on top instead. */}
              <div id="qr-reader" className="absolute inset-0 h-full w-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover [&_#qr-shaded-region]:!hidden" />
              {!cam && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900 px-6 text-center text-slate-400">
                  <div>
                    <ScanLine className="mx-auto mb-3 h-20 w-20" strokeWidth={1} />
                    <p className="text-base">Camera is off. Start the scanner to read QR codes.</p>
                  </div>
                </div>
              )}
              {cam && (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
                  {/* Top bar — close / title / fullscreen, matching the
                      mobile scanner layout (X top-left, title centered). */}
                  <div className="pointer-events-auto flex items-center justify-between bg-gradient-to-b from-slate-950/70 to-transparent px-4 pb-6 pt-4">
                    <button type="button" onClick={stop} title="Close scanner"
                      className="rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </button>
                    <div className="text-sm font-semibold tracking-wide text-slate-200">Scan code</div>
                    <button type="button" onClick={toggleFullscreen} title={fullscreen ? 'Exit full screen' : 'Full screen'}
                      className="rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/20">
                      {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Scan frame: corner brackets + dot grid + sweeping beam. */}
                  <div className="flex min-h-0 flex-1 items-center justify-center px-6">
                    <div className="flex h-full w-full min-h-0 flex-col items-center justify-center gap-3">
                      {/* cqh/cqw resolve against the stage ([container-type:size]
                          above), so the wide landscape frame always fits —
                          whichever of height/width is tighter wins. The h-64/w-80
                          classes are a fixed fallback for browsers without
                          container-query-unit support (invalid min() is dropped). */}
                      <div className="relative h-80 w-96 shrink-0" style={{ height: 'min(64cqh, 72cqw)', width: 'min(94cqw, 88cqh)' }}>
                        {/* Dimmed backdrop: the huge box-shadow darkens everything
                            around the frame so the eye focuses on the scan area,
                            plus a soft emerald halo hugging the frame. */}
                        <div className="absolute inset-0 rounded-[22px] shadow-[0_0_0_9999px_rgba(2,6,23,0.6),0_0_45px_rgba(52,211,153,0.18)]" />
                        {/* Barely-there tint inside the scan area — no connecting
                            border, so the brackets float cleanly like the
                            reference style. */}
                        <div className="absolute inset-0 rounded-[22px] bg-slate-950/15" />
                        {/* Dot grid + vignette + beam, clipped to the rounded frame. */}
                        <div className="absolute inset-0 overflow-hidden rounded-[22px]">
                          <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(rgba(148,163,184,0.5) 1px, transparent 1.5px)', backgroundSize: '22px 22px' }} />
                          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/40" />
                          {/* Scanning beam — a bright glowing line wrapped in a
                              soft light band, swept top→bottom→top by the
                              animate-scan-line keyframes. */}
                          <div className="absolute inset-x-0 h-20 animate-scan-line">
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent" />
                            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-gradient-to-r from-emerald-300 via-emerald-200 to-emerald-300 shadow-[0_0_24px_8px_rgba(52,211,153,0.85)]" />
                          </div>
                        </div>
                        {/* Floating L-brackets — thin strokes with small corner
                            radius; drop-shadow follows the painted borders so
                            only the brackets glow, not a box. */}
                        <span className="absolute left-0 top-0 h-14 w-14 rounded-tl-[22px] border-l-[3px] border-t-[3px] border-emerald-400 drop-shadow-[0_0_7px_rgba(52,211,153,0.9)]" />
                        <span className="absolute right-0 top-0 h-14 w-14 rounded-tr-[22px] border-r-[3px] border-t-[3px] border-emerald-400 drop-shadow-[0_0_7px_rgba(52,211,153,0.9)]" />
                        <span className="absolute bottom-0 left-0 h-14 w-14 rounded-bl-[22px] border-b-[3px] border-l-[3px] border-emerald-400 drop-shadow-[0_0_7px_rgba(52,211,153,0.9)]" />
                        <span className="absolute bottom-0 right-0 h-14 w-14 rounded-br-[22px] border-b-[3px] border-r-[3px] border-emerald-400 drop-shadow-[0_0_7px_rgba(52,211,153,0.9)]" />
                      </div>
                      <p className="mt-2 text-sm font-medium tracking-wide text-slate-300 drop-shadow-[0_1px_2px_rgba(2,6,23,0.8)]">Align the code inside the frame</p>
                    </div>
                  </div>

                  {/* Bottom bar — status, zoom, flash hint, action buttons. */}
                  <div className="pointer-events-auto flex flex-col items-center gap-3 bg-gradient-to-t from-slate-950/80 to-transparent px-4 pb-4 pt-6">
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-1.5 rounded-full bg-slate-950/70 px-3 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        Scanning… <span className="text-slate-500">({scanTicks})</span>
                      </div>
                      {(caps?.zoom?.max ?? 1) >= 2 && (
                        <div className="flex overflow-hidden rounded-full bg-slate-950/70 text-xs font-semibold text-slate-300 backdrop-blur">
                          {[1, 2].map((z) => (
                            <button key={z} type="button" onClick={() => applyZoom(z)}
                              className={cx('px-3.5 py-1.5 transition', zoom === z ? 'bg-emerald-400 text-slate-950' : 'hover:bg-white/10')}>
                              {z}x
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {caps?.torch && !torch && (
                      <button type="button" onClick={toggleTorch}
                        className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/30 backdrop-blur transition hover:bg-amber-500/25">
                        <Zap className="h-3.5 w-3.5" />Too dark? Turn on the flash
                      </button>
                    )}
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={() => fileRef.current?.click()} title="Scan a photo of a QR code"
                        className="rounded-full bg-white/10 p-3 text-white backdrop-blur transition hover:bg-white/20">
                        <ImageIcon className="h-5 w-5" />
                      </button>
                      <button type="button" onClick={toggleTorch} disabled={!caps?.torch}
                        title={caps?.torch ? (torch ? 'Turn flash off' : 'Turn flash on') : 'Flash not supported on this device'}
                        className={cx('rounded-full p-4 shadow-lg transition',
                          torch ? 'bg-amber-400 text-slate-950 shadow-amber-400/30 hover:bg-amber-300' : 'bg-emerald-400 text-slate-950 shadow-emerald-400/30 hover:bg-emerald-300',
                          !caps?.torch && 'opacity-40')}>
                        {torch ? <ZapOff className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                      </button>
                      <button type="button" onClick={flip} disabled={starting} title="Switch camera"
                        className="rounded-full bg-white/10 p-3 text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-50">
                        {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <SwitchCamera className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {verifyErr && (
                <div className="absolute inset-x-3 top-16 z-20 rounded-lg bg-red-600/95 px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg">{verifyErr}</div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
            <div id="qr-file-reader" className="hidden" />
            {camErr && <p className="mt-3 text-sm text-red-600">{camErr}</p>}
            {logErr && <p className="mt-3 text-sm text-amber-400">Log was not saved: {logErr}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {!cam ? (
                <button className="btn-primary px-6 py-3 text-base" onClick={() => start()} disabled={starting}>
                  {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}{starting ? 'Starting…' : 'Start camera'}
                </button>
              ) : <button className="btn-danger px-6 py-3 text-base" onClick={stop}><CameraOff className="h-5 w-5" />Stop camera</button>}
              {cam && <button className="btn-secondary px-6 py-3 text-base" onClick={toggleFullscreen}>{fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}{fullscreen ? 'Exit full screen' : 'Full screen'}</button>}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) check(manual); }} className="mt-6 border-t border-white/5 pt-6">
              <label className="label flex items-center gap-2 text-sm"><Keyboard className="h-4 w-4" />Manual / USB scanner entry</label>
              <div className="flex gap-2">
                <input className="input font-mono" placeholder="GATEQR:V:..." value={manual} onChange={(e) => setManual(e.target.value)} />
                <button className="btn-primary">Verify</button>
              </div>
              {samples.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  Demo codes:
                  {samples.map((v) => <button key={v.id} type="button" className="rounded-full bg-white/10 px-2.5 py-1 font-medium hover:bg-brand-50 hover:text-brand-700" onClick={() => { setManual(vehicleCode(v)); check(vehicleCode(v)); }}>{v.plate}</button>)}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Result: shown right after the camera on mobile so it doesn't require scrolling past Recent activity. On desktop it sits beside the camera, spanning both rows. */}
        <div ref={resultRef} className="order-2 scroll-mt-4 xl:col-span-3 xl:row-span-2 xl:row-start-1">
          <div className="card overflow-hidden">
            {!res ? (
              <div className="p-16 text-center text-slate-400"><ScanLine className="mx-auto mb-3 h-12 w-12" /><div className="text-sm">Waiting for a scan...</div></div>
            ) : (
              <>
                <div className={`flex items-center gap-3 px-6 py-5 text-white ${res.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
                  {res.ok ? <CheckCircle2 className="h-9 w-9" /> : <XCircle className="h-9 w-9" />}
                  <div><div className="text-xl font-bold tracking-tight">{res.ok ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</div>{!res.ok && <div className="text-sm opacity-90">{res.reason}</div>}</div>
                </div>
                {res.kind && (
                  <dl className="grid grid-cols-2 gap-4 p-6 text-sm">
                    <div><dt className="text-xs text-slate-400">Type</dt><dd className="font-semibold capitalize">{res.kind}</dd></div>
                    <div><dt className="text-xs text-slate-400">Plate</dt><dd className="font-mono font-semibold">{res.plate}</dd></div>
                    <div><dt className="text-xs text-slate-400">{res.kind === 'vehicle' ? 'Owner' : 'Visitor'}</dt><dd className="font-semibold">{res.name}</dd></div>
                    {res.kind === 'vehicle' ? (
                      <>
                        <div><dt className="text-xs text-slate-400">Vehicle</dt><dd className="font-semibold">{res.vehicle.make} {res.vehicle.model} ({res.vehicle.color})</dd></div>
                        <div><dt className="text-xs text-slate-400">Role / ID</dt><dd className="font-semibold capitalize">{res.owner?.role} &middot; {res.owner?.idNumber || '—'}</dd></div>
                        <div><dt className="text-xs text-slate-400">Valid until</dt><dd className="font-semibold">{fmtDate(res.vehicle.validUntil)}</dd></div>
                      </>
                    ) : (
                      <>
                        <div><dt className="text-xs text-slate-400">Purpose</dt><dd className="font-semibold">{res.pass.purpose}</dd></div>
                        <div><dt className="text-xs text-slate-400">Host</dt><dd className="font-semibold">{res.pass.host}</dd></div>
                        <div><dt className="text-xs text-slate-400">Valid until</dt><dd className="font-semibold">{fmtDateTime(res.pass.validUntil)}</dd></div>
                      </>
                    )}
                  </dl>
                )}
                {res.kind === 'vehicle' && (
                  <div className="border-t border-white/5 bg-white/[0.02] px-6 py-5">
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <IdCard className="h-4 w-4" />Owner &amp; vehicle verification
                    </div>
                    {!res.vehicle.idFrontPath && !res.vehicle.idBackPath && !res.vehicle.selfiePath && !res.vehicle.vehiclePhotoPath && !res.vehicle.vehicleFrontPath && !res.vehicle.proofDocPath ? (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-300"><IdCard className="h-4 w-4 shrink-0" />No ID or vehicle documents were submitted with this registration.</div>
                    ) : !ids ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading documents…</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {[
                          ['ID — Front', ids.front, res.vehicle.idFrontPath],
                          ['ID — Back', ids.back, res.vehicle.idBackPath],
                          ['Selfie with ID', ids.selfie, res.vehicle.selfiePath],
                          ...(res.vehicle.vehicleFrontPath || res.vehicle.vehicleSidePath || res.vehicle.vehicleBackPath
                            ? [
                                ['Vehicle — Front', ids.vehicleFront, res.vehicle.vehicleFrontPath],
                                ['Vehicle — Side', ids.vehicleSide, res.vehicle.vehicleSidePath],
                                ['Vehicle — Back', ids.vehicleBack, res.vehicle.vehicleBackPath],
                              ]
                            : [['Vehicle Photo', ids.vehiclePhoto, res.vehicle.vehiclePhotoPath]]),
                          ['Proof of Ownership', ids.proof, res.vehicle.proofDocPath],
                        ]
                          .filter(([, , path]) => path)
                          .map(([label, url, path]) => (
                            <button key={label} type="button" onClick={() => url && setViewer({ url, label, isPdf: path.toLowerCase().endsWith('.pdf') })}
                              className="group relative block overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-sm transition hover:border-brand-400/50 hover:shadow-md hover:shadow-brand-500/10">
                              {path.toLowerCase().endsWith('.pdf') ? (
                                <div className="flex h-32 flex-col items-center justify-center gap-1.5 bg-white/5 text-red-400"><FileText className="h-9 w-9" /><span className="text-[11px] font-semibold text-slate-300">Open PDF</span></div>
                              ) : (
                                <img src={url} alt={label} className="h-32 w-full object-cover transition duration-200 group-hover:scale-105" />
                              )}
                              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/90 to-slate-950/0 px-2.5 pb-2 pt-4 text-[11px] font-semibold text-white">
                                {label}<ExternalLink className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-3 border-t border-white/5 p-5">
                  {res.ok ? (
                    suggested === 'entry'
                      ? <button className="btn-success flex-1 py-3 text-base" onClick={() => confirm('entry')}><LogIn className="h-5 w-5" />Log entry</button>
                      : <button className="btn-success flex-1 py-3 text-base" onClick={() => confirm('exit')}><LogOut className="h-5 w-5" />Log exit</button>
                  ) : <button className="btn-secondary flex-1 py-3 text-base" onClick={() => setRes(null)}>Dismiss</button>}
                </div>
                {res.ok && last && <p className="px-5 pb-4 text-center text-xs text-slate-400">Last recorded action: {last}</p>}
              </>
            )}
          </div>
        </div>

        {/* Recent activity: last on mobile, under the camera on desktop. */}
        <div className="order-3 xl:col-span-4 xl:row-start-2">
          <div className="card">
            <div className="border-b border-white/5 px-5 py-3.5 font-semibold text-white">Recent activity</div>
            <ul className="divide-y divide-white/5">
              {recent.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <div><span className="font-mono font-semibold">{l.plate || 'Unknown'}</span><span className="ml-2 text-xs text-slate-400">{fmtTime(l.timestamp)}</span></div>
                  <div className="flex gap-1"><StatusBadge status={l.action} /><StatusBadge status={l.result} /></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <DocViewer doc={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
