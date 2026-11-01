'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { postJson } from '@/lib/post-json';
import { KIND_LABELS, type AttendanceKind, type ScreenState } from '../rules/attendance';

type Props = {
  branchName: string; shiftName: string | null; hours: string | null; state: ScreenState;
  times: Partial<Record<AttendanceKind, string>>; breakUntil: string | null; aloneNoBreak: boolean;
  presetCode: string | null;
};

type ScanData = {
  branchId: number; branchName: string; needsAssist: boolean; matchedShift: string | null;
  shiftOptions: { id: number; name: string; hours: string }[];
};

type Step = 'idle' | 'scan' | 'assist' | 'locate' | 'photo' | 'confirm' | 'done';
type Located = { attemptId: number; distanceM: number; inside: boolean; branchName: string };

const STATUS_TEXT = (state: ScreenState, times: Props['times'], breakUntil: string | null): string => {
  switch (state.status) {
    case 'NOT_IN': return 'Belum masuk';
    case 'TOO_EARLY': return `Absen baru bisa dibuka mulai ${state.opensAt}`;
    case 'CLOSED': return 'Hari ini cabang tutup';
    case 'NO_POINT': return 'Absen di cabang ini belum bisa dipakai. Hubungi HR';
    case 'IN': return `Sudah masuk ${times.IN}`;
    case 'ON_BREAK': return `Sedang istirahat sejak ${times.BREAK}${breakUntil ? `, sampai ${breakUntil}` : ''}`;
    case 'OUT': return `Foto pulang ${times.OUT}`;
  }
};

function readCodeFromQr(text: string): string | null {
  try {
    return new URL(text).searchParams.get('c');
  } catch {
    return null;
  }
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

const CAMERA_ERROR = 'Kamera tidak bisa dibuka. Izinkan kamera di browser lalu coba lagi. Handphone bermasalah? Hubungi HR.';

/** Pindai QR dengan kamera belakang. Pustakanya dimuat saat dibutuhkan saja. */
function QrScanner({ onCode, onError }: { onCode: (code: string) => void; onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    (async () => {
      try {
        const { default: jsQR } = await import('jsqr');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return stopStream(stream);
        const element = video.current!;
        element.srcObject = stream;
        await element.play();
        const canvas = document.createElement('canvas');
        const tick = () => {
          if (stopped) return;
          if (element.videoWidth) {
            canvas.width = element.videoWidth;
            canvas.height = element.videoHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true })!;
            context.drawImage(element, 0, 0);
            const found = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            const code = found ? readCodeFromQr(found.data) : null;
            if (code) return onCode(code);
          }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch {
        onError(CAMERA_ERROR);
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stopStream(stream);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <video ref={video} playsInline muted className="aspect-square w-full rounded-lg bg-black object-cover" />;
}

/** Foto diri hanya dari kamera langsung, tanpa pilihan berkas (KEH-15). Pratinjau dicerminkan, hasilnya tidak terbalik. */
function SelfieCamera({ onPhoto, onError }: { onPhoto: (photo: Blob) => void; onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (stopped) return stopStream(stream);
        video.current!.srcObject = stream;
        await video.current!.play();
        setReady(true);
      } catch {
        onError(CAMERA_ERROR);
      }
    })();
    return () => {
      stopped = true;
      stopStream(stream);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function capture() {
    const element = video.current!;
    const scale = Math.min(1, 960 / Math.max(element.videoWidth, element.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(element.videoWidth * scale);
    canvas.height = Math.round(element.videoHeight * scale);
    canvas.getContext('2d')!.drawImage(element, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => (blob ? onPhoto(blob) : onError('Foto gagal diambil. Coba lagi.')), 'image/jpeg', 0.75);
  }
  return (
    <div className="space-y-3">
      <video ref={video} playsInline muted className="aspect-square w-full -scale-x-100 rounded-lg bg-black object-cover" />
      <Button block disabled={!ready} onClick={capture} className="min-h-12">Ambil foto</Button>
    </div>
  );
}

function readLocation(): Promise<GeolocationCoordinates | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((position) => resolve(position.coords), () => resolve(null), {
      enableHighAccuracy: true, timeout: 20_000, maximumAge: 0,
    });
  });
}

export function AttendanceScreen({ branchName, shiftName, hours, state, times, breakUntil, aloneNoBreak, presetCode }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('idle');
  const [kind, setKind] = useState<AttendanceKind>('IN');
  const [code, setCode] = useState<string | null>(presetCode);
  const [scan, setScan] = useState<ScanData | null>(null);
  const [shiftId, setShiftId] = useState('');
  const [located, setLocated] = useState<Located | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!photo) return setPhotoUrl(null);
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const reset = useCallback(() => {
    setStep('idle'); setScan(null); setShiftId(''); setLocated(null); setPhoto(null);
  }, []);

  const finish = useCallback((text: string, wasOut = false) => {
    reset();
    setCode(null);
    setMessage(text);
    // Sesudah foto Pulang langsung ke Laporan Pulang (spec L3d §3).
    router.replace(wasOut ? '/absen?laporan=1' : '/absen');
    router.refresh();
  }, [reset, router]);

  async function locate(useCode: string, useKind: AttendanceKind, chosen: number | null, assist: boolean) {
    setStep('locate');
    setError(null);
    setBusy(true);
    const coords = await readLocation();
    const result = await postJson('/api/attendance/check', {
      action: 'locate', code: useCode, kind: useKind, assist, shiftId: chosen,
      latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null, accuracy: coords?.accuracy ?? null,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Belum terkirim. Coba lagi.');
    setLocated(result.data as unknown as Located);
  }

  async function afterScan(useCode: string, useKind: AttendanceKind) {
    setCode(useCode);
    setError(null);
    setBusy(true);
    const result = await postJson('/api/attendance/check', { action: 'scan', code: useCode, kind: useKind });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Belum terkirim. Coba lagi.');
      setCode(null);
      setStep('idle');
      return;
    }
    const data = result.data as unknown as ScanData;
    setScan(data);
    if (data.needsAssist) return setStep('assist');
    await locate(useCode, useKind, null, false);
  }

  function begin(nextKind: AttendanceKind) {
    setKind(nextKind);
    setError(null);
    setMessage(null);
    if (code) return void afterScan(code, nextKind);
    setStep('scan');
  }

  async function takeBreak() {
    setError(null);
    setMessage(null);
    setBusy(true);
    const coords = await readLocation();
    const result = await postJson('/api/attendance/check', {
      action: 'break', latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null, accuracy: coords?.accuracy ?? null,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Belum terkirim. Coba lagi.');
    setMessage(String(result.data?.message ?? ''));
    router.refresh();
  }

  async function wrongScan() {
    if (code) await postJson('/api/attendance/check', { action: 'wrong_scan', code });
    reset();
    setCode(null);
    router.replace('/absen');
  }

  async function send() {
    if (!photo || !located) return;
    setError(null);
    setBusy(true);
    const form = new FormData();
    form.set('attemptId', String(located.attemptId));
    form.set('kind', kind);
    form.set('photo', new File([photo], 'absen.jpg', { type: 'image/jpeg' }));
    const result = await postJson('/api/attendance/submit', form);
    setBusy(false);
    if (!result.ok) {
      const text = result.error ?? '';
      return setError(text.includes('jaringan') ? 'Belum terkirim. Coba lagi.' : text);
    }
    finish(String(result.data?.message ?? 'Absen tercatat.'), kind === 'OUT');
  }

  if (step !== 'idle') {
    const stepNumber = step === 'scan' || step === 'assist' ? 1 : step === 'locate' ? 2 : step === 'photo' ? 3 : 4;
    return (
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-sm text-ink-muted">{KIND_LABELS[kind]} · Langkah {stepNumber} dari 4</p>
        {error && <Alert tone="danger">{error}</Alert>}

        {step === 'scan' && (
          <Card className="space-y-3">
            <h2 className="font-semibold">Pindai QR cabang</h2>
            <QrScanner onCode={(found) => void afterScan(found, kind)} onError={setError} />
          </Card>
        )}

        {step === 'assist' && scan && (
          <Card className="space-y-3">
            <h2 className="font-semibold">QR ini milik {scan.branchName}</h2>
            <p className="text-sm text-ink-muted">Anda sedang perbantuan di sini, atau salah scan?</p>
            {!scan.matchedShift && scan.shiftOptions.length > 0 && (
              <Field id="assist-shift" label="Shift di cabang ini">
                <Select id="assist-shift" value={shiftId} onChange={(event) => setShiftId(event.target.value)}>
                  <option value="">Pilih shift</option>
                  {scan.shiftOptions.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} ({shift.hours})</option>)}
                </Select>
              </Field>
            )}
            {scan.matchedShift && <p className="text-sm">Shift yang dipakai: {scan.matchedShift}</p>}
            <Button
              block className="min-h-12"
              disabled={!scan.matchedShift && scan.shiftOptions.length > 0 && !shiftId}
              onClick={() => void locate(code!, kind, shiftId ? Number(shiftId) : null, true)}
            >
              Sedang perbantuan
            </Button>
            <Button block variant="secondary" className="min-h-12" onClick={() => void wrongScan()}>Salah scan</Button>
          </Card>
        )}

        {step === 'locate' && (
          <Card className="space-y-3">
            <h2 className="font-semibold">Lokasi</h2>
            {busy && <p className="text-sm text-ink-muted">Sedang memeriksa lokasi…</p>}
            {located?.inside && <Alert tone="ok">Lokasi sesuai ({located.distanceM} m dari titik {located.branchName}).</Alert>}
            {located && !located.inside && (
              <Alert tone="warn">Anda di luar titik absen ({located.distanceM} m). Absen tetap dicatat dan akan ditinjau HR.</Alert>
            )}
            {located && <Button block className="min-h-12" onClick={() => setStep('photo')}>Lanjut ke foto</Button>}
            {!busy && !located && <Button block className="min-h-12" onClick={() => void locate(code!, kind, shiftId ? Number(shiftId) : null, Boolean(scan?.needsAssist))}>Coba lagi</Button>}
          </Card>
        )}

        {step === 'photo' && (
          <Card className="space-y-3">
            <h2 className="font-semibold">Foto diri</h2>
            <SelfieCamera onPhoto={(blob) => { setPhoto(blob); setStep('confirm'); }} onError={setError} />
          </Card>
        )}

        {step === 'confirm' && located && (
          <Card className="space-y-3">
            <h2 className="font-semibold">Periksa lalu kirim</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photoUrl && <img src={photoUrl} alt="Foto absen" className="w-full rounded-lg" />}
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Jenis</dt><dd>{KIND_LABELS[kind]}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Cabang</dt><dd>{located.branchName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Jam</dt><dd>Jam server saat dikirim</dd></div>
            </dl>
            <Button block className="min-h-12" loading={busy} onClick={() => void send()}>Kirim</Button>
            <Button block variant="secondary" disabled={busy} onClick={() => { setPhoto(null); setStep('photo'); }}>Foto ulang</Button>
          </Card>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => {
            setError(null);
            if (step === 'confirm') { setPhoto(null); setStep('photo'); } else if (step === 'photo') setStep('locate'); else reset();
          }}>Kembali</Button>
          <Button variant="ghost" disabled={busy} onClick={() => { setError(null); reset(); }}>Ulangi dari awal</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      {message && <Alert tone="ok">{message}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <Card className="space-y-2">
        <p className="font-semibold">{branchName}</p>
        <p className="text-sm text-ink-muted">{shiftName ? `${shiftName}${hours ? ` · ${hours}` : ''}` : 'Shift belum ditentukan'}</p>
        <p className="text-sm"><Badge tone={state.status === 'NOT_IN' || state.status === 'IN' || state.status === 'OUT' ? 'info' : 'warn'}>{STATUS_TEXT(state, times, breakUntil)}</Badge></p>
        {aloneNoBreak && <p className="text-sm text-ink-muted">Hari ini tidak istirahat karena sendiri.</p>}
      </Card>
      {state.buttons.map((button) => (
        button === 'BREAK' ? (
          <Button key={button} block variant="secondary" className="min-h-12" loading={busy} onClick={() => void takeBreak()}>Istirahat</Button>
        ) : (
          <div key={button}>
            <Button block className="min-h-12" disabled={busy || (button === 'OUT' && state.outLocked)} onClick={() => begin(button)}>{KIND_LABELS[button]}</Button>
            {button === 'OUT' && state.outLocked && <p className="mt-1 text-center text-sm text-ink-muted">Bisa mulai {state.opensAt}</p>}
          </div>
        )
      ))}
    </div>
  );
}
