"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, ArrowRight, Loader2, Globe } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const { signUpWithEmail } = useAuth();
  const [lang, setLang] = useState<'ko' | 'en'>('ko');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [nationality, setNationality] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const t = {
    title: lang === 'ko' ? '지금 여기' : 'Now Here',
    subtitle: lang === 'ko' ? '계정 만들기' : 'Create an account',
    nameLabel: lang === 'ko' ? '이름' : 'Full Name',
    namePlaceholder: lang === 'ko' ? '홍길동' : 'John Doe',
    emailLabel: lang === 'ko' ? '이메일' : 'Email Address',
    emailPlaceholder: lang === 'ko' ? 'hello@example.com' : 'hello@example.com',
    passwordLabel: lang === 'ko' ? '비밀번호' : 'Password',
    passwordPlaceholder: lang === 'ko' ? '•••••••• (6자 이상)' : '•••••••• (Min 6 chars)',
    genderLabel: lang === 'ko' ? '성별 (선택)' : 'Gender (Optional)',
    ageLabel: lang === 'ko' ? '연령대 (선택)' : 'Age Group (Optional)',
    nationalityLabel: lang === 'ko' ? '국적 (선택)' : 'Nationality (Optional)',
    signupBtn: lang === 'ko' ? '가입하기' : 'Sign Up',
    alreadyAccount: lang === 'ko' ? '이미 계정이 있으신가요?' : 'Already have an account?',
    signin: lang === 'ko' ? '로그인' : 'Sign in',
    serverError: lang === 'ko' ? '서버와 통신 중 오류가 발생했습니다.' : 'Error communicating with server.',
    failError: lang === 'ko' ? '회원가입에 실패했습니다.' : 'Failed to sign up.'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error } = await signUpWithEmail(email, password, {
        full_name: name,
        gender,
        age,
        nationality
      });

      if (error) {
        setError(error.message || t.failError);
        setIsLoading(false);
      } else {
        alert(lang === 'ko' ? '회원가입 신청이 완료되었습니다. 이메일을 확인해 주세요!' : 'Sign up request completed. Please check your email!');
        router.push('/login');
      }
    } catch (err) {
      setError(t.serverError);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 font-sans max-w-md mx-auto shadow-2xl border-x border-zinc-200 relative">
      <button 
        type="button"
        onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
        className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-sm border border-zinc-200 text-zinc-500 hover:text-emerald-500 transition"
      >
        <Globe size={20} />
      </button>

      <div className="w-full bg-white rounded-[40px] p-8 shadow-sm border border-zinc-100 mt-8">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">{t.title} <span className="text-emerald-500">.</span></h1>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{t.subtitle}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 text-rose-600 text-sm font-bold rounded-2xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">{t.nameLabel}</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                placeholder={t.namePlaceholder}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">{t.emailLabel}</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                placeholder={t.emailPlaceholder}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">{t.passwordLabel}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                placeholder={t.passwordPlaceholder}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">{t.genderLabel}</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-4 text-sm font-medium text-zinc-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              >
                <option value="">{lang === 'ko' ? '선택 안함' : 'None'}</option>
                <option value="male">{lang === 'ko' ? '남성' : 'Male'}</option>
                <option value="female">{lang === 'ko' ? '여성' : 'Female'}</option>
                <option value="other">{lang === 'ko' ? '기타' : 'Other'}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">{t.ageLabel}</label>
              <select
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-4 text-sm font-medium text-zinc-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              >
                <option value="">{lang === 'ko' ? '선택 안함' : 'None'}</option>
                <option value="10s">10{lang === 'ko' ? '대' : 's'}</option>
                <option value="20s">20{lang === 'ko' ? '대' : 's'}</option>
                <option value="30s">30{lang === 'ko' ? '대' : 's'}</option>
                <option value="40s">40{lang === 'ko' ? '대 이상' : 's+'}</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">{t.nationalityLabel}</label>
            <input
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-4 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              placeholder={lang === 'ko' ? '예: 한국, USA, Japan...' : 'e.g. Korea, USA, Japan...'}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-500 text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-xl disabled:opacity-50 disabled:hover:bg-emerald-500 mt-8"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>{t.signupBtn} <ArrowRight className="w-5 h-5" /></>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-zinc-500 font-medium">
          {t.alreadyAccount}{' '}
          <Link href="/login" className="text-zinc-900 font-bold hover:underline">
            {t.signin}
          </Link>
        </p>
      </div>
    </div>
  );
}