import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PlaceDetailClient, { Place } from './PlaceDetailClient';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

// 백엔드가 명시적으로 404를 준 경우에만 "진짜로 없음"으로 취급해 notFound() 처리한다.
// 5xx나 네트워크 오류(백엔드 재시작·순간 부하 등)까지 같은 취급하면, 실제로는 멀쩡한
// 장소가 크롤러 접속 타이밍에 우연히 실패했다는 이유만으로 진짜 404를 받아 색인에서
// 빠질 위험이 있다 — 이 경우엔 에러를 던져 Next 에러 바운더리(5xx)로 넘긴다.
async function getPlace(id: string): Promise<Place | null> {
  // 봇이 /posts/robots.txt 같은 비숫자 경로를 긁으면 백엔드가 422를 주고, 그게 아래
  // "!res.ok → throw"에 걸려 500 에러 페이지가 나가던 문제(크롤 예산 낭비) — id가 숫자가
  // 아니면 백엔드를 때리지 않고 곧바로 없음(→ notFound → 정상 404) 처리(2026-08-10).
  if (!/^\d+$/.test(id)) return null;
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

// "이 지역 인기장소" — /places/popular?region=X는 ranking_service.py의 인기 랭킹 캐시(조회+좋아요
// 가중치) 그대로라 무작위 추천(getSuggestions)과 달리 실제 순위를 보여준다. 현재 보고 있는
// 장소가 자기 지역 순위에 떠 있을 수 있어 여유 있게 4개 받아 제외 후 3개로 자른다(2026-09-07,
// "추천! 인기코스"를 지역 활동성 강화 목적으로 교체).
async function getRegionTop3(excludeId: string, region: string): Promise<Place[]> {
  try {
    const res = await fetch(`${BACKEND}/places/popular?region=${encodeURIComponent(region)}&limit=4`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const all: Place[] = await res.json();
    return all.filter((p) => p.id !== Number(excludeId)).slice(0, 3);
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

const BASE_URL = 'https://now.nemoneai.com';
const OG_LOCALE: Record<string, string> = { ko: 'ko_KR', en: 'en_US', zh: 'zh_CN', ja: 'ja_JP' };

// 언어별 상세페이지 URL — 한국어는 기본(쿼리 없음), 나머지는 ?lang= 부착.
// hreflang/canonical이 서로 정확히 일치해야(reciprocal) 검색엔진이 언어판을 올바로 묶는다.
function postUrl(id: string, lang: string): string {
  return lang === 'ko' ? `${BASE_URL}/posts/${id}` : `${BASE_URL}/posts/${id}?lang=${lang}`;
}
function normalizeLang(raw?: string): 'ko' | 'en' | 'zh' | 'ja' {
  return raw === 'en' || raw === 'zh' || raw === 'ja' ? raw : 'ko';
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lang = normalizeLang((await searchParams).lang);
  const place = await getPlace(id);

  if (!place) {
    notFound();
  }

  // 언어별 제목/본문 — 번역이 없는 로우는 한국어로 자연 폴백(에러 없이 그 페이지만 한국어 노출)
  const title =
    lang === 'en' ? (place.title_en || place.title)
    : lang === 'zh' ? (place.title_zh || place.title)
    : lang === 'ja' ? (place.title_ja || place.title)
    : place.title;
  const rawContent =
    lang === 'en' ? (place.content_en || place.content)
    : lang === 'zh' ? (place.content_zh || place.content)
    : lang === 'ja' ? (place.content_ja || place.content)
    : place.content;
  const description = cleanDescription(rawContent || '');

  // 실제 번역 로우가 있는 언어만 "진짜 언어판"으로 취급한다. 번역이 비어 있어 한국어로
  // 폴백된 lang=xx 페이지는 ko 페이지와 byte-identical한 중복 콘텐츠인데, 예전엔 이런
  // 페이지도 자기참조 canonical + index,follow를 걸어 Google이 ko/en/zh/ja 4개를
  // 별개의 정본으로 인식 → 중복 클러스터에서 엉뚱하게 lang=ja/en 쪽을 대표로 뽑아버리는
  // 사고가 실제로 확인됨(2026-09-18, "nemone pace" 브랜드검색에 en/ja 변형만 노출).
  const translated = {
    en: Boolean(place.title_en && place.content_en),
    zh: Boolean(place.title_zh && place.content_zh),
    ja: Boolean(place.title_ja && place.content_ja),
  };
  const hasRealTranslation = lang === 'ko' || translated[lang];

  // hreflang에는 실제로 번역이 존재하는 언어판만 올린다 — 없는 언어를 올리면 그 alternate가
  // noindex라서 Google이 hreflang 자체를 무시/혼란스러워함.
  const languages: Record<string, string> = {
    ko: postUrl(id, 'ko'),
    'x-default': postUrl(id, 'ko'),
  };
  if (translated.en) languages.en = postUrl(id, 'en');
  if (translated.zh) languages.zh = postUrl(id, 'zh');
  if (translated.ja) languages.ja = postUrl(id, 'ja');

  // 번역이 실재할 때만 자기참조 canonical(=그 언어판이 정본). 번역이 없어 한국어로
  // 폴백된 경우엔 canonical을 ko 기본 URL로 돌리고 noindex를 걸어 중복으로 색인되지 않게 함.
  const canonical = hasRealTranslation ? postUrl(id, lang) : postUrl(id, 'ko');

  return {
    title,
    description,
    alternates: { canonical, languages },
    ...(hasRealTranslation ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url: canonical,
      images: place.image_url ? [{ url: place.image_url, alt: title }] : ['/og-image.png'],
      type: 'article',
      locale: OG_LOCALE[lang],
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
  const [suggestions, regionTop3] = await Promise.all([
    getSuggestions(id, place.region || '성수', popupCategoryGroup(place.category)),
    getRegionTop3(id, place.region || '성수'),
  ]);

  return <PlaceDetailClient place={place} lang={lang} suggestions={suggestions} regionTop3={regionTop3} />;
}
