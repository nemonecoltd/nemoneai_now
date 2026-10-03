"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SideCardShell from './SideCardShell';

interface MagazinePost {
  id: number;
  title: string;
  image_url?: string;
  excerpt?: string;
}

const dict = {
  ko: { title: 'PACE PICK', empty: '표시할 매거진이 없어요.' },
  en: { title: 'PACE PICK', empty: 'No magazine to show.' },
  zh: { title: 'PACE PICK', empty: '暂无杂志内容。' },
  ja: { title: 'PACE PICK', empty: '表示するマガジンがありません。' },
};

// 원래 매거진/무드/카테고리 3개 탭이었는데, 실제로 여기 들어가는 콘텐츠는 매거진뿐이라
// 탭 자체가 불필요했다(2026-09-08 요청) — 최신 매거진 1개만 큼직한 썸네일로 보여준다.
// Editorial Side Rail 개편(2026-09-08)으로 색 헤더 박스 제거. 하단 "자세히 →" 링크는
// 카드 전체(이미지+제목+요약)가 이미 하나의 Link라 중복이라는 피드백으로 제거(2026-09-10).
// 장소 피처링(지역·카테고리 태그)으로 바꾸는 안도 검토했으나 "매거진 전용, 태그 없이"로 유지 확정.
export default function HotplCard({ lang = 'ko' }: { lang?: string }) {
  const t = dict[lang as keyof typeof dict] || dict.ko;
  const [post, setPost] = useState<MagazinePost | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api-now/magazine');
        if (res.ok && !cancelled) setPost((await res.json())[0] ?? null);
      } catch {
        if (!cancelled) setPost(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <SideCardShell label={t.title}>
      {isLoading ? (
        <div className="py-6 text-center text-[11px] text-zinc-400">···</div>
      ) : !post ? (
        <div className="py-6 text-center text-[11px] text-zinc-400">{t.empty}</div>
      ) : (
        <Link href={`/magazine/${post.id}?lang=${lang}`} className="block group">
          <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100">
            {post.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            )}
          </div>
          <p className="mt-3 text-[13px] font-semibold text-zinc-900 leading-snug line-clamp-2 group-hover:text-pace-700">{post.title}</p>
          {post.excerpt && (
            <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed line-clamp-2">{post.excerpt}</p>
          )}
        </Link>
      )}
    </SideCardShell>
  );
}
