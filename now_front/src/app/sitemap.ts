import { MetadataRoute } from 'next'

export const revalidate = 3600 // 1시간마다 사이트맵 재생성

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://now.nemoneai.com'
  
  // 1. 모든 장소/리스트 데이터 가져오기 (성수, 홍대, 테마 리스트 등)
  let places: any[] = []
  try {
    // 빌드 시점 및 런타임에 호출할 백엔드 API (Rewrites를 통해 8081로 전달됨)
    const res = await fetch(`${process.env.BACKEND_URL || 'http://127.0.0.1:8081'}/places`)
    if (res.ok) {
      const data = await res.json()
      places = Array.isArray(data) ? data : []
    }
  } catch (error) {
    console.error("Sitemap fetch error:", error)
  }

  // 2. 동적 상세 페이지 URL 생성 (개별 스팟 및 테마 장소)
  // 상세페이지는 ?lang= 쿼리로 4개 언어를 서빙하는데, 링크·메타데이터만으론 크롤러가
  // 언어판을 잘 발견하지 못함 — 대규모 사이트에선 sitemap의 hreflang(alternates.languages)이
  // 언어판 발견의 정석이라, 각 posts URL에 실제 번역이 있는 언어 + x-default를 실어준다.
  // 번역이 없는 로우(title_en/content_en 등이 빈 값)는 서버가 한국어로 폴백해 ko 페이지와
  // byte-identical한 중복이 되므로, 여기서 sitemap에 그 lang=xx URL을 흘리면 Google이
  // 그 URL을 대량으로 발견·크롤해 중복 클러스터의 대표로 잘못 뽑는 사고로 이어짐
  // (2026-09-18 — "nemone pace" 브랜드검색에 lang=en/ja 변형만 노출되던 원인).
  // page.tsx의 generateMetadata도 동일 기준(translated en/zh/ja)으로 canonical/noindex를 분기함.
  const placeUrls = places.map((place) => {
    const languages: Record<string, string> = {
      ko: `${baseUrl}/posts/${place.id}`,
      'x-default': `${baseUrl}/posts/${place.id}`,
    }
    if (place.title_en && place.content_en) languages.en = `${baseUrl}/posts/${place.id}?lang=en`
    if (place.title_zh && place.content_zh) languages.zh = `${baseUrl}/posts/${place.id}?lang=zh`
    if (place.title_ja && place.content_ja) languages.ja = `${baseUrl}/posts/${place.id}?lang=ja`
    return {
      url: `${baseUrl}/posts/${place.id}`,
      lastModified: new Date(place.created_at || new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
      alternates: { languages },
    }
  })

  // 3. 고정 페이지 URL 생성 (홈 화면 + 랭킹 페이지)
  // /ranking/place만 title_en/title_zh/title_ja 데이터가 있어 en/zh/ja 버전 존재 — course/theme는 유저생성 콘텐츠라 번역본 없음
  const placeRankingLanguages = {
    ko: `${baseUrl}/ranking/place`,
    en: `${baseUrl}/en/ranking/place`,
    zh: `${baseUrl}/zh/ranking/place`,
    ja: `${baseUrl}/ja/ranking/place`,
  }
  const staticUrls = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1.0 },
    { url: `${baseUrl}/ranking/course`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${baseUrl}/ranking/theme`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${baseUrl}/ranking/place`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8, alternates: { languages: placeRankingLanguages } },
    { url: `${baseUrl}/en/ranking/place`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.6, alternates: { languages: placeRankingLanguages } },
    { url: `${baseUrl}/zh/ranking/place`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.6, alternates: { languages: placeRankingLanguages } },
    { url: `${baseUrl}/ja/ranking/place`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.6, alternates: { languages: placeRankingLanguages } },
  ]

  // 지역별 팝업 랭킹 허브 — "성수 팝업" 같은 헤드키워드를 잡기 위한 상시 갱신 페이지
  // (URL은 영문 슬러그 — output:'standalone'이 한글 동적 세그먼트 정적 페이지를 못 찾는 버그 회피)
  // 다국어(en/zh/ja) 버전도 함께 생성, hreflang alternates로 연결
  const regionSlugs = ['seongsu', 'hongdae', 'gangbuk', 'gangnam', 'busan', 'jeju']
  const placeRegionUrls = regionSlugs.flatMap((slug) => {
    const languages = {
      ko: `${baseUrl}/ranking/place/${slug}`,
      en: `${baseUrl}/en/ranking/place/${slug}`,
      zh: `${baseUrl}/zh/ranking/place/${slug}`,
      ja: `${baseUrl}/ja/ranking/place/${slug}`,
    }
    return [
      { url: languages.ko, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.75, alternates: { languages } },
      { url: languages.en, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.55, alternates: { languages } },
      { url: languages.zh, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.55, alternates: { languages } },
      { url: languages.ja, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.55, alternates: { languages } },
    ]
  })

  return [...staticUrls, ...placeRegionUrls, ...placeUrls]
}
