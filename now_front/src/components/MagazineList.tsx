"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Clock, ChevronRight, Newspaper } from 'lucide-react';
import React from 'react';
import AdUnit from './AdUnit';
import MoodBrowser from './MoodBrowser';
import CategoryBrowser from './CategoryBrowser';

interface MagazinePost {
  id: number;
  title: string;
  image_url?: string;
  category?: string;
  created_at?: string;
  excerpt?: string;
}

const dict = {
  ko: { title: '매거진', desc: '네모네AIM에 실린 NEMONE PACE 관련 아티클', empty: '아직 등록된 아티클이 없어요.', loading: '불러오는 중...', more: '더 보기', mood: '무드', category: '카테고리' },
  en: { title: 'Magazine', desc: 'NOW-related articles from Nemone AIM', empty: 'No articles yet.', loading: 'Loading...', more: 'Load more', mood: 'Mood', category: 'Category' },
  zh: { title: '杂志', desc: '来自네모네AIM的相关文章', empty: '暂无文章。', loading: '加载中...', more: '查看更多', mood: '氛围', category: '分类' },
  ja: { title: 'マガジン', desc: 'ネモネAIMに掲載されたNEMONE PACE関連記事', empty: 'まだ記事がありません。', loading: '読み込み中...', more: 'もっと見る', mood: 'ムード', category: 'カテゴリ' },
};

const DATE_LOCALE: Record<string, string> = { ko: 'ko-KR', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP' };

export type MagazineSub = 'article' | 'mood' | 'category';

// sub/setSub는 HomeClient가 소유한다(2026-09-07) — 지도/장소처럼 탭 선택 UI를 헤더로 옮겨
// 스크롤해도 고정되게 하려면 이 컴포넌트가 controlled여야 한다.
export default function MagazineList({ lang = 'ko', sub, initialMood, initialCategory }: { lang?: string; sub: MagazineSub; initialMood?: string; initialCategory?: string }) {
  const [posts, setPosts] = useState<MagazinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 기사가 늘어도 목록이 끝없이 길어지지 않게 20개씩 "더 보기"(2026-10-24 — 예전엔 Special 20개 상한으로 막았음)
  const [visible, setVisible] = useState(20);
  const t = dict[lang as keyof typeof dict] || dict.ko;

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api-now/magazine');
        if (res.ok) setPosts(await res.json());
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6 space-y-6 pb-24">
      {/* 매거진 | 무드 | 카테고리 탭 UI는 HomeClient.tsx의 <header>로 이동(2026-09-07) —
          지도/장소처럼 스크롤해도 고정되게 하기 위함. */}
      {sub === 'mood' ? (
        <MoodBrowser lang={lang} initialMood={initialMood} />
      ) : sub === 'category' ? (
        <CategoryBrowser lang={lang} initialCategory={initialCategory} />
      ) : (
      <>
      {isLoading ? (
        <div className="py-16 text-center text-zinc-300 text-xs font-bold">{t.loading}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 italic">{t.empty}</div>
      ) : (
        <div className="space-y-4">
          {posts.slice(0, visible).map((post, idx) => (
            <React.Fragment key={post.id}>
              <Link href={`/magazine/${post.id}?lang=${lang}`}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl border border-zinc-100 overflow-hidden shadow-sm hover:shadow-md transition-all group relative"
                >
                  <div className="relative h-48 overflow-hidden bg-zinc-100">
                    {post.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.image_url}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300">
                        <Newspaper size={32} />
                      </div>
                    )}
                    <div className="absolute top-4 left-4 flex gap-2">
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold text-white bg-pace-500">
                        {t.title}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-zinc-900 leading-snug">{post.title}</h3>
                      <ChevronRight size={20} className="flex-shrink-0 mt-1 text-zinc-300" />
                    </div>
                    {post.excerpt && (
                      <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed">{post.excerpt}</p>
                    )}
                    {post.created_at && (
                      <div className="flex items-center gap-2 pt-1">
                        <Clock size={12} className="text-zinc-400" />
                        <span className="text-[10px] font-medium text-zinc-400">
                          {new Date(post.created_at).toLocaleDateString(DATE_LOCALE[lang] || 'ko-KR')}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              </Link>
              {idx === 0 && <AdUnit slotId="1670386458" layoutKey="-6t+ed+2i-1n-4w" />}
            </React.Fragment>
          ))}
          {posts.length > visible && (
            <button
              onClick={() => setVisible((v) => v + 20)}
              className="w-full py-3 rounded-2xl border border-zinc-200 bg-white text-sm font-bold text-zinc-600 hover:border-zinc-400"
            >
              {t.more} ({visible}/{posts.length})
            </button>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}
