import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email } = await params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin or tenant admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = !isAdmin && await db.prepare(
      'SELECT Role FROM Credentials WHERE Email = ?'
    ).bind(session.user.email).first() as { Role: string } | null;

    if (!isAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const emailDecoded = decodeURIComponent(email);

    // Check for published content
    const publishedContent = await db.prepare(`
      SELECT 
        pc.Id,
        pc.MediaId,
        pc.PublisherId,
        pc.PublishedAt,
        pc.ApprovalStatus,
        mf.FileName,
        mf.ContentType,
        mf.MediaType
      FROM PublishedContent pc
      LEFT JOIN MediaFiles mf ON pc.MediaId = mf.Id
      WHERE pc.PublisherId = ?
      ORDER BY pc.PublishedAt DESC
    `).bind(emailDecoded).all();

    return NextResponse.json({
      hasPublishedContent: publishedContent.results.length > 0,
      publishedContent: publishedContent.results
    });

  } catch (error) {
    console.error('Error checking published content:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 