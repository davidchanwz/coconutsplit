import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SupabaseService } from './lib/supabase';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and API routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Get group_id from URL hash
  const hash = request.nextUrl.hash.slice(1); // Remove the # symbol
  const params = hash.split('&').reduce((acc, param) => {
    const [key, value] = param.split('=');
    if (key && value) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {} as Record<string, string>);

  const groupId = params.group_id;
  
  // If no group_id is provided and not on add_expense page, redirect to error
  if (!groupId && !pathname.startsWith('/add_expense')) {
    return NextResponse.redirect(new URL('/error?message=Group ID is required', request.url));
  }

  // If group_id is provided, validate it exists
  if (groupId) {
    try {
      const group = await SupabaseService.getGroup(groupId);
      if (!group) {
        return NextResponse.redirect(new URL('/error?message=Invalid Group ID', request.url));
      }
    } catch (error) {
      return NextResponse.redirect(new URL('/error?message=Error validating group', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 