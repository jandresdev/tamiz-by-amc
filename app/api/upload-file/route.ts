import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase.server';
import { createFileRecord, getSession, updateSession } from '@/lib/db';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, FILE_EXPIRY_DAYS } from '@/lib/constants';
import type { FilesJson, FileMetadata } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId') as string | null;
    const stepKey = formData.get('stepKey') as string | null;

    if (!file || !sessionId || !stepKey) {
      return NextResponse.json(
        { ok: false, error: 'Faltan campos requeridos (file, sessionId, stepKey)' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: 'Tipo de archivo no permitido. Use PDF, Word, Excel o imágenes.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: 'El archivo excede el límite de 10 MB.' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await getSession(sessionId);

    const supabase = await createClient();

    // Build a safe storage path: sessions/{sessionId}/{stepKey}/{timestamp}-{filename}
    const timestamp = Date.now();
    const safeFilename = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);
    const storagePath = `sessions/${sessionId}/${stepKey}/${timestamp}-${safeFilename}`;

    // Read file bytes
    const arrayBuffer = await file.arrayBuffer();

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('tamiz-files')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[upload-file] Storage error:', uploadError);
      return NextResponse.json(
        { ok: false, error: 'Error al subir el archivo: ' + uploadError.message },
        { status: 500 }
      );
    }

    // Create a signed URL valid for FILE_EXPIRY_DAYS days
    const expiresInSeconds = FILE_EXPIRY_DAYS * 24 * 60 * 60;
    const { data: signedData } = await supabase.storage
      .from('tamiz-files')
      .createSignedUrl(storagePath, expiresInSeconds);

    const fileUrl = signedData?.signedUrl || '';

    // Persist record in tamiz_files table
    await createFileRecord(
      sessionId,
      file.name,
      file.type,
      file.size,
      storagePath,
      FILE_EXPIRY_DAYS
    );

    // Update files_json in session record
    const currentFilesJson: FilesJson = (session.files_json as FilesJson) || {};
    const updatedFilesJson: FilesJson = {
      ...currentFilesJson,
      [stepKey]: {
        name: file.name,
        size: file.size,
        type: file.type,
        url: fileUrl,
        uploadedAt: new Date().toISOString(),
      } as FileMetadata,
    };

    await updateSession(sessionId, { files_json: updatedFilesJson });

    return NextResponse.json({
      ok: true,
      filePath: storagePath,
      fileUrl,
      fileName: file.name,
    });
  } catch (error) {
    console.error('[upload-file] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al procesar el archivo' },
      { status: 500 }
    );
  }
}
