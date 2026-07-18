import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  // 요청 host가 nemoneai.com(하위 포함)일 때만 서브도메인 SSO 공유용 .nemoneai.com 쿠키 도메인 사용.
  // Tailscale IP 등 다른 host로 들어온 요청에 domain=.nemoneai.com 쿠키를 내리면 브라우저가
  // 거부해(호스트와 무관한 도메인) 세션이 저장되지 않아 로그인 무한루프가 생김.
  const host = headers().get('host') || ''
  const isProdDomain = host.endsWith('nemoneai.com')

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options, ...(isProdDomain ? { domain: '.nemoneai.com', secure: true } : {}) })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options, ...(isProdDomain ? { domain: '.nemoneai.com' } : {}) })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
