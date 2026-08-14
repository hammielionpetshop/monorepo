import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID as uuidv4 } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const filename = `${uuidv4()}-${file.name.replace(/\s+/g, '-')}`;
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
  } catch (error: any) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
