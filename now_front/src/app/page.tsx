import type { Metadata } from 'next';
import HomeClient from './HomeClient';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

// 홈은 자기참조 canonical만 명시(root layout에서 alternates를 제거해, 이게 없으면 canonical이
// 아예 안 붙음). 홈의 ?lang= 다국어는 root 경로+쿼리라 Next가 hreflang URL에서 쿼리를 정규화로
// 떨궈 신호가 깨지고, 원래 홈(앱 셸)의 다국어 SEO 가치도 약함 — 실제 다국어 색인 무게는 상세페이지
// (posts/[id], hreflang 정상)와 전용 /en·/zh·/ja/ranking 페이지가 담당하므로 홈엔 hreflang 생략.
const BASE_URL = 'https://now.nemoneai.com';

interface Props {
  searchParams: Promise<{
    mood?: string;
    tab?: string;
    sub?: string;
    region?: string;
    category?: string;
    category_tag?: string;
    lang?: string;
  }>;
}

type Lang = 'ko' | 'en' | 'zh' | 'ja';
function pickLang(lang?: string): Lang {
  return lang === 'en' || lang === 'zh' || lang === 'ja' ? lang : 'ko';
}

// tab=list&region=, tab=list&category= 조합에서 실제로 다른 지역/카테고리 목록이 노출되는데도
// description은 전부 홈 기본값을 그대로 상속받아 네이버 서치어드바이저가 "동일한 description인
// 문서 다수 발견"으로 진단(2026-09-20, 194건 진단 CSV로 확인). region/category 라벨은
// HomeClient.tsx의 REGION_LABEL/CATEGORY_LABEL과 값을 맞춰뒀다(필터가 400 안 나게 하려면 값 자체는
// 백엔드 기준이라 안 건드림 — 여기선 표시용 텍스트만 다국어로 준비).
const REGION_TEXT: Record<string, Record<Lang, string>> = {
  '성수': { ko: '성수', en: 'Seongsu', zh: '圣水洞', ja: 'ソンス' },
  '홍대': { ko: '홍대', en: 'Hongdae', zh: '弘大', ja: 'ホンデ' },
  '강북': { ko: '강북', en: 'Gangbuk', zh: '江北', ja: 'カンブク' },
  '강남': { ko: '강남', en: 'Gangnam', zh: '江南', ja: 'カンナム' },
  '부산': { ko: '부산', en: 'Busan', zh: '釜山', ja: '釜山' },
  '제주': { ko: '제주', en: 'Jeju', zh: '济州', ja: '済州' },
  '공연': { ko: '서울 공연', en: 'Seoul concert', zh: '首尔演出', ja: 'ソウル公演' },
  '축제': { ko: '전국 축제', en: 'festival', zh: '全国节庆', ja: '全国のお祭り' },
};

const CATEGORY_TEXT: Record<string, Record<Lang, string>> = {
  popup: { ko: '팝업스토어', en: 'pop-up store', zh: '快闪店', ja: 'ポップアップストア' },
  class: { ko: '체험 클래스', en: 'experience class', zh: '体验课程', ja: '体験クラス' },
  shopping: { ko: '쇼핑', en: 'shopping', zh: '购物', ja: 'ショッピング' },
  '전시': { ko: '전시', en: 'exhibition', zh: '展览', ja: '展示' },
  '행사': { ko: '행사', en: 'event', zh: '活动', ja: 'イベント' },
};

function rankedDescription(nounKo: string, noun: string, lang: Lang): string {
  if (lang === 'en') return `See ${noun} trending right now, ranked in real time by NEMONE PACE`;
  if (lang === 'zh') return `实时查看当下热门的${noun}排行榜`;
  if (lang === 'ja') return `今人気の${noun}をリアルタイムランキングでチェック`;
  return `지금 인기 있는 ${nounKo}을(를) 실시간 랭킹으로 확인하세요`;
}

const MAP_TEXT: Record<Lang, { title: string; description: string }> = {
  ko: { title: 'NEMONE PACE | 지도로 보는 실시간 인기 팝업', description: '지금 뜨는 팝업스토어·행사 위치를 지도에서 한눈에 확인하세요' },
  en: { title: 'NEMONE PACE | Live Pop-up Map', description: 'See trending pop-up store locations on the map in real time' },
  zh: { title: 'NEMONE PACE | 实时人气快闪店地图', description: '在地图上实时查看热门快闪店和活动位置' },
  ja: { title: 'NEMONE PACE | リアルタイム人気ポップアップ地図', description: '今話題のポップアップストアの位置を地図でチェック' },
};

// category_tag(패션/뷰티/캐릭터/애니웹툰/엔터/종합)는 지역과 무관한 장르 필터라, CategoryBrowser.tsx의
// CATEGORY_TAGS와 값을 맞춰뒀다. 영문 표기가 코드베이스 어디에도 없는 값이라(태그 자체가 국내
// 전용 장르 분류) mood와 동일하게 번역을 지어내지 않고 한국어로만 구분한다.
const CATEGORY_TAG_DESC: Record<string, string> = {
  '패션': '지금 인기 있는 패션 팝업스토어를 실시간 랭킹으로 확인하세요',
  '뷰티': '지금 인기 있는 뷰티 팝업스토어를 실시간 랭킹으로 확인하세요',
  '캐릭터': '지금 인기 있는 캐릭터 팝업스토어를 실시간 랭킹으로 확인하세요',
  '애니웹툰': '지금 인기 있는 애니·웹툰 팝업스토어를 실시간 랭킹으로 확인하세요',
  '엔터': '지금 인기 있는 엔터 팝업스토어를 실시간 랭킹으로 확인하세요',
  '종합': '지금 인기 있는 팝업스토어를 종합 실시간 랭킹으로 확인하세요',
};

// 무드/매거진/지역/카테고리 쿼리 변형이 전부 홈과 같은 <title>·<description>을 써서 네이버
// 서치어드바이저가 "동일 문서 다수 발견"으로 진단한 문제(title: 2026-09-05, description:
// 2026-09-20 — 둘은 별개 진단이라 이번에 description도 채운다). canonical은 hreflang 문제
// 때문에 계속 홈을 가리키게 그대로 두되(변경 안 함), title·description만 실제 노출되는
// 내용과 맞게 구분해 "완전히 동일한 문서"라는 신호를 줄인다.
// title은 "NEMONE PACE | ..."로 브랜드를 맨 앞에 둔다 — 이 페이지(root와 동일 세그먼트)는
// layout.tsx의 title.template이 적용되지 않아 직접 접두사를 붙여야 한다(2026-09-20, 브랜드명
// 검색 대응으로 template 방향을 통일하면서 홈의 각 분기도 같이 맞춤).
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { mood, tab, sub, region, category, category_tag, lang: langParam } = await searchParams;
  const lang = pickLang(langParam);

  // tab=rec는 홈과 완전히 동일한 추천 피드 콘텐츠라 title/description을 억지로 다르게
  // 붙이면 오히려 부정확한 신호라 2026-09-05에 의도적으로 그대로 뒀었는데, 네이버가 "동일
  // description 문서"로 계속 재지적함(2026-09-20). 콘텐츠를 억지로 다르게 꾸미는 대신
  // noindex로 진단 대상 자체에서 빼는 쪽으로 결정 — 홈과 내용이 같아 색인 가치도 낮다.
  if (tab === 'rec') {
    return { alternates: { canonical: BASE_URL }, robots: { index: false, follow: true } };
  }
  if (mood) {
    return {
      title: `NEMONE PACE | ${mood} 분위기 팝업 모음`,
      description: `${mood} 분위기의 인기 팝업스토어를 모아봤어요`,
      alternates: { canonical: BASE_URL },
    };
  }
  if (tab === 'magazine' && sub === 'mood') {
    return {
      title: 'NEMONE PACE | 무드별 팝업 모음',
      description: '무드별로 인기 팝업스토어를 골라보세요',
      alternates: { canonical: BASE_URL },
    };
  }
  if (tab === 'map') {
    return { ...MAP_TEXT[lang], alternates: { canonical: BASE_URL } };
  }
  if (tab === 'list' && (region || category)) {
    const regionText = region ? REGION_TEXT[region]?.[lang] : undefined;
    const categoryText = category ? CATEGORY_TEXT[category]?.[lang] : undefined;
    const regionKo = region ? REGION_TEXT[region]?.ko : undefined;
    const categoryKo = category ? CATEGORY_TEXT[category]?.ko : undefined;
    if (regionText || categoryText) {
      const nounKo = [regionKo, categoryKo].filter(Boolean).join(' ') || '핫플레이스';
      const noun = [regionText, categoryText].filter(Boolean).join(' ') || nounKo;
      return {
        title: `NEMONE PACE | ${nounKo} 실시간 인기 랭킹`,
        description: rankedDescription(nounKo, noun, lang),
        alternates: { canonical: BASE_URL },
      };
    }
  }
  if (category_tag && CATEGORY_TAG_DESC[category_tag]) {
    return {
      title: `NEMONE PACE | ${category_tag} 팝업스토어 랭킹`,
      description: CATEGORY_TAG_DESC[category_tag],
      alternates: { canonical: BASE_URL },
    };
  }
  return { alternates: { canonical: BASE_URL } };
}

// 홈의 기본(핫플/종합) 랭킹 데이터를 서버에서 미리 fetch — 예전엔 이 페이지 전체가
// 'use client'라 크롤러가 받는 초기 HTML에 카드/링크가 하나도 없었음(2026-08-10 확인).
// 인터랙션(탭 전환/지역 필터 등)은 그대로 HomeClient(클라이언트 컴포넌트)에 넘기고,
// 여기서는 첫 렌더에 실제 콘텐츠가 보이도록 초기 데이터만 서버에서 채운다.
async function getInitialPlaces() {
  try {
    const res = await fetch(`${BACKEND}/places/popular`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// 홈 "지역별로 발견하기" — 지역 대표 사진 에셋이 없어 각 지역 인기 1위 장소의 실제 사진을 재사용.
const DISCOVERY_REGIONS = ['성수', '홍대', '강북', '강남', '부산', '제주'] as const;

async function getRegionTopPlaces() {
  const results = await Promise.all(
    DISCOVERY_REGIONS.map(async (region) => {
      try {
        const res = await fetch(`${BACKEND}/places/popular?region=${encodeURIComponent(region)}&limit=1`, {
          next: { revalidate: 300 },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.[0] ? { region, place: data[0] } : null;
      } catch {
        return null;
      }
    })
  );
  return results.filter((r) => r !== null) as { region: string; place: any }[];
}

export default async function HomePage() {
  const [initialAllPlaces, regionTopPlaces] = await Promise.all([
    getInitialPlaces(),
    getRegionTopPlaces(),
  ]);
  return (
    <HomeClient
      initialAllPlaces={initialAllPlaces}
      regionTopPlaces={regionTopPlaces}
    />
  );
}
