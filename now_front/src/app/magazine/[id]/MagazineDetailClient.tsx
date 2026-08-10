'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ExternalLink, Share2 } from 'lucide-react';
import { InArticleAd } from '@/components/AdUnit';
import BrandTagline from '@/components/BrandTagline';
import type { MagazinePost } from './page';

export default function MagazineDetailClient({ post, lang = 'ko' }: { post: MagazinePost | null; lang?: string }) {
  const router = useRouter();
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };

  const handleShare = async () => {
    if (!post) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, url });
      } catch {
        // 사용자가 공유 시트를 취소한 경우 등 — 별도 처리 없음
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    alert('링크가 복사되었습니다!');
  };

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 max-w-md mx-auto">
        <p className="text-sm font-bold text-zinc-400">아티클을 찾을 수 없어요.</p>
        <button onClick={handleBack} className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold">
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-100 px-5 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <span className="text-base font-black tracking-tight text-zinc-900">
            매거진 <span className="text-pace-500">.</span>
          </span>
        </div>
        <BrandTagline lang={lang} />
      </header>

      <main className="pb-16">
        {post.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image_url} alt={post.title} className="w-full aspect-[4/3] object-cover" />
        )}
        <div className="px-5 py-6">
          <h1 className="text-xl font-black text-zinc-900 leading-snug mb-4">{post.title}</h1>
          <div className="text-sm text-zinc-700 leading-relaxed [&_img]:rounded-2xl [&_img]:my-3 [&_p]:mb-3 [&_a]:text-pace-600 [&_a]:underline [&_table]:w-full [&_table]:my-4 [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-zinc-200 [&_th]:bg-zinc-50 [&_th]:p-2 [&_th]:text-left [&_th]:font-bold [&_td]:border [&_td]:border-zinc-200 [&_td]:p-2 [&_h1]:text-lg [&_h1]:font-black [&_h1]:text-zinc-900 [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-base [&_h2]:font-black [&_h2]:text-zinc-900 [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-black [&_h3]:text-zinc-900 [&_h3]:mt-4 [&_h3]:mb-2 [&_strong]:font-black [&_strong]:text-zinc-900">
            <div dangerouslySetInnerHTML={{ __html: post.body_text || '' }} />
          </div>

          <InArticleAd />

          <div className="mt-8 flex items-center gap-3">
            <a
              href={`https://nemoneai.com/posts/${post.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-pace-600 hover:text-pace-700"
            >
              네모네AIM에서 원문 보기 <ExternalLink size={12} />
            </a>
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-zinc-400 hover:text-pace-600 hover:bg-pace-50 transition-all"
              aria-label="공유하기"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
