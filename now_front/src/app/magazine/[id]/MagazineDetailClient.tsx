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
          <div className="text-sm text-zinc-700 leading-relaxed [&_img]:rounded-2xl [&_img]:my-3 [&_p]:mb-3 [&_a]:text-pace-600 [&_a]:underline [&_table]:w-full [&_table]:my-4 [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-zinc-200 [&_th]:bg-zinc-50 [&_th]:p-2 [&_th]:text-left [&_th]:font-bold [&_td]:border [&_td]:border-zinc-200 [&_td]:p-2">
            {(() => {
              const html = post.body_text || '';
              // matmatch(nemoneai.com)에서 MD 업로드로 첨부한 표 등 구조화 콘텐츠는
              // <!--md-import-->...<!--/md-import-->로 감싸져 그대로 body_text에 저장됨.
              // 광고 삽입용 </p> 개수 분할이 이 블록 내부(표 태그 등)를 가로지르면 깨지므로,
              // 분할 전에 먼저 빼내고 항상 온전한 채로 뒤에 붙임(matmatch frontend와 동일 수정, 2026-08-09).
              const MD_BLOCK_REGEX = /<!--md-import-->[\s\S]*?<!--\/md-import-->/g;
              const mdBlocks = html.match(MD_BLOCK_REGEX)?.join('') || '';
              const quillOnly = html.replace(MD_BLOCK_REGEX, '');
              const paragraphs = quillOnly.split('</p>');
              if (paragraphs.length < 5) {
                // 본문(quill)이 짧아도 표 등 MD 블록이 크면 광고가 맨 끝(표 뒤)으로 밀려버림 —
                // MD 블록이 있으면 본문 뒤·표 앞에 광고를 끼워 중간 위치를 유지
                if (mdBlocks) {
                  return (
                    <>
                      <div dangerouslySetInnerHTML={{ __html: quillOnly }} />
                      <InArticleAd />
                      <div dangerouslySetInnerHTML={{ __html: mdBlocks }} />
                    </>
                  );
                }
                return (
                  <>
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                    <InArticleAd />
                  </>
                );
              }
              const mid = Math.floor(paragraphs.length / 2);
              const firstHalf = paragraphs.slice(0, mid).join('</p>') + '</p>';
              const secondHalf = paragraphs.slice(mid).join('</p>') + mdBlocks;
              return (
                <>
                  <div dangerouslySetInnerHTML={{ __html: firstHalf }} />
                  <InArticleAd />
                  <div dangerouslySetInnerHTML={{ __html: secondHalf }} />
                </>
              );
            })()}
          </div>

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
