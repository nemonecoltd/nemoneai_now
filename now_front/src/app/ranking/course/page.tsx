import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

export const revalidate = 3600;

interface CourseStep {
  time: string;
  place_id?: number;
  place_name: string;
  activity: string;
  duration: number;
}

interface Course {
  id: number;
  title: string;
  description: string;
  steps: CourseStep[];
  region: string;
  user_name: string;
  like_count: number;
  created_at: string;
}

async function getCourses(): Promise<Course[]> {
  try {
    const res = await fetch(`${BACKEND}/courses`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const courses = await getCourses();
  const top = courses.slice(0, 5).map(c => c.title).join(', ');
  const title = '이번 주 인기 AI 코스 랭킹 | 지금여기';
  const description = `성수·홍대·용산에서 유저들이 직접 만든 AI 3시간 코스 랭킹. ${top || '지금 인기 있는 코스를 확인해보세요.'}`;
  return {
    title,
    description,
    alternates: { canonical: 'https://now.nemoneai.com/ranking/course' },
    openGraph: { title, description, url: 'https://now.nemoneai.com/ranking/course', type: 'website' },
  };
}

export default async function CourseRankingPage() {
  const courses = await getCourses();

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-16 border-x border-zinc-200">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">AI 코스 랭킹</h1>
      </header>

      <main className="px-6 pt-6 space-y-4">
        <p className="text-xs text-zinc-400 leading-relaxed">
          성수·홍대·용산에서 유저들이 직접 만들고 저장한 3시간 AI 코스를 좋아요 순으로 보여드립니다.
        </p>

        {courses.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-20">아직 저장된 코스가 없습니다.</p>
        )}

        {courses.map((course, idx) => (
          <div key={course.id} className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0">
                {idx + 1}
              </span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{course.region}</span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 ml-auto">
                <Heart size={11} fill="currentColor" /> {course.like_count}
              </span>
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-base tracking-tight">{course.title}</h2>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{course.description}</p>
              <p className="text-[10px] text-zinc-400 mt-1">{course.user_name} 님이 만든 코스</p>
            </div>
            <ul className="space-y-1.5 pt-1 border-t border-zinc-50">
              {course.steps.map((step, i) => (
                <li key={i} className="flex items-center justify-between text-xs text-zinc-600">
                  <span>
                    <span className="font-mono text-zinc-400 mr-2">{step.time}</span>
                    {step.place_name}
                  </span>
                  {step.place_id && (
                    <Link href={`/posts/${step.place_id}`} className="text-emerald-600 flex items-center flex-shrink-0">
                      <ChevronRight size={14} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </main>
    </div>
  );
}
