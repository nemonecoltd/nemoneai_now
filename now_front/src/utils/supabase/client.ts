import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // now.nemoneai.com(HTTPS)에서만 서브도메인 간 SSO 공유를 위해 .nemoneai.com 쿠키 도메인 사용.
  // 그 외(Tailscale IP 등 로컬 원격 접속)는 도메인이 다르고 HTTP라 저 옵션이면 쿠키 저장 자체가
  // 불가능해 로그인 무한루프가 나므로, 그때는 옵션 없이 기본(현재 접속 origin 기준) 쿠키를 씀.
  const isProdDomain = typeof window !== 'undefined' && window.location.hostname.endsWith('nemoneai.com')
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    isProdDomain
      ? {
          cookieOptions: {
            domain: '.nemoneai.com',
            secure: true,
            sameSite: 'lax',
          },
        }
      : {}
  )
}
