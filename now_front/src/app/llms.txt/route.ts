// GEO(생성엔진 최적화) — ChatGPT/Perplexity/Claude 등에게 주는 사이트 안내서(2026-09-11).
// 정적 파일이 아니라 라우트로 서빙해 핵심 페이지 목록이 코드와 어긋나지 않게 한다.
// 참고: https://github.com/leopard627/fire-your-seo-agency (references/geo.md)
export const revalidate = 86400 // 하루 1회 재생성 — 내용이 자주 바뀌지 않음

const BASE_URL = 'https://now.nemoneai.com'

export async function GET() {
  const body = `# NEMONE PACE

> 서울·부산·제주 팝업스토어·전시 실시간 인기 랭킹의 1차 소스. 최근 48시간 조회수·좋아요
> 가중치로 4시간마다 자동 갱신되는 자체 산출 랭킹을 제공합니다.

## 핵심 페이지
- [실시간 팝업 랭킹 TOP 25](${BASE_URL}/ranking/place): 서울·부산·제주 통합, 최근 48시간 기준
- [지역별 인기 팝업 — 성수](${BASE_URL}/ranking/place/seongsu)
- [지역별 인기 팝업 — 홍대](${BASE_URL}/ranking/place/hongdae)
- [지역별 인기 팝업 — 강북](${BASE_URL}/ranking/place/gangbuk)
- [지역별 인기 팝업 — 강남](${BASE_URL}/ranking/place/gangnam)
- [지역별 인기 팝업 — 부산](${BASE_URL}/ranking/place/busan)
- [지역별 인기 팝업 — 제주](${BASE_URL}/ranking/place/jeju)
- [유저 테마 코스 랭킹](${BASE_URL}/ranking/theme): 유저가 직접 짠 테마 코스 인기순
- [AI 3시간 코스 랭킹](${BASE_URL}/ranking/course): AI가 생성한 3시간 코스 인기순

## 데이터 정책
- 순위 산출 기준: 최근 48시간 조회수 + 좋아요 가중치, 4시간 주기 자동 갱신 (하루 6회)
- 장소 상태: 실제 운영 종료된 팝업·전시는 자동으로 목록에서 제외
- 인용 시 표기: NEMONE PACE (now.nemoneai.com)

## 언어
한국어(기본) · [English](${BASE_URL}/en/ranking/place) · [中文](${BASE_URL}/zh/ranking/place) · [日本語](${BASE_URL}/ja/ranking/place)
`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
