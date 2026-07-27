import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import BrandTagline from '@/components/BrandTagline';
import BottomNav from '@/components/BottomNav';
import HeaderControls from '@/components/HeaderControls';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';
const BRAND_TITLE: Record<string, string> = { ko: '지금 여기', en: 'NOW HERE', zh: 'NOW HERE' };

interface Step {
  place_id: number;
  place_name: string;
  activity: string;
  duration: number;
  date_range?: string | null;
}

interface Course {
  id: number;
  title: string;
  description: string;
  steps: Step[];
  region: string;
  scope: 'timed' | 'free';
  is_public: boolean;
  user_name?: string;
  created_at: string;
}

interface EnrichedStep extends Step {
  image_url?: string;
  location?: string;
  active: boolean;
}

async function getCourse(id: string): Promise<Course | null> {
  try {
    // 인증 헤더 없이 조회 — 비공개 코스는 백엔드가 404로 응답(존재 자체를 숨김), 발행된 코스만 SSR 대상
    const res = await fetch(`${BACKEND}/courses/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    return { ...data, steps: Array.isArray(data.steps) ? data.steps : JSON.parse(data.steps || '[]') };
  } catch {
    return null;
  }
}

async function enrichSteps(steps: Step[]): Promise<EnrichedStep[]> {
  const results = await Promise.all(
    steps.map(async (step) => {
      try {
        const res = await fetch(`${BACKEND}/places/${step.place_id}`, { next: { revalidate: 300 } });
        if (!res.ok) return { ...step, active: false };
        const place = await res.json();
        return { ...step, image_url: place.image_url, location: place.location, active: true };
      } catch {
        return { ...step, active: false };
      }
    })
  );
  return results;
}

function formatStepTimes(steps: Step[]): string[] {
  let cursor = 14 * 60;
  return steps.map((s) => {
    const h = Math.floor(cursor / 60) % 24;
    const m = cursor % 60;
    cursor += s.duration || 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });
}

function cleanDescription(raw: string): string {
  const flat = (raw || '').replace(/\s+/g, ' ').trim();
  return flat.length <= 160 ? flat : flat.slice(0, 160).trim() + '...';
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const course = await getCourse(id);
  const canonical = `https://now.nemoneai.com/course/${id}`;

  if (!course) {
    return { title: '코스를 찾을 수 없습니다', alternates: { canonical }, robots: { index: false, follow: true } };
  }

  const title = `${course.title} | 지금여기 코스`;
  const description = cleanDescription(course.description) || `${course.region}에서 즐기는 ${course.scope === 'timed' ? '3시간' : ''} 코스 — ${course.steps.length}곳`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'article', locale: 'ko_KR' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function CourseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { id } = await params;
  const { lang: rawLang } = await searchParams;
  const lang = rawLang === 'en' || rawLang === 'zh' ? rawLang : 'ko';
  const course = await getCourse(id);

  if (!course) {
    return (
      <div className="min-h-screen bg-zinc-50 max-w-md mx-auto flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold text-zinc-800">코스를 찾을 수 없습니다</p>
        <p className="text-sm text-zinc-400">비공개 코스이거나 삭제되었을 수 있어요.</p>
        <Link href="/course" className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm">코스 홈으로</Link>
      </div>
    );
  }

  const steps = await enrichSteps(course.steps);
  const times = course.scope === 'timed' ? formatStepTimes(course.steps) : [];

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl border-x border-zinc-200">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/course" className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all">
              <ChevronLeft size={20} strokeWidth={2.5} />
            </Link>
            <h1 className="text-lg font-black font-display tracking-tight text-zinc-900 whitespace-nowrap flex-shrink-0">
              <Link href="/" className="no-underline text-inherit">{BRAND_TITLE[lang]} <span className="text-emerald-500">.</span></Link>
            </h1>
          </div>
          <HeaderControls />
        </div>
        <h2 className="text-sm font-bold text-zinc-600 truncate mb-1">{course.title}</h2>
        <BrandTagline lang={lang} />
      </header>

      <main className="px-6 pt-6 pb-28 space-y-6">
        <div className="space-y-2">
          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase">
            {course.scope === 'timed' ? '3시간코스' : '자유코스'} · {course.region}
          </span>
          {course.description && <p className="text-sm text-zinc-500 leading-relaxed">{course.description}</p>}
        </div>

        <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-100">
          {steps.map((step, idx) => (
            <div key={`${step.place_id}-${idx}`} className="relative pl-10">
              <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white border-4 border-emerald-500 z-10" />
              <div className="space-y-2">
                {course.scope === 'timed' && (
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-400 font-mono">
                    <Clock size={11} /> {times[idx]} · {step.duration}분
                  </div>
                )}
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden flex gap-3 p-4">
                  {step.image_url && (
                    <img src={step.image_url} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" alt={step.place_name} referrerPolicy="no-referrer" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-zinc-900 text-sm truncate">{step.place_name}</h4>
                      {!step.active && (
                        <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-zinc-100 text-zinc-400 border-zinc-200">종료됨</span>
                      )}
                    </div>
                    {step.activity && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{step.activity}</p>}
                    {step.active && (
                      <Link href={`/posts/${step.place_id}`} className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 mt-1.5">
                        자세히 보기 <ChevronRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Link href="/course" className="block text-center mt-6 px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm">
          나만의 코스 만들러 가기
        </Link>
      </main>

      <BottomNav region={course.region} lang={lang} />
    </div>
  );
}
