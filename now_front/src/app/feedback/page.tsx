"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ChevronLeft, MessageSquare, Trash2, Send, ShieldCheck, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ADMIN_EMAIL = 'nemonecoltd@gmail.com';

export default function FeedbackPage() {
  const { user, signInWithGoogle, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState([]);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [replyInputs, setReplyInputs] = useState<{[key: number]: string}>({});

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api-now/feedbacks');
      if (res.ok) setFeedbacks(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return signInWithGoogle();
    if (!content.trim()) return;

    try {
      const res = await fetch('/api-now/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          content: content.trim()
        })
      });
      if (res.ok) {
        setContent('');
        fetchFeedbacks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말로 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api-now/feedbacks/${id}?user_id=${user?.id}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchFeedbacks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReply = async (id: number) => {
    const replyText = replyInputs[id];
    if (!replyText?.trim() || !isAdmin) return;

    try {
      const res = await fetch(`/api-now/feedbacks/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_email: user?.email,
          reply: replyText.trim()
        })
      });
      if (res.ok) {
        setReplyInputs(prev => ({...prev, [id]: ''}));
        fetchFeedbacks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl border-x border-zinc-200 flex flex-col pb-10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-100 px-6 py-4 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">사용자 피드백</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {/* Intro */}
        <div className="space-y-2">
          <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2">
            <MessageSquare className="text-emerald-500 fill-emerald-100" size={24} /> 소중한 의견을 들려주세요.
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed font-medium">
            네모네 서비스를 사용하며 느낀 불편함이나 바라는 점을 편하게 남겨주세요. 관리자가 모든 글을 꼼꼼히 읽고 답변해 드립니다!
          </p>
        </div>

        {/* Write Form */}
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm space-y-3 transition-all focus-within:border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-50">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={user ? "여기에 의견을 작성해주세요..." : "로그인 후 의견을 남길 수 있습니다."}
            disabled={!user}
            className="w-full h-24 bg-zinc-50/50 border-none rounded-2xl p-4 text-sm resize-none focus:outline-none focus:bg-white disabled:opacity-50 text-zinc-800 placeholder:text-zinc-400 font-medium"
          />
          <div className="flex justify-end">
            {user ? (
              <button type="submit" disabled={!content.trim()} className="px-6 py-2.5 bg-zinc-900 text-white text-[11px] font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-30 transition-all flex items-center gap-2 shadow-md">
                <Send size={14} /> 의견 남기기
              </button>
            ) : (
              <button type="button" onClick={() => signInWithGoogle()} className="px-6 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[11px] font-bold rounded-xl hover:bg-emerald-100 transition-all shadow-sm">
                로그인하기
              </button>
            )}
          </div>
        </form>

        {/* List */}
        <div className="space-y-5 pt-4">
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>
          ) : feedbacks.length === 0 ? (
            <div className="py-20 text-center text-zinc-400 text-sm font-medium italic">첫 번째 피드백을 남겨주세요!</div>
          ) : (
            feedbacks.map((fb: any) => (
              <div key={fb.id} className="bg-white rounded-[28px] border border-zinc-100 shadow-sm overflow-hidden">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 font-bold border border-zinc-200">
                        {fb.user_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 tracking-tight">{fb.user_name}</p>
                        <p className="text-[10px] font-medium text-zinc-400 mt-0.5">{new Date(fb.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    {(isAdmin || user?.id === fb.user_id) && (
                      <button onClick={() => handleDelete(fb.id)} className="p-2 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-zinc-700 whitespace-pre-line leading-relaxed font-medium">{fb.content}</p>
                </div>

                {/* Admin Reply Content */}
                {fb.admin_reply && (
                  <div className="bg-emerald-50 p-6 border-t border-emerald-100">
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-md">
                        <ShieldCheck size={16} />
                      </div>
                      <div className="space-y-1.5 flex-1 pt-1.5">
                        <p className="text-xs font-black text-emerald-700 tracking-tight">네모네 관리자</p>
                        <p className="text-sm text-emerald-900 whitespace-pre-line leading-relaxed font-medium">{fb.admin_reply}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin Reply Input form (Visible only to Admin when no reply exists) */}
                {isAdmin && !fb.admin_reply && (
                  <div className="bg-zinc-50 p-4 border-t border-zinc-100 flex gap-2">
                    <input
                      type="text"
                      value={replyInputs[fb.id] || ''}
                      onChange={e => setReplyInputs(prev => ({...prev, [fb.id]: e.target.value}))}
                      placeholder="이 의견에 관리자 답변 달기..."
                      className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-emerald-500 shadow-sm"
                    />
                    <button onClick={() => handleReply(fb.id)} className="px-5 py-3 bg-zinc-900 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-600 transition-colors">
                      답변
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
