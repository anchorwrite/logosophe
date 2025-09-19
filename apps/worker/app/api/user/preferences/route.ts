import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';


// GET /api/user/preferences - Get user preferences
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get user preferences
    const preferences = await db.prepare(
      'SELECT Theme, Language, CurrentProvider FROM Preferences WHERE Email = ?'
    ).bind(session.user.email).first();

    if (!preferences) {
      // Return default preferences if none exist
      return NextResponse.json({ 
        theme: 'light',
        language: 'en',
        isPersistent: true,
        email: session.user.email,
        provider: null
      });
    }

    return NextResponse.json({ 
      theme: preferences.Theme,
      language: preferences.Language || 'en',
      isPersistent: true,
      email: session.user.email,
      provider: preferences.CurrentProvider
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/user/preferences - Update user preferences
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    const { theme, language } = await request.json() as { 
      theme: 'light' | 'dark';
      language?: 'en' | 'de' | 'es' | 'fr' | 'nl';
    };

    if (!theme || !['light', 'dark'].includes(theme)) {
      return NextResponse.json({ error: 'Invalid theme value' }, { status: 400 });
    }

    if (language && !['en', 'de', 'es', 'fr', 'nl'].includes(language)) {
      return NextResponse.json({ error: 'Invalid language value' }, { status: 400 });
    }

    // Check if preferences exist
    const existingPreferences = await db.prepare(
      'SELECT 1 FROM Preferences WHERE Email = ?'
    ).bind(session.user.email).first();

    if (existingPreferences) {
      // Update existing preferences
      const updateQuery = language 
        ? `UPDATE Preferences SET Theme = ?, Language = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE Email = ?`
        : `UPDATE Preferences SET Theme = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE Email = ?`;
      
      const bindParams = language 
        ? [theme, language, session.user.email]
        : [theme, session.user.email];
      
      await db.prepare(updateQuery).bind(...bindParams).run();
    } else {
      // Create new preferences
      const insertQuery = language
        ? `INSERT INTO Preferences (Email, Theme, Language, CreatedAt, UpdatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        : `INSERT INTO Preferences (Email, Theme, CreatedAt, UpdatedAt) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
      
      const bindParams = language
        ? [session.user.email, theme, language]
        : [session.user.email, theme];
      
      await db.prepare(insertQuery).bind(...bindParams).run();
    }

    return NextResponse.json({ 
      theme,
      language: language || 'en',
      isPersistent: true 
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 