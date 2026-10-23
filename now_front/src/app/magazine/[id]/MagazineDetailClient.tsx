'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ExternalLink, Share2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InArticleAd } from '@/components/AdUnit';
import BottomNav from '@/components/BottomNav';
import SiteFooter from '@/components/SiteFooter';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import SideCardLayout, { WIDE_FRAME, WIDE_FRAME_BORDER, useElementHeight } from '@/components/sidecards/SideCardLayout';
import type { MagazinePost } from './page';


export default function MagazineDetailClient({ post, lang = 'ko' }: { post: MagazinePost | null; lang?: string }) {
  const router = useRouter();
  const { user, signInWithGoogle } = useAuth();
  const [headerRef, headerH] = useElementHeight<HTMLElement>(96);

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
    alert(lang === 'en' ? 'Link copied!' : lang === 'zh' ? '链接已复制！' : lang === 'ja' ? 'リンクをコピーしました！' : '링크가 복사되었습니다!');
  };

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 max-w-md mx-auto">
        <p className="text-sm font-bold text-zinc-400">
          {lang === 'en' ? 'Article not found.' : lang === 'zh' ? '找不到该文章。' : lang === 'ja' ? '記事が見つかりません。' : '아티클을 찾을 수 없어요.'}
        </p>
        <button onClick={handleBack} className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold">
          {lang === 'en' ? 'Go Back' : lang === 'zh' ? '返回' : lang === 'ja' ? '戻る' : '돌아가기'}
        </button>
      </div>
    );
  }

  const setLang = (l: string) => router.push(`/magazine/${post.id}?lang=${l}`);

  // 카드가 있는 페이지는 상/하단바까지 포함해 홈(PACE SPA)과 같은 폭(xl:max-w-6xl)으로 넓어지고,
  // 카드는 그 넓어진 프레임 '안', 본문(<main>) 안에서 기존 콘텐츠 양옆에 배치된다(2026-09-07,
  // "카드만 바깥에 붙이는" 이전 방식은 상/하단바 폭이 그대로라 어색하다는 피드백으로 재작업).
  return (
      <div className={cn("min-h-screen bg-zinc-50 relative", WIDE_FRAME, WIDE_FRAME_BORDER)}>
        {/* 사이트 전체 헤더(로고+GNB) — 다른 상세페이지(PlaceDetailClient)와 동일 패턴,
            지역 탭만 여기선 의미가 없어 생략(2026-09-05, 매거진 리더에 원래 없던 걸 추가) */}
        <header ref={headerRef} className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-100 px-5 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleBack}
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <Logo />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 shadow-inner">
              {(['ko', 'en', 'zh', 'ja'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-black rounded-md transition-all whitespace-nowrap",
                    lang === l ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400"
                  )}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            {user ? (
              <a href={`/my?lang=${lang}`} className="flex items-center bg-zinc-100 p-0.5 rounded-full border border-zinc-200 hover:bg-white transition-all">
                <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-white shadow-sm bg-zinc-200">
                  <img
                    src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=random`}
                    className="w-full h-full object-cover"
                    alt="profile"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </a>
            ) : (
              <button onClick={() => signInWithGoogle()} className="p-1.5 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
                <Users size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
      <SideCardLayout headerH={headerH} lang={lang}>
      <div className="pb-16">
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
              href="https://nemoneai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-pace-600 hover:text-pace-700"
            >
              {lang === 'en' ? 'More stories on Nemone AIM' : lang === 'zh' ? '在네모네AIM查看更多文章' : lang === 'ja' ? 'ネモネAIMで他の記事を見る' : '네모네AIM에서 더 많은 이야기'} <ExternalLink size={12} />
            </a>
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-zinc-400 hover:text-pace-600 hover:bg-pace-50 transition-all"
              aria-label={lang === 'en' ? 'Share' : lang === 'zh' ? '分享' : lang === 'ja' ? '共有' : '공유하기'}
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </div>
        <SiteFooter lang={lang} />
      </SideCardLayout>
      </main>

      <BottomNav lang={lang} wide />
    </div>
  );
}
