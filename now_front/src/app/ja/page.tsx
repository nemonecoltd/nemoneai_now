import { redirect } from 'next/navigation';

// /ja 루트는 별도 홈이 없어 404가 나던 문제 — 앱 홈을 해당 언어로 연다(2026-10-04).
export default function Page() {
  redirect('/?lang=ja');
}
