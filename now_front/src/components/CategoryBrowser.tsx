"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Sparkles, Share2 } from 'lucide-react';
import AdUnit from './AdUnit';

// 백엔드 category_tags.py의 CATEGORY_TAGS와 같은 값 — 값이 갈리면 필터가 400을 맞으므로
// 태그 세트를 넓힐 땐 양쪽을 같이 수정해야 한다.
const CATEGORY_TAGS = ['패션', '뷰티', '캐릭터', '애니웹툰', '엔터', '종합'];

interface Place {
  id: number;
  title: string;
  title_en?: string;
  title_zh?: string;
  title_ja?: string;
  image_url?: string;
  region?: string;
  date_range?: string;
}

const dict = {
  ko: { empty: '아직 이 카테고리로 분류된 팝업이 없어요.', loading: '불러오는 중...', share: '이 카테고리 공유하기', linkCopied: '링크가 복사됐어요' },
  en: { empty: 'No pop-ups in this category yet.', loading: 'Loading...', share: 'Share this category', linkCopied: 'Link copied' },
  zh: { empty: '暂无此分类的快闪店。', loading: '加载中...', share: '分享此分类', linkCopied: '链接已复制' },
  ja: { empty: 'このカテゴリのポップアップはまだありません。', loading: '読み込み中...', share: 'このカテゴリを共有', linkCopied: 'リンクをコピーしました' },
};

export default function CategoryBrowser({ lang = 'ko', initialCategory }: { lang?: string; initialCategory?: string }) {
  const t = dict[lang as keyof typeof dict] || dict.ko;
  const [category, setCategory] = useState<string>(
    initialCategory && CATEGORY_TAGS.includes(initialCategory) ? initialCategory : CATEGORY_TAGS[0]
  );
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api-now/places?category_tag=${encodeURIComponent(category)}&limit=60`
        );
        if (res.ok && !cancelled) setPlaces(await res.json());
      } catch {
        if (!cancelled) setPlaces([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [category]);

  const titleOf = (p: Place) =>
    (lang === 'en' && p.title_en) ? p.title_en
    : (lang === 'zh' && p.title_zh) ? p.title_zh
    : (lang === 'ja' && p.title_ja) ? p.title_ja
    : p.title;

  const handleShare = async () => {
    const url = `https://now.nemoneai.com/?category_tag=${encodeURIComponent(category)}&lang=${lang}`;
    if (navigator.share) {
      try { await navigator.share({ title: category, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert(t.linkCopied);
      } catch {}
    }
  };

  return (
    <div className="space-y-5">
      {/* MoodBrowser와 동일하게 줄바꿈 방식으로 통일 — 전체 태그가 한 번에 다 보이게 함(2026-09-06). */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_TAGS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${
              category === c
                ? 'bg-pace-600 text-white'
                : 'bg-white text-zinc-500 border border-zinc-200 hover:border-pace-400 hover:text-pace-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-zinc-300 text-xs font-bold">{t.loading}</div>
      ) : places.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 italic text-sm">{t.empty}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {places.map((p, idx) => (
            <React.Fragment key={p.id}>
            <Link href={`/posts/${p.id}?lang=${lang}`}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx, 8) * 0.02 }}
                className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm hover:shadow-md transition-all group h-full"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={titleOf(p)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <Sparkles size={24} />
                    </div>
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
              </motion.div>
            </Link>
            {idx === 3 && (
              <div className="col-span-2">
                <AdUnit slotId="1670386458" layoutKey="-6t+ed+2i-1n-4w" />
              </div>
            )}
            </React.Fragment>
          ))}
        </div>
      )}

      {!isLoading && places.length > 0 && (
        <button
          type="button"
          onClick={handleShare}
          className="mx-auto flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-zinc-200 text-xs font-bold text-zinc-500 hover:border-pace-400 hover:text-pace-600 transition-colors active:scale-95"
        >
          <Share2 size={13} />
          {t.share}
        </button>
      )}
    </div>
  );
}
