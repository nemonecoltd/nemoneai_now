import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PlaceDetailClient, { Place } from './PlaceDetailClient';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

// 백엔드가 명시적으로 404를 준 경우에만 "진짜로 없음"으로 취급해 notFound() 처리한다.
// 5xx나 네트워크 오류(백엔드 재시작·순간 부하 등)까지 같은 취급하면, 실제로는 멀쩡한
// 장소가 크롤러 접속 타이밍에 우연히 실패했다는 이유만으로 진짜 404를 받아 색인에서
// 빠질 위험이 있다 — 이 경우엔 에러를 던져 Next 에러 바운더리(5xx)로 넘긴다.
async function getPlace(id: string): Promise<Place | null> {
  const res = await fetch(`${BACKEND}/places/${id}`, {
    next: { revalidate: 300 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /places/${id} failed: ${res.status}`);
  return res.json();
}

// '이런 곳도 있어요' 추천 풀 — 팝업/전시는 자기 카테고리끼리만, 클래스+쇼핑은 '상시 운영' 성격이 같아 하나로 묶음.
// 공연 장르(연극/뮤지컬/음악/종합)·제주 행사 등은 이번 범위 밖이라 null을 반환해 기존처럼 지역 전체에서 추천.
function popupCategoryGroup(category?: string | null): 'popup' | 'living' | '전시' | null {
  if (category === 'class' || category === 'shopping') return 'living';
  if (category === '전시') return '전시';
  if (!category || category === 'popup') return 'popup';
  return null;
}

async function getSuggestions(excludeId: string, region: string, group: 'popup' | 'living' | '전시' | null): Promise<Place[]> {
  try {
    let all: Place[] = [];
    if (group === 'living') {
      const [classRes, shopRes] = await Promise.all([
        fetch(`${BACKEND}/places?region=${encodeURIComponent(region)}&category=class&limit=20`, { next: { revalidate: 300 } }),
        fetch(`${BACKEND}/places?region=${encodeURIComponent(region)}&category=shopping&limit=20`, { next: { revalidate: 300 } }),
      ]);
      const [classData, shopData] = await Promise.all([
        classRes.ok ? classRes.json() : [],
        shopRes.ok ? shopRes.json() : [],
      ]);
      all = [...classData, ...shopData];
    } else {
      const categoryParam = group ? `&category=${encodeURIComponent(group)}` : '';
      const res = await fetch(`${BACKEND}/places?region=${encodeURIComponent(region)}&limit=30${categoryParam}`, { next: { revalidate: 300 } });
      if (!res.ok) return [];
      all = await res.json();
    }
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
    notFound();
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
  if (!place) {
    notFound();
  }
  const suggestions = await getSuggestions(id, place.region || '성수', popupCategoryGroup(place.category));

  return <PlaceDetailClient place={place} lang={lang} suggestions={suggestions} />;
}
