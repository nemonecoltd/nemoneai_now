'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { InArticleAd } from '@/components/AdUnit';
import BrandTagline from '@/components/BrandTagline';
import type { MagazinePost } from './page';

export default function MagazineDetailClient({ post, lang = 'ko' }: { post: MagazinePost | null; lang?: string }) {
  const router = useRouter();
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
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
            매거진 <span className="text-emerald-500">.</span>
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
          <div className="text-sm text-zinc-700 leading-relaxed [&_img]:rounded-2xl [&_img]:my-3 [&_p]:mb-3 [&_a]:text-emerald-600 [&_a]:underline">
            {(() => {
              const html = post.body_text || '';
              const paragraphs = html.split('</p>');
              if (paragraphs.length < 5) {
                return (
                  <>
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                    <InArticleAd />
                  </>
                );
              }
              const mid = Math.floor(paragraphs.length / 2);
              const firstHalf = paragraphs.slice(0, mid).join('</p>') + '</p>';
              const secondHalf = paragraphs.slice(mid).join('</p>');
              return (
                <>
                  <div dangerouslySetInnerHTML={{ __html: firstHalf }} />
                  <InArticleAd />
                  <div dangerouslySetInnerHTML={{ __html: secondHalf }} />
                </>
              );
            })()}
          </div>

          <a
            href={`https://nemoneai.com/posts/${post.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700"
          >
            네모네AIM에서 원문 보기 <ExternalLink size={12} />
          </a>
        </div>
      </main>
    </div>
  );
}
