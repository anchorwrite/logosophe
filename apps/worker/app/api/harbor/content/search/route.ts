import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Database } from '@cloudflare/workers-types';

export async function GET(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    // Public endpoint: bound the page size
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    // Search published content by title, description, form, or genre
    let sql = `
      SELECT 
        pc.Id,
        pc.MediaId,
        pc.PublisherId,
        pc.PublishedAt,
        pc.AccessToken,
        pc.FormId,
        pc.GenreId,
        pc.Language,
        mf.FileName as Title,
        mf.Description,
        mf.MediaType,
        mf.FileSize,
        f.Name as FormName,
        g.Name as GenreName
      FROM PublishedContent pc
      INNER JOIN MediaFiles mf ON pc.MediaId = mf.Id
      LEFT JOIN Form f ON pc.FormId = f.Id
      LEFT JOIN Genre g ON pc.GenreId = g.Id
      WHERE pc.ApprovalStatus = 'approved'
    `;

    const params: any[] = [];
    
    if (query.trim()) {
      sql += ` AND (
        mf.FileName LIKE ? OR 
        mf.Description LIKE ? OR 
        f.Name LIKE ? OR
        g.Name LIKE ?
      )`;
      const searchTerm = `%${query.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    sql += ` ORDER BY pc.PublishedAt DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await db.prepare(sql).bind(...params).all();
    
    const content = result.results as any[];

    return Response.json({
      success: true,
      data: content.map(item => ({
        id: item.Id,
        mediaId: item.MediaId,
        title: item.Title,
        description: item.Description,
        mediaType: item.MediaType,
        fileSize: item.FileSize,
        language: item.Language,
        form: item.FormName,
        genre: item.GenreName,
        // Public endpoint: show a display name, never the publisher's email address
        publisher: {
          name: item.PublisherId.split('@')[0]
        },
        publishedAt: item.PublishedAt,
        accessToken: item.AccessToken
      }))
    });

  } catch (error) {
    console.error('Error searching published content:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
