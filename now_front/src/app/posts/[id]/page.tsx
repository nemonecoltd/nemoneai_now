import { Metadata } from 'next';
import PlaceDetailClient, { Place } from './PlaceDetailClient';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

async function getPlace(id: string): Promise<Place | null> {
  try {
    const res = await fetch(`${BACKEND}/places/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getSuggestions(excludeId: string, region: string): Promise<Place[]> {
  try {
    const res = await fetch(`${BACKEND}/places?region=${encodeURIComponent(region)}&limit=30`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const all: Place[] = await res.json();
    const pool = all.filter((p) => p.id !== Number(excludeId) && p.image_url);
    return pool.sort(() => Math.random() - 0.5).slice(0, 15);
  } catch {
    return [];
  }
}

function cleanDescription(raw: string): string {
  const flat = raw
    .replace(/\r?\n+/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= 160) return flat;
  const cut = flat.slice(0, 160);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 100 ? cut.slice(0, lastSpace) : cut).trim() + '...';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlace(id);
  const canonical = `https://now.nemoneai.com/posts/${id}`;

  if (!place) {
    return {
      title: `운영 종료된 팝업·행사 #${id}`,
      description: `#${id} 팝업·행사는 운영 기간이 종료되어 더 이상 조회할 수 없습니다. 지금 가볼 만한 다른 핫플을 확인해보세요.`,
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  const title = (place.title_en && place.title_en !== place.title)
    ? `${place.title} · ${place.title_en}`
    : place.title;
  const description = cleanDescription(place.content || '');

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: place.image_url ? [{ url: place.image_url, alt: place.title }] : ['/og-image.png'],
      type: 'article',
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: place.image_url ? [place.image_url] : ['/og-image.png'],
    },
  };
}

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang = 'ko' } = await searchParams;

  const place = await getPlace(id);
  const suggestions = place ? await getSuggestions(id, place.region || '성수') : [];

  return <PlaceDetailClient place={place} lang={lang} suggestions={suggestions} />;
}
