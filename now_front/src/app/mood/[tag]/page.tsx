import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

// 백엔드 mood_tags.py의 MOOD_TAGS와 같은 값 — 여기서 한 번 걸러야 임의 문자열로
// 무한한 URL이 생기지 않는다(SEO상 얇은 페이지 양산 방지).
const MOOD_TAGS = [
  '감성/무드있는',
  '인생샷/포토스팟',
  '아늑한/조용한',
  '활기찬/떠들썩한',
  '데이트하기좋은',
  '아이랑가기좋은',
  '혼자가기좋은',
  '실내중심',
  '야외/테라스',
];

interface Place {
  id: number;
  title: string;
  title_en?: string;
  title_zh?: string;
  title_ja?: string;
  image_url?: string;
  location?: string;
  date_range?: string;
  region?: string;
  mood_tags?: string[] | null;
}

async function getPlaces(tag: string): Promise<Place[]> {
  try {
    const res = await fetch(
      `${BACKEND}/places?mood=${encodeURIComponent(tag)}&category=popup&limit=100`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  if (!MOOD_TAGS.includes(decoded)) return { title: '무드' };

  return {
    title: `${decoded} 팝업스토어 | NEMONE PACE`,
    description: `'${decoded}' 분위기의 팝업스토어를 모았습니다. 지금 진행 중인 곳만 보여드려요.`,
    alternates: { canonical: `https://now.nemoneai.com/mood/${encodeURIComponent(decoded)}` },
  };
}

export default async function MoodPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { tag } = await params;
  const { lang = 'ko' } = await searchParams;
  const decoded = decodeURIComponent(tag);
  if (!MOOD_TAGS.includes(decoded)) notFound();

  const places = await getPlaces(decoded);

  const titleOf = (p: Place) =>
    (lang === 'en' && p.title_en) ? p.title_en
    : (lang === 'zh' && p.title_zh) ? p.title_zh
    : (lang === 'ja' && p.title_ja) ? p.title_ja
    : p.title;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-3xl mx-auto px-6 py-8 pb-28">
        <Link
          href={`/?lang=${lang}`}
          className="inline-block text-xs font-bold text-zinc-400 hover:text-pace-600 no-underline mb-4"
        >
          ← 홈으로
        </Link>

        <h1 className="text-2xl font-black text-zinc-900 tracking-tight mb-1">{decoded}</h1>
        <p className="text-xs text-zinc-500 mb-6">
          이 분위기의 팝업 {places.length}곳 · 진행 중인 곳만
        </p>

        {/* 다른 무드로 바로 건너뛸 수 있게 — 한 무드가 비어도 막다른 길이 되지 않는다 */}
        <div className="flex flex-wrap gap-2 mb-8">
          {MOOD_TAGS.filter((m) => m !== decoded).map((m) => (
            <Link
              key={m}
              href={`/mood/${encodeURIComponent(m)}?lang=${lang}`}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white text-zinc-500 border border-zinc-200 hover:border-pace-400 hover:text-pace-600 transition-colors no-underline"
            >
              {m}
            </Link>
          ))}
        </div>

        {places.length === 0 ? (
          <p className="text-sm text-zinc-500 py-12 text-center">
            아직 이 분위기로 분류된 팝업이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {places.map((p) => (
              <Link
                key={p.id}
                href={`/posts/${p.id}?lang=${lang}`}
                className="block bg-white rounded-2xl border border-zinc-100 overflow-hidden hover:border-pace-300 hover:shadow-md transition-all no-underline"
              >
                <div className="relative aspect-[4/3] bg-zinc-100">
                  {p.image_url && (
                    // 외부 이미지 도메인이 여러 곳이라 next/image 대신 일반 img 사용
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-3">
                  {p.region && (
                    <div className="text-[10px] font-bold text-pace-500 mb-0.5">{p.region}</div>
                  )}
                  <div className="text-xs font-bold text-zinc-900 leading-snug line-clamp-2">
                    {titleOf(p)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
