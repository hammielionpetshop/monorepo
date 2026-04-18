import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

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
    const uploadDir = join(process.cwd(), 'public/uploads');
    
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
