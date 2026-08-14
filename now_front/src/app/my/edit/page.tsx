"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Camera, Loader2, Save, User, Globe, Trash2, Bell, BellOff } from 'lucide-react';
import BrandTagline from '@/components/BrandTagline';
import { createClient } from '@/utils/supabase/client';
import { usePushSubscription } from '@/lib/usePushSubscription';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';

export default function EditProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <EditProfileContent />
    </Suspense>
  );
}

function EditProfileContent() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'ko';
  const tr = (ko: string, en: string, zh: string, ja: string) =>
    lang === 'en' ? en : lang === 'zh' ? zh : lang === 'ja' ? ja : ko;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { supported: pushSupported, subscribed: pushSubscribed, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushSubscription();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [nationality, setNationality] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/?lang=${lang}`);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      const authUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3002';
      window.location.href = `${authUrl}/login?next=${encodeURIComponent(window.location.origin)}`;
      return;
    } else if (user) {
      setName(user.user_metadata?.full_name || '');
      setGender(user.user_metadata?.gender || '');
      setAge(user.user_metadata?.age || '');
      setNationality(user.user_metadata?.nationality || '');
      setImageUrl(user.user_metadata?.avatar_url || '');
      setPreviewUrl(user.user_metadata?.avatar_url || '');
      setIsLoading(false);
    }
  }, [user, authLoading, router]);

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas to Blob failed'));
          }, 'image/webp', 0.8);
        };
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    let finalImageUrl = imageUrl;

    try {
      // 1. Upload new image if selected using Supabase Storage
      if (selectedFile && user) {
        const compressedBlob = await compressImage(selectedFile);
        const fileName = `${user.id}-${Date.now()}.webp`;
        
        const { data, error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(fileName, compressedBlob, {
            contentType: 'image/webp',
            upsert: true
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw new Error(tr(
            '이미지 업로드에 실패했습니다. Supabase Storage에 profiles 버킷이 생성되어 있는지 확인해주세요.',
            'Image upload failed. Please check that the profiles bucket exists in Supabase Storage.',
            '图片上传失败。请确认Supabase Storage中已创建profiles存储桶。',
            '画像のアップロードに失敗しました。Supabase Storageにprofilesバケットが作成されているか確認してください。',
          ));
        }

        const { data: publicUrlData } = supabase.storage.from('profiles').getPublicUrl(fileName);
        finalImageUrl = publicUrlData.publicUrl;
      }

      // 2. Update Supabase User Metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: name,
          gender: gender || null,
          age: age || null,
          nationality: nationality || null,
          avatar_url: finalImageUrl
        }
      });

      if (updateError) throw new Error(updateError.message);

      router.push(`/my?lang=${lang}`);
      router.refresh();

    } catch (e: any) {
      setError(e.message || tr('저장 중 오류가 발생했습니다.', 'An error occurred while saving.', '保存时发生错误。', '保存中にエラーが発生しました。'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm(tr(
      '정말 계정을 탈퇴하시겠습니까?\n작성하신 코스와 저장된 장소 등 모든 데이터가 삭제되며 복구할 수 없습니다.',
      'Are you sure you want to delete your account?\nAll your data, including courses and saved places, will be permanently deleted.',
      '确定要注销账户吗?\n您创建的路线、收藏的地点等所有数据都将被删除且无法恢复。',
      '本当にアカウントを退会しますか?\n作成したコースや保存した場所などすべてのデータが削除され、復元できません。',
    ))) return;
    
    setIsSaving(true);
    try {
      // 자체 백엔드(GCP DB)에서 연관 데이터 삭제 (테마, 코스, 좋아요 등)
      // Supabase Edge Function이나 백엔드 API를 통해 Supabase auth.users 테이블에서도 삭제가 필요하지만
      // 클라이언트 SDK로는 자신 계정 삭제가 기본적으로 불가능하므로 백엔드 API를 호출해야 합니다.
      // 임시 방편으로 FastAPI 쪽 유저 데이터만 날리고 signOut 시킵니다.
      const res = await fetch(`/api-now/users/${user?.id}`, { method: 'DELETE' });
      if (!res.ok) {
        console.error('Failed to delete user data from backend');
      }

      await signOut();
      router.push(`/?lang=${lang}`);
    } catch (e: any) {
      setError(e.message || tr('탈퇴 처리 중 오류가 발생했습니다.', 'An error occurred while deleting your account.', '注销处理时发生错误。', '退会処理中にエラーが発生しました。'));
      setIsSaving(false);
    }
  };

  if (isLoading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-50"><Loader2 className="animate-spin text-pace-500 w-8 h-8" /></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto shadow-2xl border-x border-zinc-200 pb-20">
      <header className="sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">{tr('프로필 수정', 'Edit Profile', '编辑个人资料', 'プロフィール編集')}</h1>
        </div>
        <BrandTagline />
      </header>

      <main className="p-6 space-y-8">
        {error && (
          <div className="p-4 bg-rose-50 text-rose-600 text-sm font-bold rounded-2xl text-center">
            {error}
          </div>
        )}

        {/* Profile Image */}
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-pace-50 shadow-lg bg-zinc-100 flex items-center justify-center">
              {previewUrl ? (
                <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={40} className="text-zinc-300" />
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white w-8 h-8" />
            </div>
            <div className="absolute bottom-0 right-0 p-2 bg-pace-500 rounded-full border-2 border-white shadow-sm text-white">
              <Camera size={14} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-zinc-400 mt-4 uppercase tracking-widest">{tr('사진 변경 (최적화 적용)', 'Change Photo (auto-optimized)', '更换照片(自动优化)', '写真を変更(最適化済み)')}</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {/* Form Fields */}
        <div className="bg-white p-6 rounded-[32px] border border-zinc-100 shadow-sm space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-base font-bold text-zinc-900 focus:outline-none focus:border-pace-500" placeholder={tr('이름을 입력하세요', 'Enter your name', '请输入姓名', 'お名前を入力してください')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-base font-medium text-zinc-900 focus:outline-none focus:border-pace-500">
                <option value="">{tr('선택 안함', 'Not selected', '不选择', '未選択')}</option>
                <option value="male">{tr('남성', 'Male', '男', '男性')}</option>
                <option value="female">{tr('여성', 'Female', '女', '女性')}</option>
                <option value="other">{tr('기타', 'Other', '其他', 'その他')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">Age</label>
              <select value={age} onChange={e => setAge(e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-base font-medium text-zinc-900 focus:outline-none focus:border-pace-500">
                <option value="">{tr('선택 안함', 'Not selected', '不选择', '未選択')}</option>
                <option value="10s">{tr('10대', 'Teens', '10多岁', '10代')}</option>
                <option value="20s">{tr('20대', '20s', '20多岁', '20代')}</option>
                <option value="30s">{tr('30대', '30s', '30多岁', '30代')}</option>
                <option value="40s">{tr('40대 이상', '40s+', '40岁以上', '40代以上')}</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">Nationality</label>
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input value={nationality} onChange={e => setNationality(e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl pl-10 pr-4 py-3 text-base font-medium text-zinc-900 focus:outline-none focus:border-pace-500" placeholder={tr('예: 한국, USA, Japan...', 'e.g. Korea, USA, Japan...', '例:韩国、USA、Japan...', '例:韓国、USA、Japan...')} />
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-pace-600 transition-all disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> {tr('변경사항 저장', 'Save Changes', '保存修改', '変更を保存')}</>}
        </button>

        {pushSupported && (
          <Card className="p-5 flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${pushSubscribed ? 'bg-pace-50 text-pace-500' : 'bg-zinc-100 text-zinc-400'}`}>
                {pushSubscribed ? <Bell size={18} /> : <BellOff size={18} />}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-zinc-900">{tr('알림 설정', 'Notifications', '通知设置', '通知設定')}</p>
                <p className="text-xs text-zinc-400 truncate">{tr('매주 목요일 핫플랭킹 알림을 받아보세요', 'Get the hotplace ranking alert every Thursday', '每周四接收热门排名通知', '毎週木曜日にホットプレイスランキング通知を受け取る')}</p>
              </div>
            </div>
            <Switch
              checked={pushSubscribed}
              onCheckedChange={() => (pushSubscribed ? pushUnsubscribe() : pushSubscribe())}
              disabled={pushLoading}
              aria-label={tr('알림 토글', 'Toggle notifications', '切换通知', '通知切り替え')}
            />
          </Card>
        )}

        <div className="pt-8 border-t border-zinc-200">
          <button
            onClick={handleDeleteAccount}
            className="w-full py-4 bg-rose-50 text-rose-500 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-all"
          >
            <Trash2 size={20} /> {tr('회원 탈퇴', 'Delete Account', '注销账户', '退会する')}
          </button>
        </div>

      </main>
    </div>
  );
}
