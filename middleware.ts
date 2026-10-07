import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 1. Supabase Client für Middleware initialisieren
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 2. Auth-Status (User) abfragen
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Öffentliche Pfade (Hauptseite Linktree '/', Login & API-Routen)
  const isPublicRoute = pathname === '/' || pathname === '/login' || pathname.startsWith('/api')

  // Regel 1: Nicht eingeloggt -> Zugriff auf geschützte Pfade (/shop, /admin) blockieren
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Regel 2: Schutz für den Admin-Bereich (/admin)
  if (user && pathname.startsWith('/admin')) {
    const { data: customer } = await supabase
      .from('customers')
      .select('is_admin')
      .eq('email', user.email?.trim().toLowerCase())
      .single()

    // Falls der Kunde nicht existiert oder is_admin nicht true ist -> Umleitung zum Shop
    if (!customer || !customer.is_admin) {
      return NextResponse.redirect(new URL('/shop', request.url))
    }
  }

  // Regel 3: Bereits eingeloggt & besucht '/login' -> Umleitung zum Shop
  // (Hauptseite '/' bleibt auch für Eingeloggte erreichbar, um andere B2B-Links zu wählen)
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/shop', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}