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
  const placeUrls = places.map((place) => ({
    url: `${baseUrl}/posts/${place.id}`,
    lastModified: new Date(place.created_at || new Date()),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

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
