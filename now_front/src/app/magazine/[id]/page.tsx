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

// PACE 소속 기사(맛매치 Special #5)만 이 페이지가 정본. 사이드카 등이 연결하는 그 밖의 맛매치 기사 /magazine/N은
// 종전처럼 맛매치 /posts/N이 정본(조회 실패 시에도 이쪽으로 폴백 — 중복 색인 방지).
async function isOwned(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND}/magazine`, { next: { revalidate: 300 } });
    if (!res.ok) return false;
    const list = await res.json();
    return Array.isArray(list) && list.some((m: { id: number }) => String(m.id) === String(id));
  } catch {
    return false;
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
  // 2026-10-24: 색인·정본을 이 서비스(PACE) 쪽으로 옮김 — PACE 소속 기사(맛매치 Special #5)는 여기가 주인이고,
  // 맛매치 /posts/N이 정본을 이 URL로 가리킨다. ?lang= 변형은 UI 문구만 다르고 본문은 같아 모두 이 URL로 모은다.
  const owned = await isOwned(id);
  const canonical = owned ? `https://now.nemoneai.com/magazine/${id}` : `https://nemoneai.com/posts/${id}`;

  if (!post) {
    return { title: `매거진 #${id}`, alternates: { canonical }, robots: { index: false, follow: false } };
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
      siteName: 'NEMONE PACE',
      publishedTime: post.created_at,
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
  const owned = post ? await isOwned(id) : false;
  const jsonLd = post && owned && {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: stripHtml(post.body_text || ''),
    image: post.image_url ? [post.image_url] : undefined,
    datePublished: post.created_at,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://now.nemoneai.com/magazine/${post.id}` },
    author: { '@type': 'Organization', name: 'NEMONE' },
    publisher: { '@type': 'Organization', name: 'NEMONE PACE', logo: { '@type': 'ImageObject', url: 'https://now.nemoneai.com/icon-512.png' } },
  };
  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <MagazineDetailClient post={post} lang={lang} />
    </>
  );
}
