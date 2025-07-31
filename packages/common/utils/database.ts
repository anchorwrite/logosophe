export function getDatabase() {
  return process.env.DB
}

export async function queryDatabase(sql: string, params: any[] = []) {
  const db = getDatabase()
  return await db.prepare(sql).bind(...params).all()
}

export async function queryDatabaseFirst(sql: string, params: any[] = []) {
  const db = getDatabase()
  return await db.prepare(sql).bind(...params).first()
} 