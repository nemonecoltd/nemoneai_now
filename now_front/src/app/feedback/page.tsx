"use client";

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ChevronLeft, MessageSquare, Trash2, Pencil, Send, ShieldCheck, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AdUnit from '@/components/AdUnit';
import BrandTagline from '@/components/BrandTagline';
import SiteFooter from '@/components/SiteFooter';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ADMIN_EMAIL = 'nemonecoltd@gmail.com';

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <FeedbackPageContent />
    </Suspense>
  );
}

function FeedbackPageContent() {
  const { user, session, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'ko';
  const tr = (ko: string, en: string, zh: string, ja: string) =>
    lang === 'en' ? en : lang === 'zh' ? zh : lang === 'ja' ? ja : ko;
  const [feedbacks, setFeedbacks] = useState([]);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [replyInputs, setReplyInputs] = useState<{[key: number]: string}>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  const isAdmin = user?.email === ADMIN_EMAIL;

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  });

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/?lang=${lang}`);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api-now/feedbacks', { headers: authHeaders() });
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
        headers: authHeaders(),
        body: JSON.stringify({
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
    if (!confirm(tr('정말로 삭제하시겠습니까?', 'Are you sure you want to delete this?', '确定要删除吗?', '本当に削除しますか?'))) return;
    try {
      const res = await fetch(`/api-now/feedbacks/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) fetchFeedbacks();
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (fb: any) => {
    setEditingId(fb.id);
    setEditContent(fb.content);
  };

  const handleEditSave = async (id: number) => {
    if (!editContent.trim()) return;
    try {
      const res = await fetch(`/api-now/feedbacks/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ content: editContent.trim() })
      });
      if (res.ok) {
        setEditingId(null);
        fetchFeedbacks();
      }
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
        headers: authHeaders(),
        body: JSON.stringify({ reply: replyText.trim() })
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
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-100 px-6 pt-4 pb-1 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">{tr('사용자 피드백', 'User Feedback', '用户反馈', 'ユーザーフィードバック')}</h1>
        </div>
        <BrandTagline />
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {/* Intro */}
        <div className="space-y-2">
          <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2">
            <MessageSquare className="text-pace-500 fill-pace-100" size={24} /> {tr('소중한 의견을 들려주세요.', 'Share your thoughts with us.', '请分享您宝贵的意见。', '貴重なご意見をお聞かせください。')}
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed font-medium">
            {tr(
              '네모네 서비스를 사용하며 느낀 불편함이나 바라는 점을 편하게 남겨주세요. 관리자가 모든 글을 꼼꼼히 읽고 답변해 드립니다!',
              'Feel free to share anything inconvenient or anything you wish for while using NEMONE. Our team reads every message carefully and replies!',
              '请随意留下您在使用NEMONE服务时感受到的不便或期望。管理员会仔细阅读每一条留言并回复!',
              'NEMONEサービスをご利用中に感じた不便な点やご要望を気軽にお寄せください。管理者がすべての投稿を丁寧に読み、返信いたします!',
            )}
          </p>
        </div>

        {/* Write Form */}
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm space-y-3 transition-all focus-within:border-pace-300 focus-within:ring-4 focus-within:ring-pace-50">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={tr('여기에 의견을 작성해주세요...', 'Write your feedback here...', '请在此处填写您的意见...', 'ここにご意見をご記入ください...')}
            className="w-full h-24 bg-zinc-50/50 border-none rounded-2xl p-4 text-sm resize-none focus:outline-none focus:bg-white disabled:opacity-50 text-zinc-800 placeholder:text-zinc-400 font-medium"
          />
          <div className="flex justify-end">
            <button type="submit" disabled={!content.trim()} className="px-6 py-2.5 bg-zinc-900 text-white text-[11px] font-bold rounded-xl hover:bg-pace-600 disabled:opacity-30 transition-all flex items-center gap-2 shadow-md">
              <Send size={14} /> {tr('의견 남기기', 'Submit', '提交意见', '意見を送る')}
            </button>
          </div>
        </form>

        <AdUnit slotId="1670386458" layoutKey="-6t+ed+2i-1n-4w" />

        {/* List */}
        <div className="space-y-5 pt-4">
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-pace-500" /></div>
          ) : feedbacks.length === 0 ? (
            <div className="py-20 text-center text-zinc-400 text-sm font-medium italic">{tr('첫 번째 피드백을 남겨주세요!', 'Be the first to leave feedback!', '快来留下第一条反馈吧!', '最初のフィードバックを残しましょう!')}</div>
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
                    {(isAdmin || user?.id === fb.user_id) && editingId !== fb.id && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(fb)} className="p-2 text-zinc-300 hover:text-pace-500 hover:bg-pace-50 rounded-xl transition-colors">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(fb.id)} className="p-2 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {editingId === fb.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full h-24 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:border-pace-400 text-zinc-800"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-600">{tr('취소', 'Cancel', '取消', 'キャンセル')}</button>
                        <button onClick={() => handleEditSave(fb.id)} className="px-4 py-2 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-pace-600">{tr('저장', 'Save', '保存', '保存')}</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-700 whitespace-pre-line leading-relaxed font-medium">{fb.content}</p>
                  )}
                </div>

                {/* Admin Reply Content */}
                {fb.admin_reply && (
                  <div className="bg-pace-50 p-6 border-t border-pace-100">
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 bg-pace-500 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-md">
                        <ShieldCheck size={16} />
                      </div>
                      <div className="space-y-1.5 flex-1 pt-1.5">
                        <p className="text-xs font-black text-pace-700 tracking-tight">{tr('네모네 관리자', 'NEMONE Admin', 'NEMONE管理员', 'NEMONE管理者')}</p>
                        <p className="text-sm text-pace-900 whitespace-pre-line leading-relaxed font-medium">{fb.admin_reply}</p>
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
                      placeholder={tr('이 의견에 관리자 답변 달기...', 'Reply to this feedback as admin...', '对该反馈进行管理员回复...', 'この意見に管理者として返信...')}
                      className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-pace-500 shadow-sm"
                    />
                    <button onClick={() => handleReply(fb.id)} className="px-5 py-3 bg-zinc-900 text-white rounded-xl text-xs font-bold shadow-md hover:bg-pace-600 transition-colors">
                      {tr('답변', 'Reply', '回复', '返信')}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <SiteFooter lang={lang} />
      </main>
    </div>
  );
}
