import bcrypt from 'bcryptjs';
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type UserRole = 'admin' | 'tenant' | 'subscriber';

export type User = {
  email: string;
  password: string; 
  role: UserRole;
};

export interface Env {
  DB: any;
}

async function hashPassword(password: string): Promise<string> {
  'use server'
  const saltRounds = 10;
  const salt = await bcrypt.genSaltSync(saltRounds);
  const hash = await bcrypt.hashSync(password, salt);
  return hash;
}
  
async function comparePassword(password: string, hash: string): Promise<boolean> {
  'use server'
  const match = await bcrypt.compareSync(password, hash);
  return match;
}

export async function validateCredentials(email: string, password: string): Promise<{ success: boolean, user?: User, message?: string }> {
  'use server'

  let db;
  try {
    const context = await getCloudflareContext({async: true});
    db = context.env.DB;
  } catch (error) {
    console.error('Failed to get Cloudflare context for credential validation:', error);
    return {
      success: false,
      message: "DatabaseError",
    }
  }

  if (!db) {
    console.error('Database not available for credential validation');
    return {
      success: false,
      message: "DatabaseError",
    }
  }

  try {
    console.log('Attempting to validate credentials for:', email);
    
    const { results } = await db.prepare(
      "SELECT * FROM Credentials WHERE Email = ?"
    )
      .bind(email)
      .all();

    console.log('Query results:', results);

    if (results.length === 0) {
      return {
        success: false,
        message: "UserNotFound",
      }
    }
    
    const user: User = {
      email: results[0].Email as string,
      password: results[0].Password as string, 
      role: results[0].Role as UserRole,
    };

    console.log('User found:', { email: user.email, role: user.role });

    if (!user.password) {
      return {
        success: false,
        message: "Password is required.",
      }
    }

    const passwordMatches = await comparePassword(password, user.password as string);
    console.log('Password match result:', passwordMatches);

    if (!passwordMatches) {
      return {
        success: false,
        message: "IncorrectPassword",
      }
    }
    return {
      success: true,
      user: user,
    }

  } catch (error: any) {
    console.error('Error during credential validation:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return {
      success: false,
      message: "AuthenticationError",
    }
  }
} 