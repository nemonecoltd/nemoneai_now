import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// "오늘"을 end_date(YYYY-MM-DD, 한국시간 기준으로 등록된 날짜)와 비교할 때 쓴다.
// new Date().toISOString()은 항상 UTC로 변환한 뒤 날짜를 자르기 때문에, 한국시간 자정~오전9시
// 사이에는 아직 "어제"로 계산돼 이미 끝난 장소가 "운영중"으로 보이는 버그가 있었다
// (2026-10-11, place_id=12107이 종료 다음날 오전까지 hot_rank 1위로 남아있던 걸 사용자가 발견 —
// 백엔드 DB 세션 타임존도 같은 이유로 UTC여서 동시에 고쳐짐, now_back/database.py 참고).
// Intl.DateTimeFormat으로 명시적으로 Asia/Seoul 날짜를 뽑는다.
export function getTodayKST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}
