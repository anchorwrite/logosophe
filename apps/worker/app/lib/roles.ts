/** Roles that can appear in the Credentials table (password-authenticated system accounts) */
export type CredentialsRole = 'admin' | 'tenant';

/** All roles that exist anywhere in the system */
export type UserRole =
  | CredentialsRole
  | 'editor'
  | 'author'
  | 'subscriber'
  | 'agent'
  | 'reviewer'
  | 'user'
  | 'publisher';
