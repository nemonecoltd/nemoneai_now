"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, User, Bot, Loader2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import StoreBanner from './StoreBanner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PlaceRef {
  id: number;
  title: string;
  location: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  places?: PlaceRef[];
}

const dict = {
  ko: {
    title: 'AI 가이드에게 물어보기',
    subtitle: '{region}의 실시간 정보와 핫플레이스에 대해 질문해보세요.',
    placeholder: '무엇이든 물어보세요...',
    error: '죄송합니다. 답변을 생성하는 중 오류가 발생했습니다.',
    connError: '서버와 통신할 수 없습니다.',
    examples: {
      '성수': [
        '"지금 당장 갈만한 패션 팝업 알려줘"',
        '"연무장길 근처 맛집 코스 짜줘"'
      ],
      '홍대': [
        '"오늘 홍대 버스킹이나 공연 정보 있어?"',
        '"상수동 근처 분위기 좋은 카페 추천해줘"'
      ]
    }
  },
  en: {
    title: 'Ask AI Guide',
    subtitle: 'Ask about real-time info and hotspots in {region}.',
    placeholder: 'Ask anything...',
    error: 'Sorry, an error occurred while generating the answer.',
    connError: 'Cannot connect to the server.',
    examples: {
      '성수': [
        '"Tell me about fashion pop-ups open now in Seongsu"',
        '"Suggest a food course near Yeonmujang-gil"'
      ],
      '홍대': [
        '"Is there any busking or live music in Hongdae today?"',
        '"Recommend a cozy cafe near Sangsu-dong"'
      ]
    }
  }
};

// 마크다운·표·URL 정리 후 줄바꿈 처리
function formatMessage(text: string): React.ReactNode {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')   // 코드블록 제거
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\|.*\|$/gm, '')         // 표 행 제거
    .replace(/^\s*[-:]+\s*\|/gm, '')   // 표 구분선 제거
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '[[B]]$1[[/B]]')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-•]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned.split('\n').map((line, i) => {
    if (!line.trim()) return <br key={i} />;

    // URL → "바로가기" 링크
    const urlRegex = /https?:\/\/[^\s]+/g;
    if (urlRegex.test(line)) {
      const parts = line.split(/(https?:\/\/[^\s]+)/g);
      return (
        <p key={i} className="mb-1">
          {parts.map((part, j) =>
            /^https?:\/\//.test(part)
              ? <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline font-bold">바로가기</a>
              : part
          )}
        </p>
      );
    }

    // 굵은 글씨
    if (line.includes('[[B]]')) {
      const parts = line.split(/(\[\[B\]\].*?\[\[\/B\]\])/g);
      return (
        <p key={i} className="mb-1">
          {parts.map((part, j) => {
            const m = part.match(/^\[\[B\]\](.*)\[\[\/B\]\]$/);
            return m ? <strong key={j}>{m[1]}</strong> : part;
          })}
        </p>
      );
    }

    return <p key={i} className={line.startsWith('•') ? 'mb-1 pl-1' : 'mb-1'}>{line}</p>;
  });
}

export default function AskAI({ region = '성수', lang = 'ko' }: { region?: string, lang?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setNewInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = dict[lang as keyof typeof dict] || dict.ko;
  const displayRegion = lang === 'en' ? (region === '성수' ? 'Seongsu' : region === '용산' ? 'Yongsan' : region === '강남' ? 'Gangnam' : 'Hongdae') : region;
  const currentExamples = t.examples[region as keyof typeof t.examples] || t.examples['성수'];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setNewInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api-now/ask?region=${encodeURIComponent(region)}&lang=${lang}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_query: userMsg }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer, places: data.places || [] }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: t.error }]);
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'assistant', content: t.connError }]);
    } finally {
      setIsLoading(false);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-240px)] min-h-[400px]">
      {/* 헤더 */}
      <div className="p-6 pb-2 flex-shrink-0">
        <h2 className="text-xl font-bold font-display flex items-center gap-2 text-zinc-900">
          <Sparkles className="text-emerald-500" size={20} /> {t.title}
        </h2>
        <p className="text-xs text-zinc-500 mt-1">{t.subtitle.replace('{region}', displayRegion)}</p>
      </div>

      {/* 빈 상태: 입력창 상단 노출 */}
      {isEmpty && (
        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <form onSubmit={handleSend} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setNewInput(e.target.value)}
              placeholder={t.placeholder}
              className="w-full bg-white border border-zinc-200 rounded-2xl pl-5 pr-14 py-4 text-sm text-zinc-900 focus:outline-none focus:border-emerald-500/50 shadow-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center disabled:opacity-30 transition-all hover:bg-emerald-600"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      {/* 메시지 영역 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar min-h-0"
      >
        {isEmpty && (
          <div className="flex flex-col items-center justify-center text-center space-y-4 opacity-40 px-10 pt-8">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <Bot className="text-emerald-500" size={32} />
            </div>
            <div className="space-y-2">
              {currentExamples.map((ex, i) => (
                <p key={i} className="text-xs font-medium text-zinc-500 italic">{ex}</p>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
              msg.role === 'user' ? "bg-zinc-900 text-white" : "bg-emerald-50 text-emerald-600"
            )}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={cn("flex flex-col gap-2", msg.role === 'user' ? "items-end" : "items-start", "max-w-[80%]")}>
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                msg.role === 'user'
                  ? "bg-zinc-900 text-white rounded-tr-none"
                  : "bg-white border border-zinc-100 rounded-tl-none text-zinc-800"
              )}>
                {msg.role === 'assistant' ? formatMessage(msg.content) : msg.content}
              </div>
              {msg.role === 'assistant' && msg.places && msg.places.length > 0 && (
                <div className="flex flex-col gap-1.5 w-full">
                  {msg.places.map((p) => (
                    <Link
                      key={p.id}
                      href={`/posts/${p.id}?region=${encodeURIComponent(region)}&lang=${lang}`}
                      className="flex items-center justify-between gap-2 bg-white border border-zinc-100 rounded-xl px-3 py-2 text-xs hover:border-emerald-300 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="font-bold text-zinc-800 truncate block">{p.title}</span>
                        <span className="text-zinc-400 truncate block">{p.location}</span>
                      </span>
                      <ChevronRight size={14} className="text-zinc-300 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-white border border-zinc-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
              <Loader2 className="animate-spin text-emerald-500" size={16} />
            </div>
          </div>
        )}

        <StoreBanner />
      </div>

      {/* 메시지 있을 때만 하단 입력창 */}
      {!isEmpty && (
        <div className="p-6 bg-zinc-50/80 backdrop-blur-md border-t border-zinc-100 flex-shrink-0">
          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setNewInput(e.target.value)}
              placeholder={t.placeholder}
              className="w-full bg-white border border-zinc-200 rounded-2xl pl-5 pr-14 py-4 text-sm text-zinc-900 focus:outline-none focus:border-emerald-500/50 shadow-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center disabled:opacity-30 transition-all hover:bg-emerald-600"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
