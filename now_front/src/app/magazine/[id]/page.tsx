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
  // 2026-10-11까지는 원문(맛매치)으로 canonical을 몰아 나우 쪽은 중복으로 색인 제외시켰었음.
  // 사용자 결정(2026-10-11)으로 양쪽 다 독립 색인 — 중복 콘텐츠 리스크는 감수하기로 함.
  // 맛매치 /posts/{id}는 원래부터 자기 자신을 canonical로 가리키고 있어 그쪽은 손 안 댐.
  const canonical = `https://now.nemoneai.com/magazine/${id}`;

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
