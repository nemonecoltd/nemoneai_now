import Link from 'next/link';
import { Metadata } from 'next';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

// 루트 레이아웃의 robots:{index:true,follow:true}가 그대로 상속되면 Next.js가 404에
// 자동으로 붙이는 noindex 태그와 겹쳐 <meta name="robots"> 두 개가 모순되게 찍히던 문제
// (구글서치콘솔이 이 페이지들을 "noindex 태그에 의해 제외"로 보고) — 명시적으로 덮어씀.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface SuggestedPlace {
  id: number;
  title: string;
  image_url?: string;
  location?: string;
  region?: string;
  date_range?: string;
  end_date?: string;
}

async function getSuggestions(): Promise<SuggestedPlace[]> {
  try {
    const res = await fetch(`${BACKEND}/places/popular?limit=6`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : []).filter((p: SuggestedPlace) => p.image_url);
  } catch {
    return [];
  }
}

export default async function PlaceNotFound() {
  const suggestions = await getSuggestions();

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto px-6 py-12 flex flex-col gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-3xl">🏁</div>
        <div className="space-y-1">
          <p className="text-lg font-bold text-zinc-800">운영이 종료됐습니다</p>
          <p className="text-sm text-zinc-400">해당 팝업·행사는 운영 기간이 지나 더 이상 조회할 수 없어요.</p>
        </div>
        <Link href="/" className="px-6 py-2.5 bg-zinc-900 text-white rounded-2xl font-bold text-xs">
          홈으로 돌아가기
        </Link>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">지금 가볼 만한 핫플</p>
          <div className="flex flex-col gap-3">
            {suggestions.map((s) => (
              <Link
                key={s.id}
                href={`/posts/${s.id}${s.region ? `?region=${encodeURIComponent(s.region)}` : ''}`}
                className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm text-left hover:shadow-md transition-shadow no-underline"
              >
                <img
                  src={s.image_url}
                  alt={s.title}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{s.title}</p>
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">{s.location}</p>
                  {s.date_range && (
                    <p className="text-xs text-pace-600 font-bold mt-1">{s.date_range}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
