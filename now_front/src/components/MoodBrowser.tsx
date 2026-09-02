"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

// 백엔드 mood_tags.py의 MOOD_TAGS와 같은 값 — 값이 갈리면 필터가 400을 맞으므로
// 태그 세트를 넓힐 땐 양쪽을 같이 수정해야 한다.
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
  region?: string;
  date_range?: string;
}

const dict = {
  ko: { desc: '분위기로 찾는 지금의 팝업', empty: '아직 이 분위기로 분류된 팝업이 없어요.', loading: '불러오는 중...', count: (n: number) => `${n}곳` },
  en: { desc: 'Find pop-ups by mood', empty: 'No pop-ups in this mood yet.', loading: 'Loading...', count: (n: number) => `${n} places` },
  zh: { desc: '按氛围寻找快闪店', empty: '暂无此氛围的快闪店。', loading: '加载中...', count: (n: number) => `${n}处` },
  ja: { desc: '雰囲気で探すポップアップ', empty: 'この雰囲気のポップアップはまだありません。', loading: '読み込み中...', count: (n: number) => `${n}件` },
};

export default function MoodBrowser({ lang = 'ko', initialMood }: { lang?: string; initialMood?: string }) {
  const t = dict[lang as keyof typeof dict] || dict.ko;
  const [mood, setMood] = useState<string>(
    initialMood && MOOD_TAGS.includes(initialMood) ? initialMood : MOOD_TAGS[0]
  );
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api-now/places?mood=${encodeURIComponent(mood)}&category=popup&limit=60`
        );
        if (res.ok && !cancelled) setPlaces(await res.json());
      } catch {
        if (!cancelled) setPlaces([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mood]);

  const titleOf = (p: Place) =>
    (lang === 'en' && p.title_en) ? p.title_en
    : (lang === 'zh' && p.title_zh) ? p.title_zh
    : (lang === 'ja' && p.title_ja) ? p.title_ja
    : p.title;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-pace-600" />
          <h2 className="text-lg font-black text-zinc-800">{mood}</h2>
          {!isLoading && (
            <span className="text-xs font-bold text-zinc-400">{t.count(places.length)}</span>
          )}
        </div>
        <p className="text-xs text-zinc-400 font-bold">{t.desc}</p>
      </div>

      {/* 무드 선택 칩 — 개수가 많아 모바일에서 가로 스크롤 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MOOD_TAGS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMood(m)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${
              mood === m
                ? 'bg-pace-600 text-white'
                : 'bg-white text-zinc-500 border border-zinc-200 hover:border-pace-400 hover:text-pace-600'
            }`}
          >
            {m}
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
            <Link key={p.id} href={`/posts/${p.id}?lang=${lang}`}>
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
          ))}
        </div>
      )}
    </div>
  );
}
