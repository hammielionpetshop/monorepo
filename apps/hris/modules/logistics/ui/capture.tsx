'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const CAMERA_ERROR = 'Kamera tidak bisa dibuka. Izinkan kamera untuk HRIS di pengaturan browser, lalu coba lagi.';

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Foto langsung dari kamera (bukan galeri, KEH-97 / LOG-100). Bawaan kamera belakang (foto awak di mobil, nota);
 * bisa dibalik ke kamera depan.
 */
export function LiveCamera({ onPhoto, onError, label = 'Ambil foto' }: { onPhoto: (photo: Blob) => void; onError: (message: string) => void; label?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    setReady(false);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
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
  }, [facing]);
  function capture() {
    const element = video.current!;
    const scale = Math.min(1, 1280 / Math.max(element.videoWidth, element.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(element.videoWidth * scale);
    canvas.height = Math.round(element.videoHeight * scale);
    canvas.getContext('2d')!.drawImage(element, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => (blob ? onPhoto(blob) : onError('Foto gagal diambil. Coba lagi.')), 'image/jpeg', 0.75);
  }
  return (
    <div className="space-y-2">
      <video ref={video} playsInline muted className={`aspect-[4/3] w-full rounded-lg bg-black object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
      <div className="flex gap-2">
        <Button block disabled={!ready} onClick={capture} className="min-h-12">{label}</Button>
        <Button variant="secondary" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} className="min-h-12">Balik kamera</Button>
      </div>
    </div>
  );
}

export function readLocation(): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

/** Kirim aksi berfoto ke /api/logistics/upload (FormData + CSRF lewat postJson). */
export function photoForm(fields: Record<string, string | number | null | undefined>, photo: Blob | null) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value != null) form.append(key, String(value));
  if (photo) form.append('photo', photo, 'foto.jpg');
  return form;
}
