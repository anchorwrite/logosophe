// Utility to check if a path should be internationalized (same logic as middleware)
export function shouldInternationalizePath(pathname: string): boolean {
  // Skip locale redirection for non-translated routes (same as middleware)
  if (pathname.startsWith('/dashboard') || 
      pathname.startsWith('/signin') || 
      pathname.startsWith('/signout') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/share/')) {
    return false;
  }
  
  return true;
} 