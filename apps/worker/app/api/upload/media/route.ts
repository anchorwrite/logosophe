import { NextResponse } from 'next/server';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from '@/auth';
import { FileType, AccessLevel } from '@/types/media';


export const POST = async (request: Request) => {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;
    const uploadedBy = formData.get('uploadedBy') as string;
    const owner = formData.get('owner') as string;
    const fileType = formData.get('fileType') as FileType;
    const accessLevel = formData.get('accessLevel') as AccessLevel;
    const accessValue = formData.get('accessValue') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!uploadedBy) {
      return NextResponse.json({ error: 'UploadedBy is required' }, { status: 400 });
    }

    if (!owner) {
      return NextResponse.json({ error: 'Owner is required' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const r2Key = `${fileType}/${Date.now()}-${file.name}`;
    const uploadDate = new Date().toISOString();
    const fileSize = buffer.byteLength;
    
    // Get environment context
    const ctx = await getCloudflareContext({async: true});
    const env = ctx.env;

    if (!env.DB || !env.MEDIA_BUCKET) {
      throw new Error('Required environment variables are not configured');
    }

    // Upload to R2 first
    await env.MEDIA_BUCKET.put(r2Key, buffer, {
      httpMetadata: {
        contentType: file.type
      },
      customMetadata: {
        originalName: file.name,
        uploadedAt: uploadDate,
        uploadedBy,
        owner,
        fileType,
        accessLevel,
        accessValue: accessValue || ''
      }
    });

    // Insert record into D1
    const stmt = env.DB.prepare(`
      INSERT INTO MediaCatalog (
        FileName, R2Key, UploadDate, UploadedBy, Description,
        Owner, FileType, FileExtension, AccessLevel, AccessValue,
        FileSize, ContentType, CreatedAt, UpdatedAt, IsActive
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 1)
    `);

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    await stmt.bind(
      file.name,
      r2Key,
      uploadDate,
      uploadedBy,
      description || null,
      owner,
      fileType,
      fileExtension,
      accessLevel,
      accessValue || null,
      fileSize,
      file.type
    ).run();

    // Get the inserted record ID
    const { results } = await env.DB
      .prepare('SELECT last_insert_rowid() as id')
      .all();
    const insertedId = results[0].id;

    // Get the inserted record
    const { results: mediaFile } = await env.DB
      .prepare('SELECT * FROM MediaCatalog WHERE Id = ?')
      .bind(insertedId)
      .all();

    return NextResponse.json({ 
      success: true,
      file: mediaFile[0]
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return NextResponse.json({ 
      error: errorMessage,
      success: false 
    }, { status: 500 });
  }
}; 