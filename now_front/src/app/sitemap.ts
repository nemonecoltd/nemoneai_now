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
  const staticUrls = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1.0 },
    { url: `${baseUrl}/ranking/course`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${baseUrl}/ranking/theme`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${baseUrl}/ranking/place`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
  ]

  return [...staticUrls, ...placeUrls]
}
