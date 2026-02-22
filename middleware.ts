import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Skip middleware for assets, static files, and API routes
    if (
        pathname.startsWith('/_next') ||
        pathname.includes('/api/') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // 2. Fast check: Is the system initialized?
    // We call the internal status API
    try {
        const origin = request.nextUrl.origin;
        const statusRes = await fetch(`${origin}/api/setup/status`, {
            cache: 'no-store'
        });

        if (statusRes.ok) {
            const { initialized } = await statusRes.json();

            // If system not initialized and NOT on setup page, redirect to setup
            if (initialized === false && pathname !== '/setup') {
                return NextResponse.redirect(new URL('/setup', request.url));
            }

            // If system IS initialized and user tries to access setup, redirect to login
            if (initialized === true && pathname === '/setup') {
                return NextResponse.redirect(new URL('/login', request.url));
            }
        }
    } catch (error) {
        console.error("Middleware setup check error:", error);
    }

    return NextResponse.next();
}

// See "Matching Paths" below to learn more
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
