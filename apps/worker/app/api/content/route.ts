import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';


export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'all';
    const form = searchParams.get('form') || 'all';
    const genre = searchParams.get('genre') || 'all';
    const language = searchParams.get('language') || 'all';
    const sortBy = searchParams.get('sortBy') || 'newest';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '12');
    const offset = (page - 1) * pageSize;

    // Get user session for protection settings
    const session = await auth();
    const userEmail = session?.user?.email;
    const isSubscriber = userEmail ? await checkIfSubscriber(userEmail, db) : false;

    // Get total count for published content
    let countSql = `
      SELECT COUNT(*) as total
      FROM PublishedContent pc
      INNER JOIN MediaFiles m ON pc.MediaId = m.Id
      LEFT JOIN Form f ON pc.FormId = f.Id
      LEFT JOIN Genre g ON pc.GenreId = g.Id
      WHERE m.IsDeleted = 0
    `;
    const countParams: any[] = [];

    if (search) {
      countSql += ' AND m.FileName LIKE ?';
      countParams.push(`%${search}%`);
    }
    if (type !== 'all') {
      countSql += ' AND m.MediaType = ?';
      countParams.push(type);
    }
    if (form !== 'all') {
      countSql += ' AND pc.FormId = ?';
      countParams.push(form);
    }
    if (genre !== 'all') {
      countSql += ' AND pc.GenreId = ?';
      countParams.push(genre);
    }
    if (language !== 'all') {
      countSql += ' AND COALESCE(m.Language, "en") = ?';
      countParams.push(language);
    }

    const countResult = await db.prepare(countSql).bind(...countParams).first();
    const total = Number(countResult?.total ?? 0);

    // Get paginated results for published content
    let sql = `
      SELECT 
        pc.Id,
        pc.MediaId,
        m.FileName,
        m.FileSize,
        m.ContentType,
        m.MediaType,
        m.UploadDate,
        m.Description,
        m.Duration,
        m.Width,
        m.Height,
        COALESCE(m.Language, 'en') as Language,
        pc.FormId,
        pc.GenreId,
        f.Name as FormName,
        g.Name as GenreName,
        pc.PublisherId,
        pc.PublishedAt,
        pc.PublishingSettings,
        pc.AccessToken
      FROM PublishedContent pc
      INNER JOIN MediaFiles m ON pc.MediaId = m.Id
      LEFT JOIN Form f ON pc.FormId = f.Id
      LEFT JOIN Genre g ON pc.GenreId = g.Id
      WHERE m.IsDeleted = 0
    `;
    const params: any[] = [];

    if (search) {
      sql += ' AND m.FileName LIKE ?';
      params.push(`%${search}%`);
    }
    if (type !== 'all') {
      sql += ' AND m.MediaType = ?';
      params.push(type);
    }
    if (form !== 'all') {
      sql += ' AND pc.FormId = ?';
      params.push(form);
    }
    if (genre !== 'all') {
      sql += ' AND pc.GenreId = ?';
      params.push(genre);
    }
    if (language !== 'all') {
      sql += ' AND COALESCE(m.Language, "en") = ?';
      params.push(language);
    }

    switch (sortBy) {
      case 'oldest':
        sql += ' ORDER BY pc.PublishedAt ASC';
        break;
      case 'name':
        sql += ' ORDER BY m.FileName ASC';
        break;
      case 'size':
        sql += ' ORDER BY m.FileSize DESC';
        break;
      default:
        sql += ' ORDER BY pc.PublishedAt DESC';
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const stmt = db.prepare(sql).bind(...params);
    const result = await stmt.all();

    // Note: View logging removed - views should only be logged when viewing specific content, not when browsing the listing

    const totalPages = Math.ceil(total / pageSize);

    return new Response(JSON.stringify({
      content: result.results,
      pagination: {
        total,
        page,
        pageSize,
        totalPages
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching published content:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function checkIfSubscriber(email: string, db: any): Promise<boolean> {
  try {
    const result = await db.prepare(`
              SELECT COUNT(*) as count FROM Subscribers WHERE Email = ? AND Active = TRUE
    `).bind(email).first();
    
    return Number(result?.count ?? 0) > 0;
  } catch (error) {
    console.error('Error checking subscriber status:', error);
    return false;
  }
}

 