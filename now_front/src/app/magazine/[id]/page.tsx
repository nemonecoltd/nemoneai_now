import { Metadata } from 'next';
import MagazineDetailClient from './MagazineDetailClient';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

export interface MagazinePost {
  id: number;
  title: string;
  body_text: string;
  image_url?: string;
  category?: string;
  created_at?: string;
}

async function getPost(id: string): Promise<MagazinePost | null> {
  try {
    const res = await fetch(`${BACKEND}/magazine/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 150);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  // 원문 소유자는 맛매치(nemoneai.com) — 검색 색인/정본은 그쪽으로 유지하고
  // 나우 페이지는 앱 내 열람 UX로만 제공 (중복 콘텐츠로 잡히지 않도록 canonical을 원문으로 지정)
  const canonical = `https://nemoneai.com/posts/${id}`;

  if (!post) {
    return { title: `매거진 #${id}`, alternates: { canonical } };
  }

  const description = stripHtml(post.body_text || '');

  return {
    title: post.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description,
      url: canonical,
      images: post.image_url ? [{ url: post.image_url, alt: post.title }] : ['/og-image.png'],
      type: 'article',
      locale: 'ko_KR',
    },
  };
}

export default async function MagazinePostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang = 'ko' } = await searchParams;
  const post = await getPost(id);
  return <MagazineDetailClient post={post} lang={lang} />;
}
