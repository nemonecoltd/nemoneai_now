// SNS 공유(OG) 이미지 — 썸네일이 webp라 페이스북 크롤러가 못 읽는다(2026-11-05). 우리 저장소 이미지는 백엔드가
// JPEG 1200×630으로 바꿔 주는 주소를 쓰고, 그 밖의 URL은 원본 그대로 쓴다.
const OWN = 'https://storage.googleapis.com/nemoneai-thumbnails/'

export function ogImageFor(url: string | null | undefined, alt?: string) {
  if (!url) return null
  if (url.startsWith(OWN)) {
    return { url: `https://now.nemoneai.com/api-now/og-image?u=${encodeURIComponent(url)}`, width: 1200, height: 630, alt }
  }
  return { url, alt }
}
