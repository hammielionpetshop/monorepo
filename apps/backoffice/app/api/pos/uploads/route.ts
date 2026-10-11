import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID as uuidv4 } from 'crypto';
import { verifyAccessToken } from '@/lib/auth';
import { UPLOAD_IMAGE_EXTENSIONS, UPLOAD_MAX_BYTES } from '@/lib/proof-photo';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const payload = token ? await verifyAccessToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Berkas foto tidak ditemukan' }, { status: 400 });
    }

    // Berkas disajikan Caddy langsung dari volume, jadi hanya gambar yang boleh masuk dan
    // nama berkasnya dibuat server (ekstensi dari jenis gambar, bukan dari nama kiriman).
    const extension = UPLOAD_IMAGE_EXTENSIONS[file.type];
    if (!extension) {
      return NextResponse.json({ error: 'Hanya berkas foto (JPG, PNG, WEBP) yang bisa diunggah' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > UPLOAD_MAX_BYTES) {
      return NextResponse.json({ error: 'Ukuran foto terlalu besar (maksimal 15 MB)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `${uuidv4()}.${extension}`;
    // UPLOAD_DIR menunjuk volume Docker di VPS. Tanpa itu berkasnya ikut mati
    // tiap container di-restart, dan di build standalone `process.cwd()` bukan lagi
    // folder app melainkan /app/apps/backoffice. Berkasnya disajikan Caddy dari
    // volume yang sama di /uploads/*, bukan lewat public/ Next.
    const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'public/uploads');

    // Ensure directory exists (just in case)
    await mkdir(uploadDir, { recursive: true });

    const path = join(uploadDir, filename);
    await writeFile(path, buffer);

    const fileUrl = `/uploads/${filename}`;

    return NextResponse.json({ url: fileUrl });
  } catch (error: unknown) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Gagal mengunggah foto' }, { status: 500 });
  }
}
