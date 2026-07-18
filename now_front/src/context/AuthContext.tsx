'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User, Session, SupabaseClient } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithKakao: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>
  signUpWithEmail: (email: string, password: string, metadata: any) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // useEffect 안에서만 생성 — 브라우저 전용 API 호출로 SSR에서 실행 안 됨
  const supabaseRef = useRef<SupabaseClient | null>(null)

  useEffect(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    const supabase = supabaseRef.current

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Tailscale IP 등으로 로컬 원격 접속 시엔 auth.nemoneai.com을 거치는 중앙 SSO 리다이렉트를 타면
  // 세션 쿠키가 .nemoneai.com에만 저장돼 이 origin으로 넘어오지 못해 로그인 무한루프가 생김 —
  // 그 경우 이 origin 안에서 자체적으로 OAuth를 완결(현재 origin의 /auth/callback으로 복귀)
  const isProdDomain = () => window.location.hostname.endsWith('nemoneai.com')

  const signInWithGoogle = async () => {
    if (!isProdDomain()) {
      const returnTo = window.location.pathname + window.location.search
      await supabaseRef.current!.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}` },
      })
      return
    }
    const authUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3002'
    const currentUrl = window.location.origin
    window.location.href = `${authUrl}/login?next=${encodeURIComponent(currentUrl)}`
  }

  const signInWithKakao = async () => {
    if (!isProdDomain()) {
      const returnTo = window.location.pathname + window.location.search
      await supabaseRef.current!.auth.signInWithOAuth({
        provider: 'kakao',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}` },
      })
      return
    }
    const authUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3002'
    const currentUrl = window.location.origin
    window.location.href = `${authUrl}/login?provider=kakao&next=${encodeURIComponent(currentUrl)}`
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabaseRef.current!.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUpWithEmail = async (email: string, password: string, metadata: any) => {
    const { error } = await supabaseRef.current!.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error }
  }

  const signOut = async () => {
    await supabaseRef.current?.auth.signOut()
    if (!isProdDomain()) {
      window.location.reload()
      return
    }
    const authUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3002'
    window.location.href = `${authUrl}/login?next=${encodeURIComponent(window.location.origin)}`
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signInWithGoogle, signInWithKakao, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
