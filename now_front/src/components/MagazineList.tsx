"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Clock, ChevronRight, Newspaper } from 'lucide-react';
import React from 'react';
import AdUnit from './AdUnit';

interface MagazinePost {
  id: number;
  title: string;
  image_url?: string;
  category?: string;
  created_at?: string;
  excerpt?: string;
}

const dict = {
  ko: { title: '매거진', desc: '네모네AIM에 실린 지금여기 관련 아티클', empty: '아직 등록된 아티클이 없어요.' },
  en: { title: 'Magazine', desc: 'NOW-related articles from Nemone AIM', empty: 'No articles yet.' },
  zh: { title: '杂志', desc: '来自네모네AIM的相关文章', empty: '暂无文章。' },
};

export default function MagazineList({ lang = 'ko' }: { lang?: string }) {
  const [posts, setPosts] = useState<MagazinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Newspaper size={18} className="text-emerald-600" />
          <h2 className="text-lg font-black text-zinc-800">{t.title}</h2>
        </div>
        <p className="text-xs text-zinc-400 font-bold">{t.desc}</p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-zinc-300 text-xs font-bold">불러오는 중...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 italic">{t.empty}</div>
      ) : (
        <div className="space-y-4">
          {posts.map((post, idx) => (
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
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold text-white bg-emerald-500">
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
                          {new Date(post.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              </Link>
              {idx === 0 && <AdUnit slotId="1670386458" layoutKey="-6t+ed+2i-1n-4w" />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
