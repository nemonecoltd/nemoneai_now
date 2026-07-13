import { NextRequest, NextResponse } from 'next/server';

// 홈('/')은 region/tab/lang 등 쿼리스트링으로 상태를 바꾸는 클라이언트 컴포넌트라
// 쿼리 조합마다 서버가 보내는 title/description이 전부 동일함 — 이게 네이버 서치어드바이저의
// "title 중복"/"description 중복" 지적 원인. 쿼리가 붙은 변형은 색인 대상에서 빼고
// 쿼리 없는 순수 '/'만 정식 색인 페이지로 남긴다.
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (request.nextUrl.pathname === '/' && request.nextUrl.searchParams.size > 0) {
    response.headers.set('X-Robots-Tag', 'noindex, follow');
  }
  return response;
}

export const config = {
  matcher: '/',
};
