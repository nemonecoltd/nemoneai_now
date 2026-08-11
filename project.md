📄 Project Specs: 오늘 성수 (Now Seongsu)
1. 프로젝트 개요 (Overview)
서비스명: 오늘 성수 (Now Seongsu)
도메인: now.nemoneai.com (기존 nemoneai.com과 물리적/논리적 분리 운영)
핵심 가치: 성수동 로컬 팝업/이벤트 데이터를 실시간 수집(RAG)하여, AI 가이드가 최적의 관광 여정을 설계해 주는 고성능 웹 서비스.
기술 철학: 구글 에코시스템(GCP, Gemini, Vertex AI) 기반의 기술 통일 및 서버 내부(Internal) 로직 중심의 데이터 보안.

2. 기술 스택 명세 (Tech Stack)
Language: Python 3.10+ (Backend), TypeScript (Frontend)
Framework: FastAPI (Backend), Next.js 14+ App Router (Frontend)
AI/LLM: Google Gemini 2.5 Flash (스크래핑 정제/추론), Vertex AI Text-Embedding-004 (Vectorizing)
  ※ 구 gemini-pro-latest / google.generativeai SDK → google.genai SDK + gemini-2.5-flash 전환 완료 (2026-05-29)
Database: PostgreSQL + pgvector (Vector similarity search)
Infrastructure: GCP VM Instance, Nginx (Reverse Proxy)
Scraping: Playwright (API 응답 인터셉션 방식) — 네이버 지도 allSearch API 직접 가로채기

3. 개발 및 데이터 원칙 (Critical Guidelines)
데이터 무결성: 모든 데이터 호출은 서버 내부망 주소(http://127.0.0.1:8080)를 사용하며, 외부 SaaS(n8n 등) 사용을 금지하고 내부 로직으로 구현한다.
휘발성 관리: 성수동 데이터는 신선도가 핵심이므로, 생성일 기준 30일이 경과한 데이터는 DB에서 자동 삭제하는 TTL 로직을 반드시 포함한다.


보존 원칙: '더 나은 제안'이라는 명목으로 원본 로직을 임의로 삭제하거나 설계를 훼손하지 않는다. 필드명 video_url은 반드시 고정한다.

🛠️ CLI 작업 지시 가이드 (Prompt for CLI)
CLI에게 첫 작업을 시킬 때 아래 내용을 입력하십시오.

"너는 이제 네모네 주식회사의 CTO 정환석님의 스타일로 코딩하는 AI 개발자야. 현재 프로젝트 Now Seongsu는 로컬 환경에서 서버 DB에 SSH 터널링(Port 5433)으로 연결되어 있어. 아래 미션을 수행해줘."

기반 파일 인식: 제공된 database.py, gemini_service.py, models.py를 분석해서 프로젝트 구조를 파악해.
Main 로직 구현: main.py를 완성해. 성수동 팝업 정보를 입력받아 벡터화 후 저장하는 /collect와, 질문에 답하는 /ask API가 핵심이야.
데이터 삭제: APScheduler 등을 사용하여 매일 자정에 30일 지난 데이터를 지우는 백그라운드 태스크를 추가해.
연결: 프론트엔드 시안(파일)을 분석해서, 이 API들과 연동되는 실시간 리스트 및 채팅 화면을 Next.js로 이식해.

4. 디렉토리 설명
- now/now_front/ 프론트엔드 UI파일이 들어있음
- now/now_back/ 백엔드 디렉토리

5. 맛매치와 차이점
'오늘 성수'는 맛매치(MatMatch)와 달리 SSG(Static Site Generation) 비중이 매우 낮거나 거의 없는 '다이나믹 앱'
  구조이기 때문에 빌드가 훨씬 쉽고 빠릅니다.

  그 이유를 세 가지로 정리해 드릴게요.


  1. 빌드 시점에 데이터를 가져오지 않음
   * 맛매치: SEO(검색 최적화)를 위해 수백 개의 게시글을 빌드할 때 미리 구워서 정적 HTML로 만듭니다. 그래서 빌드 중에 백엔드가 꺼져 있으면
     바로 에러가 났던 것입니다.
   * 오늘 성수: 리스트나 지도의 데이터를 브라우저가 뜬 다음에 useEffect로 가져오는 CSR(Client-Side Rendering) 방식입니다. 빌드 시점에는 "텅
     빈 껍데기"만 만들기 때문에 백엔드가 켜져 있든 말든 빌드는 아주 쉽게 성공합니다.


  2. generateStaticParams를 쓰지 않음
   * 맛매치 배포의 주범이었던 generateStaticParams 로직이 현재 오늘 성수에는 들어가 있지 않습니다. 이 함수는 빌드 시점에 모든 가능 경로를
     체크하며 DB를 훑는데, 오늘 성수는 실시간성이 중요해서 사용자가 들어올 때 데이터를 가져오도록 설계했습니다.


  3. 실시간 AI와 개인화 기능 위주
   * AI 코스 생성이나 마이페이지, 채팅 같은 기능들은 사용자마다 내용이 다른 '개인화 데이터'입니다. 이런 데이터는 미리 정적으로 만들 수가
     없기 때문에 100% 다이나믹하게 작동해야 합니다.


  요약하자면:
  맛매치는 "도서관의 책(정적인 정보)" 같은 서비스라 미리 다 인쇄(SSG)해두느라 고생하는 것이고, 오늘 성수는 "실시간 가이드(동적인 정보)" 같은
  서비스라 그때그때 대답하는 방식이라 빌드 과정이 매우 가볍습니다.


  그래서 오늘 성수는 나중에 서버에 올릴 때도 맛매치처럼 복잡한 과정을 거치지 않고 훨씬 수월하게 배포될 것입니다!

  4. 타이틀 변경 및 스팟 확대
  '오늘 성수'에서 '지금 여기'로 확대 개편. 성수, 홍대 등 지속 스팟 확보 예정

  5. 다국어 서비스 도입
  영어 서비스 추가하여 이후 다양한 언어로 확대 예정

  6. 기타
  검색 대응 완료 후 검색 유입 대응


---

## 📋 작업 로그

### 2026-05-29 — 수집 파이프라인 전면 정비

#### 1. google.genai SDK 마이그레이션
- **변경 파일**: `scraper_naver_map.py`, `scraper_naver_map_hongdae.py`
- **내용**: `google.generativeai` (deprecated) → `google.genai` SDK 전환
  - 구: `import google.generativeai as genai` / `genai.GenerativeModel("models/gemini-pro-latest")`
  - 신: `from google import genai as _genai` / `_client.models.generate_content(model="gemini-2.5-flash", ...)`
- **이유**: google.generativeai 패키지 공식 지원 종료. gemini-2.0-flash도 신규 사용자 404 반환 → gemini-2.5-flash로 확정

#### 2. 네이버 지도 스크래퍼 v2 신규 작성 (`scraper_naver_map_v2.py`)
- **방식 변경**: DOM 파싱(실패) → Playwright API 응답 인터셉션
  - `page.on("response", ...)` 로 브라우저가 호출하는 `allSearch` API 응답을 직접 가로챔
  - ncaptcha 우회: 브라우저 세션/쿠키 그대로 사용하므로 차단 없음
- **수집 항목**: 장소명, 영문명, 주소, 위경도, 썸네일 이미지(`thumUrl`), 카테고리, 영업 상태, 전화번호
- **결과**: 1페이지 기준 최대 20개 구조화 데이터 안정 수집
- **범용 설계**: `query` 파라미터로 검색어 주입 → 성수/홍대 공용 사용

#### 3. `collector_v3.py` (성수) 오류 수정 및 image_url 추가
- `return_exceptions=True` 추가: 팝가 scraper TimeoutError 발생 시 전체 크래시 방지
- `scraper_popga.py`: `wait_until='networkidle'` → `'domcontentloaded'`, timeout 60초로 완화
- `scraper_naver_map` import → `scraper_naver_map_v2`로 교체
- DB upsert 쿼리에 `image_url` 컬럼 추가 (`COALESCE` 패턴으로 기존 이미지 보존)
- `scraper_seoul_api.py`: 사용하지 않는 genai import 제거

#### 4. `collector_v3_hongdae.py` (홍대) 동일 정비
- v2 스크래퍼로 교체: `scrape_naver_map_popups("홍대 팝업스토어")`
- `return_exceptions=True` 추가, 소스별 실패 로그 출력
- image_url INSERT/UPSERT 추가
- `scraper_seoul_api_hongdae.py`: 사용하지 않는 genai import 제거
- **테스트 결과**: 네이버지도 20개 + 서울시API 8개 = 총 28개 수집 → DB 동기화 성공

#### 5. 공연 메뉴 신설 (`scraper_seoul_api_concert.py`, `collector_v3_concert.py`)
- 서울시 `culturalEventInfo` API의 `CODENAME` 필드로 공연 카테고리 필터링
  - 대상: 공연마당, 콘서트, 뮤지컬/오페라, 클래식/국악, 전통/무용, 연극
- 구 제한 없음 → 서울 전역 공연 수집 (최대 200개)
- `region = "공연"` 으로 저장 → DB/API 변경 없음, 기존 `?region=` 파라미터 그대로 작동
- **결정 배경**: 기존 '보넥도(테마형)' 메뉴를 공연으로 대체. 성수/홍대가 팝업 중심이므로 차별화

#### 6. 프론트엔드 — 공연 메뉴 반영
- **`page.tsx`**: `type Region` 및 지역 탭 `보넥도` → `공연` 교체. 지도/AI코스 탭 비활성 조건 동일 적용
- **`page.tsx`**: 플레이스 랭킹 데이터 소스 `/places` → `/places/popular` 교체 → 실제 좋아요 순 정렬
- **`PlaceList.tsx`**: 헤더 `공연 핫플레이스` → `서울 공연`, 검색 placeholder 공연용으로 분기
- **`Recommendation.tsx`**: 지역 배지 공연 추가 (보라색 `bg-purple-*`), `frameBorder` deprecated 속성 제거
- **`admin/page.tsx`**: 운영 탭 `보넥도` → `공연(CONCERT)` 교체 → DB 수정/삭제 가능

#### 7. Supabase Auth 락 충돌 수정 (`AuthContext.tsx`)
- **원인**: `createClient()`가 컴포넌트 내부에서 호출 → 렌더링마다 새 인스턴스 → localStorage 락 경합
- **수정**: `supabase` 클라이언트를 모듈 레벨 싱글톤으로 이동
- `getSession()` + `onAuthStateChange()` 동시 호출 제거 → `onAuthStateChange`의 `INITIAL_SESSION` 이벤트로 통일

#### 8. 통합 수집기 (`collector_total.py`) 신규 작성
- 3개 지역 콜렉터를 하나의 파일로 통합
- `dedup_by_title()`: 배치 내 타이틀 중복 항목 사전 제거 (임베딩 중복 생성 방지)
- `upsert_items()`: 공통 upsert 로직 분리
- 실행: `python3 collector_total.py` → 성수 → 홍대 → 공연 순차 수집

#### 9. Gemini 정제 로직 레거시화 확인
- 현재 수집 파이프라인은 모두 구조화 API (네이버지도 allSearch, 서울시 공공API) 사용
- 뉴스 raw text → Gemini 정제 방식은 `scraper_naver_map.py`, `scraper_naver_map_hongdae.py`, `scraper_theme.py`에만 잔존
- `collector_total.py`에서 참조하지 않으므로 사실상 레거시. Gemini는 임베딩 생성 및 AI 채팅/코스에서만 사용

---

#### 현재 수집 구조 (2026-05-29 기준)
| 지역 | 수집원 | 파일 |
|------|--------|------|
| 성수 | 네이버지도 v2, 서울시API, 팝가 | `collector_total.py` |
| 홍대 | 네이버지도 v2, 서울시API | `collector_total.py` |
| 공연 | 서울시API (공연 카테고리) | `collector_total.py` |

**운영 커맨드**: `python3 collector_total.py` (3개 지역 일괄 수집)

---

### 2026-05-30 — SEO 전면 정비 + 버그 수정

#### 1. `database.py` 클린업 로직 수정
- **문제**: `DELETE FROM seongsu_places WHERE created_at < :limit_date` (생성일 30일 기준) → 테마 스크래핑 플레이스도 삭제됨
- **수정**: `DELETE FROM seongsu_places WHERE end_date IS NOT NULL AND end_date < CURRENT_DATE`
  - `end_date=NULL`인 항목(테마 스크래핑) 보호
  - `created_at` 기반 → `end_date` 기반으로 전환 (이벤트 실제 만료일 기준)
- **확인**: `themes.places`에 저장된 수동 테마 플레이스는 `seongsu_places`와 별개 테이블 → 영향 없음

#### 2. Next.js `digest` null 크래시 수정 (`now_front`)
- **문제**: `posts/[id]/page.tsx`에서 `useSearchParams()`를 `Suspense` 없이 사용 → Next.js 14 App Router가 내부적으로 null throw → `error.digest` 읽기 실패 → PM2 재시작 반복
- **수정**:
  - `PostDetail` 컴포넌트를 내부 함수로 변경
  - `export default function PostDetailPage()`에서 `<Suspense><PostDetail /></Suspense>`로 래핑
  - `global-error.tsx` 신규 생성 → null 에러 발생 시 프로세스 죽지 않고 에러 화면으로 처리

#### 3. 랭킹 썸네일 네이버 CDN 차단 수정 (`Recommendation.tsx`)
- **문제**: 모바일 브라우저가 referrer 헤더를 전송 → 네이버 CDN이 차단 → 홍대 썸네일 깨짐
- **수정**: 랭킹 플레이스 이미지에 `referrerPolicy="no-referrer"` 추가 + `onError` fallback (picsum)
- PC는 데스크탑 Chrome이 cross-origin 이미지에 referrer 미전송 → 정상, 모바일만 깨진 이유

#### 4. SEO 전면 정비 (`now_front`)

##### robots.ts 신규 생성
- `/admin`, `/my`, `/login`, `/signup`, `/auth/`, `/api/` 크롤 차단
- `/`, `/posts/`, `/privacy`, `/feedback` 허용
- sitemap URL 명시

##### layout.tsx 보강
- Twitter Card 추가 (`summary_large_image`)
- OpenGraph에 `url`, `locale` 추가
- `alternates.canonical` + hreflang (`ko`, `en`) 추가
- `robots: { index: true, follow: true }` 명시
- WebSite JSON-LD + SearchAction 스키마 추가

##### posts/[id]/layout.tsx — generateMetadata 고도화
- 기존: canonical URL만 반환
- 수정: `/places` 백엔드 fetch → 실제 장소 제목/설명/이미지로 동적 메타데이터 생성
  - `title`: 한국어 + 영문명 병기
  - `description`: `place.content` 앞 160자
  - OG/Twitter 이미지: `place.image_url` 사용
  - 실패 시 canonical fallback

##### 비공개 페이지 noindex 처리
`'use client'` 페이지에 직접 metadata 불가 → 각 폴더에 `layout.tsx` 신규 생성

| 경로 | 파일 | robots |
|------|------|--------|
| `/login` | `login/layout.tsx` | noindex |
| `/signup` | `signup/layout.tsx` | noindex |
| `/admin` | `admin/layout.tsx` | noindex |
| `/my` | `my/layout.tsx` | noindex |
| `/my/edit` | `my/edit/layout.tsx` | noindex |
| `/feedback` | `feedback/layout.tsx` | index (공개) |

##### 이미지 alt 태그 수정
- `posts/[id]/page.tsx`: 히어로 이미지 `alt=""` → `alt={displayTitle}`
- `my/page.tsx`: 테마 썸네일 `alt=""` → `alt={theme.title}`, 찜 목록 `alt=""` → `alt={place.title}`

---

### 2026-06-12 — 제주 문화행사 연동 + 뒤로가기 버튼 + SEO 보완

#### 1. 제주 공연·전시 API 연동 (`scraper_jeju_api.py` 신규, `collector_total.py` 수정)
- **API**: `http://www.jeju.go.kr/rest/JejuExhibitionService/getJejucultureExhibitionList` (공개 REST, XML)
- **수집 전략**: 전체 페이지 수 확인 후 최근 5페이지만 탐색 → `stat=READY` + `end >= today` 필터
- **정렬**: 공연 먼저(0), 전시 뒤(1) / 각 카테고리 내 시작일 오름차순
- **중복 제거**: 타이틀 기준 dedup
- **저장**: `region="제주"`, `end_date_actual`=실제 행사 종료일 (기존 today+30 대신 실제 종료일 사용)
- `collector_total.py`에 `run_jeju()` 추가 → `python3 collector_total.py`로 4개 지역 일괄 수집

#### 2. 프론트엔드 — 제주 서브탭 신설
- **`page.tsx`**: `type Region`에 `'제주'` 추가. 공연 탭 클릭 시 서울|제주 서브탭 표시 (`mt-2` 간격)
  - 서울: `bg-emerald-500`, 제주: `bg-[#0369a1]` (제주 바다색)
  - 지도/AI코스 탭: 제주도 공연과 동일하게 비활성 처리
- **`PlaceList.tsx`**: `'제주'` region → 헤더 "제주 공연·전시" / "Jeju Culture & Arts"
- **`Recommendation.tsx`**: 제주 배지 `bg-cyan-500` 글로우 효과, 라벨 'JEJU'
- **`admin/page.tsx`**: JEJU 탭 추가 → 어드민에서 제주 데이터 관리 가능

#### 3. 제주 장소명 정규화
- **문제**: API `locNames` 필드가 "대극장", "소극장", "제1전시실" 등 홀 이름만 반환 (주소 없음)
- **해결**: 현재 수집 데이터 전부 제주아트센터 내 홀 → 하드맵 처리
  - `scraper_jeju_api.py`: `_artcenter_halls` set으로 → "제주아트센터 대극장" 형태로 정규화
  - DB UPDATE: 기존 43건 즉시 수정 ("제주 대극장" → "제주아트센터 대극장" 등)

#### 4. 뒤로가기 버튼
- **`page.tsx` 헤더**: 타이틀 앞 `<` ChevronLeft 버튼 추가
  - 동작: `window.close()` → 앱 웹뷰에서 탭 닫고 앱으로 복귀
  - `router.back()` 사용 시 내부 히스토리(My 페이지 등)로 이동하는 버그 → `window.close()`로 수정
- **`posts/[id]/page.tsx`**: 기존 `router.back()` → `history.length > 1 ? router.back() : router.push('/')` 로 변경

#### 5. SEO 보완
- **`layout.tsx`**: description/OG/Twitter/JSON-LD에 제주 문화행사 키워드 추가
  - OG title: "Seongsu & Hongdae Live" → "Seoul & Jeju Live"
- **`posts/[id]/layout.tsx`**: 폴백 description 제주 포함으로 수정
- **`posts/[id]/page.tsx`** JSON-LD 구조화 데이터 수정:
  - `addressLocality`: "Seoul" 하드코딩 → 제주 여부에 따라 "Jeju" / "Seoul" 동적 분기, `addressRegion: "Jeju-do"` 추가
  - `image`: 빈값 시 `/og-image.png` 폴백 (구글 검증 에러 해소)
  - `location.name`: null 시 "제주아트센터" 또는 "서울" 폴백 (구글 검증 에러 해소)
  - `startDate`: 오늘 날짜 하드코딩 → `date_range` 파싱으로 교체
  - `endDate`: 신규 추가 (`date_range` 파싱)

---

#### 현재 수집 구조 (2026-06-12 기준)
| 지역 | 수집원 | 파일 |
|------|--------|------|
| 성수 | 네이버지도 v2, 서울시API, 팝가 | `collector_total.py` |
| 홍대 | 네이버지도 v2, 서울시API | `collector_total.py` |
| 공연 | 서울시API (공연 카테고리) | `collector_total.py` |
| 제주 | 제주도 공식 문화행사 API | `collector_total.py` |

**운영 커맨드**: `python3 collector_total.py` (4개 지역 일괄 수집, 로컬에서 실행)

---

### 2026-06-20 — 네이버 지도 수집 AI 소개 생성 + 상세 페이지 개선 + 광고 삽입

#### 1. 네이버 지도 스크래퍼 정리 (`scraper_naver_map_v2.py`)
- 상세 페이지 소개 스크래핑 코드 완전 제거 (`_fetch_place_intro`, `_parse_intro_from_text` 삭제)
  - 이유: 로컬 IP(`121.134.133.247`) 네이버 차단으로 상세 페이지 접근 불가
- `_build_content()` 단순화: 메타데이터(카테고리/주소/영업) 제거 → AI 소개 생성으로 대체
- 스크롤 로직 추가 (mouse.wheel 방식) — 단, pcmap iframe 내부 차단으로 현재 1회 allSearch 응답(20개)만 수집됨
- 중복 제거: `seen_ids` set으로 동일 naver_place_id 중복 수집 방지

#### 2. `collector_naver.py` 전면 재작성
- AI 소개 자동 생성 (`gemini-2.5-flash`) 탑재
  - 장소명 + 위치 기반 2~3문장 한국어 소개 자동 생성
  - **기존 content가 있으면 AI 생성 건너뜀** (재실행 시 불필요한 API 호출 방지)
- content 구성: `AI 소개\n\n네이버 지도 바로가기: {URL}`
- `ON CONFLICT (naver_place_id)` 기준 upsert로 교체 (기존 title 기준 → naver_place_id 기준)
- 성수/홍대 각각 `scrape_naver_map_popups()` 호출 후 AI 생성 → DB 저장

#### 3. 기존 DB 데이터 AI 소개 일괄 마이그레이션 (`migrate_ai_content.py` 신규)
- 대상: content가 비어있거나 "카테고리:/주소:/영업:" 포함된 레거시 메타 텍스트 항목
- **71개 항목 AI 소개 업데이트 완료** (성수/홍대 전 지역)
- 이후에는 `collector_naver.py`가 신규 항목만 AI 생성

#### 4. 백엔드 날짜 필드 API 노출 (`main.py`)
- `/places`, `/places/{id}` SELECT에 `end_date` 추가
  - 기존: WHERE 조건에만 사용, 응답에 미포함
  - 수정: 응답 포함 → 프론트 상세 페이지에서 표시 가능

#### 5. 상세 페이지 개선 (`posts/[id]/page.tsx`)
- **운영기간 표시**: `date_range` 없으면 `end_date`로 "~ 2026-06-30" 형태 표시
- **줄바꿈 렌더링**: content `\n` → `<p>` 단위로 분리 렌더링
- **네이버 링크**: raw URL 숨기고 "바로가기: 링크 열기" 클릭 가능 링크로 표시
- **인아티클 광고 삽입**: 상세정보와 위치안내 사이에 `InArticleAd` 컴포넌트 삽입
  - slot: `7762192096`, `data-ad-layout="in-article"`, `data-ad-format="fluid"`
  - 기존 `AdUnit.tsx`에 `InArticleAd` export 추가 (useEffect로 push)

#### 6. 수집 구조 변경
- 네이버 지도 전용 수집기 `collector_naver.py` 분리 운영
- `collector_total.py`는 서울시API/제주API/팝가 담당 유지

---

#### 현재 수집 구조 (2026-06-20 기준)
| 지역 | 수집원 | 파일 |
|------|--------|------|
| 성수 | 네이버지도 v2 (AI 소개 자동생성), 서울시API, 팝가 | `collector_naver.py` + `collector_total.py` |
| 홍대 | 네이버지도 v2 (AI 소개 자동생성), 서울시API | `collector_naver.py` + `collector_total.py` |
| 공연 | 서울시API (공연 카테고리) | `collector_total.py` |
| 제주 | 제주도 공식 문화행사 API | `collector_total.py` |

**운영 커맨드**:
- `python3 collector_naver.py` — 네이버 지도 성수/홍대 수집 + AI 소개 생성 (주 1회 권장)
- `python3 collector_total.py` — 서울시API/제주API/팝가 전체 수집 (기존 동일)

---

### 2026-06-20 (2차) — 어드민 기능 대폭 확장 + UX 개선

#### 1. 어드민 — 지역(Region) 선택 기능 추가
- 신규 등록/수정 폼에 **카테고리(Region) 드롭다운** 추가 (성수/홍대/공연/제주/축제)
- `PlaceUpdate` 모델에 `region` 필드 추가 → PUT 요청으로 region 변경 가능
- 잘못 입력된 장소의 지역을 어드민에서 직접 수정 가능

#### 2. 어드민 — 사용자 탭 → 테마 탭으로 교체
- 사용자 관리 탭 제거 (통합인증 전환으로 불필요)
- **테마 관리 탭** 신설:
  - `[퍼감]` 접두어 테마 자동 제외 (오리지널만 표시)
  - 테마별 제목/설명 편집, 테마 삭제 (소유자 체크 없음 — 탈퇴 유저 테마도 관리 가능)
  - 펼치기(▼)로 포함 장소 목록 확인
  - 장소 개별 삭제 (X 버튼)
  - **장소 추가**: "장소 추가" 버튼 → 이름/주소 검색 → 클릭으로 테마에 추가
    - 필수: title, location, content / 선택: image_url, video_url, date_range
- 백엔드 어드민 전용 엔드포인트 추가:
  - `GET /admin/themes` — 전체 테마 조회 ([퍼감] 제외)
  - `PUT /admin/themes/{id}` — title/description/places 수정 (소유자 체크 없음)
  - `DELETE /admin/themes/{id}` — 테마 + theme_likes 일괄 삭제

#### 3. 어드민 — 총 유저수 Supabase 연동
- `/admin/stats`의 `total_users` 0 하드코딩 → Supabase `/auth/v1/admin/users` API 실시간 조회로 교체
- 맛매치와 동일한 통합 인증 사용자 수 표시 (현재 9명)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 환경변수 추가 (now_back .env)

#### 4. 장소 최상단 고정(Pin) 기능
- `seongsu_places` 테이블에 `pinned_at TIMESTAMP WITH TIME ZONE` 컬럼 추가
- `/places` 정렬: `pinned_at DESC NULLS LAST` 우선 → 이미지 유무 → 최신순
- 어드민 편집 폼에 **"최상단 고정"** 체크박스 추가
  - 체크 시 `pinned_at = NOW()` 저장, 해제 시 NULL
  - 가장 최근 체크한 항목이 최상단 (지역별 독립 적용)
  - 리스트에 "고정" 배지(에메랄드) 표시

#### 5. 메인 앱 UX 개선
- **헤더 타이틀 줄바꿈 방지**: h1에 `whitespace-nowrap` 추가 ("지금 여기 ." 2줄 방지)
- **PlaceList 상단 제목+필터 라인 삭제**: "성수 핫플레이스 / 필터" 중복 헤더 제거 (광고 가림 문제도 해소)

#### 6. 광고 CLS 보호
- `InArticleAd` (상세페이지): `min-height: 280px` 유지
- `AdUnit` (인피드): min-height 미적용 유지 — fluid 광고 특성상 고정 높이 불필요

### 2026-07-02 — 공연 메뉴 KOPIS 전환 + 조회수/성능 이슈 일괄 수정

#### 1. 주간 랭킹(TOP10) 실시간 쿼리 → 일 1회 배치 캐싱 (`main.py`)
- 기존: `/admin/ranking/weekly` 호출마다 + `/places/{id}/view` 호출마다 `CREATE TABLE IF NOT EXISTS`를 매번 실행하던 비효율 발견
- `refresh_weekly_ranking()` 신설 — 서버 기동 시 1회 + 매일 자정 5분(APScheduler)에만 재계산, 결과는 모듈 전역 캐시(`_weekly_ranking_cache`)에 저장
- `place_views(place_id, viewed_at)` 인덱스 추가

#### 2. 공연 메뉴 데이터소스를 KOPIS(공연예술통합전산망) OpenAPI로 전면 교체
- 기존: 서울시 문화행사 API + 제주 문화행사 API + 문체부 통합 공연 API 조합, 장르 필터 없음
- 신규: `scraper_kopis_concert.py` — KOPIS `pblprfr`(목록)+상세 API. 장르 AAAA(연극)/GGGA(뮤지컬)/CCCD(대중음악)/EEEB(서커스,마술) × 지역 11(서울→공연)/50(제주→제주)만 수집, 오늘부터 93일(31일×3구간) 페이지네이션
  - 콘텐츠: 줄거리/기간/출연/러닝타임/관람연령/티켓가격/공연시간/기획사 + `<출처 : KOPIS 제공>` 표기
  - `link_url`에 예매처 URL(relates 첫 항목) 저장
  - `end_date`는 KOPIS 실제 공연종료일(`prfpdto`) 사용 — 기존 +30일 임시값 방식 개선
- `collector_kopis.py` 신규 — `run_concert()`(KOPIS) + `run_festival()`(기존 문체부 축제 API 그대로 유지, 축제는 이번 범위 밖) + `cleanup_expired()`. `collector_culture.py`를 대체하는 역할이나 파일은 분리해서 신규 작성
- `collector_base.py`의 공통 `upsert_items()`에 `link_url` 컬럼 지원 추가
- **`collector_total.py` 삭제** (레거시, 더 이상 의미 없음 — 사용자 승인)
- KOPIS 서비스키는 `.env`의 `KOPIS_SERVICE_KEY`

#### 3. 기존 공연/제주 데이터는 삭제하지 않고 목록에서만 제외 (SEO 보존)
- **원칙**: 검색엔진에 이미 색인된 URL은 절대 DB에서 삭제하지 않는다. 데이터 소스 교체 시에도 목록 노출만 필터링하고, 만료는 기존 45일 유예 삭제(`database.py: cleanup_expired_data`)에 맡긴다 (성수/홍대와 동일 정책)
- `main.py`의 `GET /places`, `GET /places/popular`: `region IN ('공연','제주')`일 때 `naver_place_id LIKE 'kopis_%'` 조건 추가 — 목록엔 KOPIS 데이터만, 개별 상세 URL(`/posts/{id}`)은 구 데이터도 그대로 접근 가능
- title이 KOPIS와 우연히 겹치는 기존 행(구 소스, culture_/concert_ 등)은 `title` UNIQUE 제약으로 자동 병합되어 KOPIS 콘텐츠로 갱신됨 — 다만 `naver_place_id`는 upsert 대상이 아니라 구 접두어가 남아 목록 필터에서 누락되는 케이스 발견, 수동으로 `naver_place_id`만 `kopis_{mt20id}`로 갱신해 반영

#### 4. 상세 페이지 개선 (`posts/[id]/PlaceDetailClient.tsx`)
- 공연/제주 "바로가기" 버튼 라벨: "공식 페이지 바로가기" → **"예매하러 가기"** (축제는 기존 라벨 유지)
- 상세정보에서 "기간:/출연:/러닝타임:/관람연령:/티켓가격:/공연시간:/기획:" 라벨 붙은 줄을 자동으로 불릿 리스트 박스로 분리 렌더링 (공연/축제 전체 공통 적용, 기존 데이터도 동일 스타일 적용됨)
- 뒤로가기/공유 버튼 대비 강화 (포스터 이미지 위에서 반투명 배경 때문에 안 보이던 문제 — `bg-white/20` → `bg-black/40` + 그림자)

#### 5. 조회수 기록 누락 문제 진단 및 수정
- 진단: 방문 로그 대비 `/places/{id}/view` POST 기록률이 낮음 — UA 분석 결과 상당수가 SemrushBot/Googlebot 등 크롤러였고, 나머지도 Next.js Link 프리페치로 인해 실제 마운트 없이 GET만 찍히는 경우 존재
- 수정: `fetch(.../view)`에 `keepalive: true` 추가 — 페이지 이탈/언로드 시에도 요청이 끊기지 않도록 보장

#### 6. 리스트 무한 스크롤 도입 (전 지역 공통 — `page.tsx`, `PlaceList.tsx`)
- 문제: 공연 리스트가 KOPIS 연동 이후 600건+ 로 늘어나면서 페이지네이션 없이 전체를 한 번에 렌더링해 모바일에서 렉 발생
- `GET /places`에 이미 있던 `limit`/`offset` 파라미터를 프론트에서 실제로 활용 — `PlaceList.tsx`에 `IntersectionObserver` 기반 무한 스크롤 추가 (`PAGE_SIZE=20`, 성수/홍대/공연/제주/축제 전체 공통 적용)
- 지도(`MapView`, 성수/홍대 전용)는 핀 누락 방지를 위해 별도 전체 데이터(`mapPlaces`) 유지 — 리스트만 페이지네이션

#### 7. `collector_naver.py` upsert 버그 수정
- 문제: 팝업이 네이버에서 `naver_place_id`가 바뀐 채로 재등록되는 경우, `ON CONFLICT (naver_place_id)`만으로는 감지가 안 돼 별도 `title` UNIQUE 제약에 걸려 저장 실패
- 수정: upsert 전에 `naver_place_id OR title` 매치되는 기존 행을 조회해서 있으면 UPDATE(naver_place_id 갱신 포함), 없으면 INSERT하는 방식으로 변경

#### 8. 성수/홍대 리스트 썸네일 모바일 로딩 실패 대응
- 증상: PC는 정상, 모바일에서 이미지 중 일부(패턴 없이 2~3개 중 1개꼴)가 랜덤 플레이스홀더로 표시
- 확인: 네이버 CDN(`pstatic.net`) 자체는 UA/referer 무관하게 200 정상 응답 — 서버 차단 아님 (2026-05-30에 고쳤던 "referrer 전송→네이버 차단" 케이스와는 다른 원인이며, `referrerPolicy="no-referrer"`는 이미 적용돼 있었음)
- 추정 원인: `loading="lazy"` 부재로 화면에 보이지 않는 이미지까지 한꺼번에 로드 시도 → 모바일 동시 연결/대역폭 제약으로 일부 요청 실패
- `PlaceList.tsx` 이미지에 `loading="lazy"` + `decoding="async"` 추가

### 2026-07-08 — 원데이클래스 콘텐츠 추가 + 브랜드 슬로건 변경 + 홈 기본탭 변경

#### 1. 성수/홍대에 원데이클래스·공방체험 콘텐츠 신규 추가
- `scraper_naver_map_v2.py`: 기존엔 `PopupstoreSearchBusinessItem`(팝업스토어, 운영기간 있음)만 인식했는데, "성수 원데이클래스" 등으로 검색하면 네이버가 이를 팝업스토어 업종이 아닌 일반 업체(`PlaceListBusinessesItem`)로 분류해 0건이 나오던 문제 발견 → 두 타입 모두 인식하도록 수정 (필드명은 동일, 운영기간 필드만 없음 — 한 쿼리 결과엔 둘 중 하나만 존재해 혼입 없음)
- DB에 `seongsu_places.category` 컬럼 신규 추가 (nullable, NULL=팝업스토어, `'class'`=원데이클래스/체험) — **region은 기존 성수/홍대에 그대로 병합**(사용자 결정: "체험" 신규 카테고리로 분리하지 않음, 향후 분리 대비용 태깅만)
- `collector_naver.py`: `upsert_naver_items`/`run_class()` 신설, "성수 원데이클래스"/"성수 공방 체험"/"홍대 원데이클래스" 쿼리로 성수 116건 + 홍대 100건 수집·저장
- `main.py`: `/places`, `/admin/places`, `/places/{id}` 응답에 `category` 노출, `/places`에 `category=class|popup` 필터 파라미터 추가
- **버그 발견 및 수정**: AI 코스 생성(`create_itinerary`) 쿼리가 `LIMIT 15`인데 `ORDER BY`가 없어 기존에 쌓인 팝업 데이터 중 항상 같은 앞쪽 15개만 뽑히고 새 클래스 항목이 영구히 배제되던 문제 → `ORDER BY RANDOM()` 추가
- 상세페이지(`PlaceDetailClient.tsx`) 운영기간 표시 버그 수정: 클래스류는 실제 종료일이 없어 임시 30일 만료값이 `end_date`에 들어가는데, 이를 그대로 "~날짜"로 노출하던 것을 `category==='class'`일 땐 "상시 운영"으로 표시하도록 수정
- AI 소개 문구 생성(`ai_generate_intro`)이 카테고리 무관하게 "팝업스토어"로 고정 프롬프트를 쓰던 문제 수정 (카테고리별 분기: 클래스는 "원데이클래스/체험 공방"으로 프롬프트 전달) — 기존에 잘못 생성된 216건은 재생성 스크립트로 백필
- 프론트 서브탭: 성수/홍대 지역탭 아래에 "전체/팝업/클래스" 서브탭 신규 추가 (홈 `page.tsx` + 상세페이지 `PlaceDetailClient.tsx` GNB 양쪽, 공연의 서울/제주 서브탭과 동일한 위치·스타일로 통일). URL `?category=` 파라미터로 상세페이지→홈 이동 시에도 필터 유지

#### 2. 브랜드 슬로건 변경
- "당신의 3시간을 완벽하게 설계하는 로컬 가이드" → **"당신 3시간의 알찬 설계"**(ko) / "A fulfilling plan for your 3 hours"(en) / "为您3小时的充实安排"(zh)
- 적용 범위: `layout.tsx`(title.default, OG/Twitter), 홈 `page.tsx`(dict.desc), 상세페이지 `PlaceDetailClient.tsx`(tagline) — 전체 언어 통일
- 홈 헤더를 상세페이지 GNB와 동일하게 타이틀+슬로건이 한 줄에 나란히 보이도록 레이아웃 통일 (기존엔 2줄로 분리돼 있었음)

#### 3. 홈 기본 진입 탭 변경
- 첫 진입 시 기본 탭을 '리스트' → '랭킹(추천)'으로 변경 (`useState<Tab>('list')` → `('rec')`)

#### 4. 맛매치(nemoneai.com) 네이버 검색 노출 문제 진단
- 네이버 서치어드바이저가 "robots.txt에 의해 수집 제한" 진단 → robots.txt/sitemap.xml 자체는 정상(200)이었으나, **`http://nemoneai.com/robots.txt`가 404**인 것을 발견 (HTTPS는 정상, HTTP만 실패)
- 원인: nginx에서 `admin`/`home`/`now` 서브도메인엔 모두 80→443 리다이렉트 블록이 있는데 메인 도메인(`nemoneai.com`/`www.nemoneai.com`)만 이 블록이 누락됨 — `now.nemoneai.com`과 직접 비교해 구조적 차이 확인
- `/etc/nginx/sites-enabled/default`에 표준 Certbot 패턴과 동일한 80→443 리다이렉트 블록 추가 (백업 후 `nginx -t` 검증 → reload), 이후 http/https 전부 정상 확인
- 서치어드바이저 가이드 8~10번 항목(noindex, frame, JS 로딩/리다이렉트, 사이트맵 절대경로, nofollow, JS전용링크) 전수 점검 — 실제 문제 없음 확인 (noindex는 삭제된 게시물에만 정상 적용 중인 것으로 확인)
- User-Agent/역DNS 기반 검증: 서버 로그에서 최근 7일 Yeti 접근 1,766건 확인, 샘플 IP 역DNS→정DNS 교차 검증으로 실제 네이버 봇 확인, 맛매치 전용 경로(`/special/`, `/category/`) 크롤링 성공(200) 확인
- 5월말(5/30~31) 급락 원인 관련 논의: nginx 설정 파일(`sites-available/default`)의 마지막 수정 시각이 정확히 **2026-05-31**로, 기존에 파악된 급락 시점(git init도 5/30)과 일치 — 기존 3차례 원인(페이지네이션/봇차단/Suspense-ISR 렌더링)에 이은 네 번째 원인이었을 가능성 높음 (확정은 아님, nginx엔 버전이력이 없어 100% 증명은 불가)

### 2026-07-09~10 — 용산 지역 신규 추가 + 이미지 재호스팅 파이프라인 결함 수정 + 어드민 개선 다수

#### 1. 용산 지역 신규 추가 (성수/홍대와 동일한 완전 기능 지원)
- `collector_naver.py`: `run_yongsan()` 신설("용산 팝업스토어" 쿼리) + `run_class("용산", ...)` 원데이클래스/공방체험 수집, `run_all()`에 포함 — 팝업 49건 + 원데이클래스 100건 + 공방체험 38건, 중복 제거 후 177건 저장
- 프론트: `Region` 타입·지역탭 배열·지도(`MapView.tsx` 노란색 마커 `#eab308`)·AI코스(`AITour.tsx`)·AskAI·랭킹 배지(`Recommendation.tsx`)·서브탭(전체/팝업/클래스) 전부 홍대-공연 사이에 용산 삽입, EN/ZH 표시명("Yongsan"/"龙山") 매핑 추가
- 사이트 전역 SEO 메타(`layout.tsx` title/description/JSON-LD)에 "성수·홍대·용산"으로 반영
- **버그**: 어드민 지역탭 라벨이 성수/홍대/공연/제주까지만 분기하고 나머지는 전부 'FESTIVAL'로 하드코딩되어 있어 용산이 "FESTIVAL"로 오표기됨 → 'YONGSAN' 분기 추가로 수정

#### 2. 이미지 재호스팅 파이프라인 결함 발견 및 수정 (가장 중요한 발견)
- **발견**: 어드민에서 직접 등록/수정한 장소만 `rehost_image()`(Supabase Storage 재호스팅)가 호출되고, **자동 스크래퍼(`collector_naver.py`)로 수집된 장소는 지금까지 단 한 번도 재호스팅된 적이 없었음** — 전부 네이버 CDN 원본 URL을 그대로 저장 중이었음(외부 AI 도구가 이미지에 접근 못하는 문제로 발견)
- `collector_naver.py`의 `upsert_naver_items()`에 `rehost_image()` 연동 → 앞으로 수집되는 모든 이미지 자동 재호스팅
- 기존 스크래퍼 수집 이미지 전체(1,513건) 백필 완료(Supabase Storage로 이전), Storage 사용량 3.54%/1GB로 확인
- 로컬 실행 환경(matmatch venv)에 Pillow 누락되어 재호스팅 실패하던 문제 발견 → `pip install Pillow`로 해결 (동일 venv를 now/matmatch 로컬 실행에 공용으로 쓰기로 한 기존 정책 유지, 시스템 python3와 혼용하지 않도록 주의)

#### 3. `collector_base.py` upsert 버그 수정 (`collector_kopis.py`가 사용)
- `ON CONFLICT (title)`만 처리하던 기존 로직 → KOPIS 공연 제목이 살짝 바뀌어 재수집되면(naver_place_id는 동일) title 매칭 실패로 INSERT 시도 중 `naver_place_id` UNIQUE 제약 위반 크래시 발생
- `collector_naver.py`에 적용했던 것과 동일한 방식(`naver_place_id OR title`로 기존 행 조회 후 UPDATE/INSERT 분기)으로 수정

#### 4. `collector_kopis.py` 실행 분리
- 공연(KOPIS)과 축제(문체부API) 갱신 주기가 달라 분리 요청 — `python3 collector_kopis.py concert`(주 1회, 주말 기점) / `festival`(월 1회) 인자로 독립 실행 가능하게 변경, 각각 자체적으로 `cleanup_expired()` 수행

#### 5. `get_embedding()` 재시도 로직 추가
- Gemini 임베딩 API의 일시적 503(서버 과부하) 대응 — 실패 시 최대 3회, 2초/4초 간격 재시도 후에도 실패하면 예외 전파

#### 6. 원데이클래스 콘텐츠 후속 수정
- AI 소개 문구 생성이 카테고리 무관하게 "팝업스토어" 프롬프트 고정이던 문제 수정(카테고리별 분기), 기존 216건 재생성
- 운영기간 표시 버그: 클래스류는 실제 종료일이 없어 임시 30일 만료값이 `end_date`에 들어가는데 이를 "~날짜"로 그대로 노출하던 것을 `category==='class'`일 땐 "상시 운영"으로 표시하도록 수정 (상세페이지 메인 + 추천 카드 양쪽)
- **버그**: AI 코스 생성 쿼리(`create_itinerary`)가 `LIMIT 15`인데 `ORDER BY`가 없어 기존에 쌓인 팝업 데이터 중 항상 같은 앞쪽 15개만 뽑히고 새 항목(클래스 등)이 영구히 배제되던 문제 → `ORDER BY RANDOM()` 추가
- 성수/홍대(+용산) 서브탭(전체/팝업/클래스) 위치를 검색바 아래 → 지역탭 바로 아래(공연 서브탭과 동일 위치·스타일)로 이동, 홈+상세페이지 GNB 양쪽 반영, `?category=` URL 파라미터로 상세→홈 이동 시에도 필터 유지

#### 7. 플레이스 상세페이지 상단 공지 배너 신설
- 공지사항 게시판이 없어 임시로 전역 배너 기능 추가 — 어드민 TOP25 화면 상단에 텍스트+URL 입력 필드 + 갱신 버튼, 히어로 이미지 최상단에 반투명 캡슐형 배너(확성기 아이콘 + "NOTICE" 라벨 + 텍스트, 한 줄 말줄임, 클릭 시 새 탭)로 노출
- 클라이언트 사이드 fetch라 ISR 캐시 지연 없이 즉시 반영, 텍스트 비우고 갱신하면 배너 사라짐(기본 비노출)

#### 8. UI/UX 자잘한 수정
- 플레이스 페이지 좌우 이동 화살표가 화면 중앙(50%)에서 공유 버튼과 겹치는 문제 → 62% 지점으로 하향 조정
- 풋터(홈+상세페이지)에 브랜드 슬로건 추가, 전체 가운데 정렬, 카피라이트·링크 글자색 어둡게(`zinc-300/400`→`zinc-400/500`)
- 홈 기본 진입 탭을 '리스트' → '랭킹(추천)'으로 변경
- 뒤로가기 버튼(홈/`/feedback`/`/my/edit`)이 히스토리 없을 때 동작 안 하던 것을 상세페이지와 동일한 "히스토리 있으면 back(), 없으면 홈으로" 로직으로 통일

#### 9. 어드민 개선
- TOP10 랭킹 → TOP25로 확장(백엔드 `[:10]`→`[:25]`), 어드민 첫 진입 화면을 랭킹 탭으로 변경
- 랭킹에 운영기간(date_range) 컬럼 추가, CSV 다운로드 버튼 신설(순위/제목/URL/썸네일URL/운영기간 — 매주 AI에게 넘겨 랭킹 기사 작성용)
- 장소 리스트가 지역당 수백 건이라 길어지는 문제 → 검색 없을 땐 랜덤 10개만 표시 + "총 N개 · 최종 업데이트 M/D HH:MM" 요약 표시로 개선 (검색 시엔 전체 데이터에서 검색)

#### 10. 광고 슬롯 교체
- 맛매치와 공유하던 인아티클 슬롯(`7762192096`)을 나우 전용(`7053776315`)으로 분리, 랭킹 3번째(`5769413560`)/리스트 2번째(`1670386458`) 슬롯도 전용 슬롯으로 교체, 테마 메뉴 주석 처리돼있던 광고 활성화 + 3번째 항목 뒤로 위치 이동

### 2026-07-11 — 랭킹 스케줄/기준 조정 + 텔레그램 알림 + 챗봇/AI코스 개선 + 지역탭 버그 수정

#### 1. 인기 랭킹 계산 주기/기준 조정
- 하루 2회(자정/정오) → **하루 3회(한국시간 0/8/16시)**로 확장
- 랭킹 산정 기준을 7일 → **48시간**으로 좁힘 — 7일 창에서는 소수 인기 항목의 트래픽 쏠림(1등이 눈에 띄어 계속 클릭되는 자기강화 구조)으로 순위가 거의 안 바뀌는 문제 확인, 48시간으로도 조회된 place가 277개라 폴백(30일 확장) 없이 충분함을 확인 후 적용
- **CSV 다운로드는 별도로 7일 기준 유지** — 화면 표시(48시간, 빠른 변화 확인용)와 주간 콘텐츠 제작용(7일 고정)을 분리. `_popularity_rows()` 공용 헬퍼로 리팩토링, `/admin/ranking/weekly7d` 신규 엔드포인트가 매번 즉석 계산

#### 2. 로컬 스크래퍼 launchd 문제 진단 및 수정
- `collector-naver`/`collector-culture` launchd job이 전부 `PermissionError: ...matmatch/backend/venv/pyvenv.cfg`로 실행 시작부터 죽고 있었음 — 원인은 화면보호기/잠자기가 아니라 **macOS가 launchd(백그라운드) 프로세스의 `~/Desktop` 접근을 차단**하는 것(Full Disk Access 필요). 사용자가 시스템 설정에서 권한 추가 완료
- `collector-culture` job이 이미 대체된 레거시 `collector_culture.py`를 아직도 실행 중이던 것 발견 → `collector_kopis.py concert`로 교체, 라벨도 `collector-kopis`로 정리
- 스케줄을 목요일 14:00(네이버)/14:15(KOPIS)로 통일 — 사용자 로컬 PC가 켜있는 시간대 기준
- **텔레그램 알림 신규 추가** (`notification.py`, msm과 동일 봇/채팅 재사용) — `collector_naver.py`/`collector_kopis.py` 실행 완료 시 신규/갱신/실패 건수 요약을 텔레그램으로 전송. `upsert_naver_items`/`upsert_items`가 각각 (신규, 갱신, 실패) 카운트를 반환하도록 리팩토링

#### 3. AskAI 챗봇 개선
- 답변에서 "네이버 지도에서 확인하세요" 같은 문구 대신 실제 언급된 장소가 **클릭 가능한 카드**(제목/위치)로 답변 하단에 노출되도록 변경 — `/ask` 응답이 `context`(평문 리스트) 대신 `places`(id 포함 구조화 리스트) 반환, 프론트에서 `/posts/{id}` 링크로 렌더링
- 네이버 스마트스토어 배너(맛매치 `ViewAdSlot`과 동일, `StoreBanner` 컴포넌트 신규)를 AI코스 결과 화면과 챗봇 하단에 추가 — 이후 "결과 나온 후"가 아니라 **메뉴 진입 즉시부터 상시 노출**로 위치 수정

#### 4. 용산 관련 후속 수정
- 어드민 지역탭에서 용산이 "FESTIVAL"로 잘못 표시되던 버그 수정 (성수/홍대/공연/제주까지만 분기하던 라벨 삼항연산자에 용산 분기 누락)
- 지도 초기 중심 좌표를 용산구청 부근(37.5320, 126.9906) → **이태원역 기준**(37.5344, 126.9947)으로 수정 — 수집 데이터 평균 좌표가 용산역 쪽으로 치우쳐 있어 핵심 상권(이태원/한남동)이 안 보이던 문제
- 성수/홍대/용산 서브탭에서 "전체" 옵션 제거, 기본값을 팝업으로 변경 (전체는 팝업+클래스가 섞여 정보가 복잡하다는 피드백)

#### 5. 지역탭 네비게이션 버그 수정
- 상세페이지의 지역탭(메인탭/공연·제주 서브탭/성수·홍대·용산 서브탭) 클릭이 `tab` 파라미터 없이 홈으로 이동시켜서, 홈의 기본 탭(랭킹)으로 떨어져 지역 필터링 없는 통합 랭킹 화면이 보이던 문제 — 전부 `&tab=list` 추가해 해당 지역 리스트로 바로 이동하도록 수정 (검색 등으로 상세페이지에 히스토리 없이 바로 유입된 유저도 동일하게 겪던 문제)

#### 6. 기타
- 어드민에서 콘텐츠(상세내용) 내 URL을 네이버 지도 외 다른 링크(인스타 등)로 바꿔도 안전함을 확인 — `map.naver.com` 포함 줄만 화면에서 숨겨지고, 그 외 URL은 "바로가기" 버튼으로 자동 렌더링되는 기존 로직 확인
- 좌표 미탐 만료 데이터 케이스(운영일시 "미정") 처리 방법 안내: 어드민에 텍스트 그대로 입력 시 파서가 종료일을 NULL(무기한) 처리

### 2026-07-13 — 강남 지역 확장 + 링크박스 + 운영종료 표기 + 랭킹 SEO + 인증서버 버그 수정 + 서치어드바이저 대응

#### 1. 강남 지역 신규 추가
- 팝업(강남/서초/송파구 필터링, "강남 팝업스토어" 검색 결과에 성수 등이 대량 섞여 있어 `commonAddress` 필드로 구 단위 필터링), 원데이클래스(강남구만) — 지도/AI코스/탭/사이트맵/`layout.tsx` SEO 메타 전반에 반영, 색상은 핑크(다른 지역과 겹치지 않게 배정)

#### 2. 모든 플레이스에 커스텀 "바로가기" 링크박스 추가
- 기존엔 공연(KOPIS)만 `link_url`이 자동으로 채워졌고 어드민에서 수동 설정 불가 — `link_title`(예약하기/인스타/공식페이지 등 커스텀 라벨) 필드 신설, 모든 지역에서 어드민이 직접 입력 가능하도록 확장
- UI 위치를 두 차례 조정: 처음엔 히어로 이미지 상단(공지배너와 같은 자리)에 텍스트 스타일로 넣었다가, "상세내용과 블로그후기 사이"가 원래 의도였음을 확인하고 콘텐츠 본문 영역(에메랄드 톤 텍스트 배지)으로 재배치. 기존 공연/축제/제주 전용 카드형 링크는 중복이라 제거

#### 3. 운영종료 자동 표기
- `end_date`가 지난 플레이스는 상세페이지 상태 배지가 자동으로 "운영 종료"(검정 배경/흰 글씨)로 표시되도록 수정 (기존엔 무조건 "운영 중"으로 하드코딩)

#### 4. 랭킹(코스/테마/플레이스) SEO 페이지 3개 신설
- 저장된 AI 코스는 45일 유효기간이 있어 개별 상세페이지로 SEO 대응이 어려운 점을 고려해, 랭킹 요약 페이지(`/ranking/course`, `/ranking/theme`, `/ranking/place`)를 서버 컴포넌트로 신설하고 사이트맵에 반영

#### 5. 하단 네비 "리스트" → "장소"(Spot)로 변경
- 명칭이 콘텐츠 성격과 안 맞는다는 피드백, 아이콘도 List → MapPin으로 교체

#### 6. KOPIS 전환 후 방치된 구 데이터 정리
- 어드민에서 공연 상세내용이 서로 다르게 보이는 문제를 조사한 결과, KOPIS 전환 전 구 수집기(`collector_culture.py`, `naver_place_id`가 `culture_*`)가 남긴 데이터와 신규 KOPIS 수집기(`kopis_*`) 데이터가 **같은 공연인데 제목에 지역 접미사("[대학로]" 등)가 붙어 중복 방지 로직이 다른 공연으로 오인, 별도 행으로 중복 생성**되던 것을 발견
- 제목 정규화 기준으로 확실히 중복인 27건 확인 후 사용자 승인 받아 구 데이터 DELETE (일반적으론 색인된 데이터 삭제 금지 원칙이나, 진행중인 공연이라 자연만료를 기다리면 몇 달간 중복 노출되는 상황이라 이번 건은 예외 적용)

#### 7. nemone-auth(통합 인증 서버) 온보딩 리다이렉트 버그 수정
- "나우에서 회원가입했는데 맛매치 화면이 뜬다"는 리포트로 발견 — `auth.nemoneai.com`의 온보딩 완료 처리가 가입을 시작한 사이트(now/matmatch)가 어디였는지 무시하고 항상 `nemoneai.com`(맛매치)으로 하드코딩 리다이렉트하고 있었음
- 로그인 페이지의 이메일 가입 링크 → 가입폼 → 콜백 라우트 → 온보딩 완료까지 `next` 파라미터를 끝까지 이어지도록 수정, 어느 사이트에서 가입을 시작하든 정확히 그 사이트로 복귀하도록 함 (`nemone-auth` 별도 레포, GitHub Actions 자동배포)

#### 8. 네이버 서치어드바이저 지적사항 대응
- **title/description 중복(64/120건)**: 홈(`/`)이 `region`/`tab`/`lang` 쿼리스트링으로 상태를 바꾸는 클라이언트 컴포넌트라, 쿼리 조합이 달라도 서버가 내려주는 title/description이 전부 동일해서 발생 — `middleware.ts` 신규 추가, 쿼리스트링 있는 `/` 요청에 `X-Robots-Tag: noindex` 부여, 쿼리 없는 순수 `/`만 색인 유지
- **img alt 누락(12건)**: 랭킹/테마 메뉴의 프로필·플레이스 썸네일 11곳이 `alt=""`(빈 값)이던 것을 찾아 실제 제목/작성자명으로 채움

#### 9. 기타
- matmatch 프론트 서버(`/var/www/html`)에 `package.json`에도 없고 코드에서도 안 쓰는 orphan `sharp` 패키지(16MB)가 남아있던 것 발견, 삭제
- 서버 전체 메모리 증가 원인 조사 — GCP Ops Agent가 6/11에 새로 설치되어 약 135MB 상시 사용 중임을 로그로 확인(가장 유력한 원인), 부수적으로 `admin`/`auth` 프로세스가 `npm start` 래퍼 방식이라 pm2 메모리 표시가 실제보다 훨씬 적게 잡히고 있었음(admin 32MB 표시/실제 137MB, auth 36MB 표시/실제 113MB)도 확인

### 2026-07-16 — 최신순 정렬 + 공연 랭킹 분리 + tsconfig 정리

#### 1. 장소 메뉴 "최신순" 정렬 토글 추가
- 기본은 랜덤(기존 동작 유지), 검색창 오른쪽 끝 시계 아이콘으로 최신 갱신순 정렬 가능 — 나중에 키워드/조건 필터가 늘어나도 이 자리에 칩으로 확장 가능하도록 검색바 안에 통합 배치
- **버그 발견 및 수정**: `updated_at`은 어드민 수동 편집(블로그 갱신 등)에만 찍히고 스크래퍼 재수집은 안 건드려 대부분 NULL이라(성수 250개 중 31개뿐), `updated_at DESC NULLS LAST`를 1순위로 쓰면 몇 주 전 한 번 편집된 소수 항목이 오늘 새로 수집된 항목보다 항상 위로 올라가는 문제가 있었음 → `GREATEST(updated_at, created_at) DESC`로 실제 최신 시점을 비교하도록 수정

#### 2. 플레이스 랭킹에서 공연 분리 + 공연 전용 랭킹 신설
- 플레이스 랭킹(메인 랭킹 탭 + 어드민 TOP25 + CSV 다운로드)에 KOPIS 공연이 `naver_place_id LIKE 'kopis_%'` 예외 조건으로 일부러 섞여 들어오고 있던 것을 발견, 공연을 완전히 제외하도록 공용 쿼리(`_popularity_rows`) 수정
- 공연만 집계하는 별도 캐시/엔드포인트(`/places/popular/performance`) 신설, 랭킹 메뉴에 "공연 랭킹" 탭 4번째로 추가

#### 3. now_front tsconfig 정리
- `target: "es5"`가 TypeScript 7.0에서 제거 예정이라는 경고 발생 — 스캐폴딩 시절 기본값이 그대로 남아있던 것, 매치 레포들과 동일한 `ES2017`로 통일

#### 4. 로컬 스크래퍼 launchd 행(hang) 이슈 재발
- 목요일 14:00 launchd 자동실행 중 코피스는 완료 알림이 왔는데 네이버 지도 수집은 응답 없음 — 확인해보니 CPU 0%로 2시간 넘게 멈춰있던 프로세스 발견(`pyvenv.cfg` 권한 오류 이후 진행 없이 행). 종료 후 로컬에서 수동 재실행으로 마무리(신규 45/갱신 662건 정상 처리). 근본 원인(launchd 환경에서의 hang)은 재발 가능성 있어 추후 재점검 필요

### 2026-07-17 — 공연 메뉴 코피스 장르 분류 개편 + 축제 가독성 수정

#### 1. 공연(서울) 메뉴를 지역 대신 코피스 장르로 분류
- 기존엔 "공연 > 서울/제주" 2단 구조였는데, 서울 쪽을 KOPIS 장르 기준 **연극/뮤지컬/음악/종합** 4분류로 개편
- KOPIS API 조사 결과, 리스트 조회에 `shcate`(장르코드) 파라미터를 생략하면 서울 전체 장르가 한 번에 나오고 응답에 `genrenm`(장르명) 필드가 이미 포함돼 있음을 확인 — 기존엔 4개 장르코드만 따로 루프 돌리면서 정작 어떤 장르인지는 저장 안 하고 버리고 있었음
- `scraper_kopis_concert.py`: 서울은 `shcate` 필터 없이 전체 조회 후 `genrenm`으로 분류(연극→연극, 뮤지컬→뮤지컬, 대중음악→음악, 그 외 클래식/국악/무용/서커스마술/복합 등은 전부 종합), 제주는 기존 4개 장르코드 로직 그대로 유지(당분간 별도 지역 운영, 사용자 요청)
- `collector_base.py`/`main.py`: 새 `category` 필드를 UPDATE/INSERT 및 `/places` 필터에 반영
- **메뉴 구조 시행착오**: 처음엔 연극/뮤지컬/음악/종합/제주를 성수/홍대와 동일한 최상위 탭으로 잘못 승격시켰다가("공연" 개념 자체를 없앰) 사용자 피드백으로 즉시 롤백 — 최종적으로는 최상위 탭(성수/홍대/용산/강남/**공연**/축제)은 그대로 두고, **공연 하위에 연극/뮤지컬/음악/종합/제주 5개를 한 줄 서브탭**으로 배치. 제주만 기존 블루(`#0369a1`) 유지, 나머지 4개는 예전 '서울' 서브탭이 쓰던 에메랄드색 유지
- 개편 후 수동 재수집 1회 실행: 서울 공연 1176건 발견(신규 497/갱신 668), 장르별 종합 503·음악 280·연극 223·뮤지컬 141(미분류 222건은 이번에 재조회 안 된 예전 공연으로 45일 유예 로직으로 자연 정리 예정)

#### 2. 축제 상세페이지 가독성 수정
- 문체부 지역축제 API에서 오는 설명이 원래부터 300~500자짜리 줄바꿈 없는 단일 문단이라 다 붙어 보이던 문제
- 60자 넘는 텍스트 라인은 문장 단위(마침표/느낌표/물음표 뒤 공백 기준)로 나눠 각각 별도 문단으로 렌더링하도록 상세페이지 프론트엔드 로직만 수정 (수집 데이터 자체는 안 건드림)

#### 3. Visit Seoul API 조사 (코드 변경 없음, 조사만)
- `api.visitseoul.net`의 콘텐츠 목록/상세 조회 API 확인 — 상세 API(`GET /api/v1/contents/info`)에 주소(신/구), 위도경도, 전화번호, 운영시간, 휴무일, 지하철정보까지 포함돼 있어 데이터 자체는 충분함을 확인
- API 키 발급이 "정식 오픈 이후"로 안내돼 있어 실제 신청 가능 여부는 직접 확인 필요. 키 신청 시 등록하는 "호출 사이트 URL"은 로컬 IP가 아니라 실서비스 도메인(`now.nemoneai.com`)을 등록하는 것으로 안내함
- 서울 전역 일반 관광/맛집/숙박 성격이라 기존 성수/홍대/용산/강남(핫플 팝업 큐레이션)·공연(코피스)과 결이 달라, 도입 시 카테고리 매핑 및 기존 데이터와의 중복 방지 전략이 먼저 필요 — 진행 여부 미정, 후속 논의 대기

### 2026-07-17 (2차) — 랭킹 메뉴 '핫플' 개명 + 정렬 개편(검색바 제거) + 상세페이지 배지 3종 + 클래스 제외

#### 1. 랭킹 메뉴 이름 '랭킹' → '핫플'로 변경
- 하단 네비 라벨(홈+상세페이지) 및 SEO 대응 페이지 `/ranking/place`의 title/H1/description을 '핫플'로 통일. 코스/테마 랭킹은 성격이 달라(개별 "핫플"이 아니라 코스/테마 묶음) 기존 "~랭킹" 명칭 유지

#### 2. 플레이스 랭킹 리스트 설명 텍스트 개선 (2회 수정)
- `/ranking/place`(SEO): 빈약했던 위치 정보 대신 운영기간(date_range) 표시로 교체
- 인앱 핫플>플레이스 탭(`Recommendation.tsx`): `place.location?.split(' ')[2] 근처` 패턴이 주소 3번째 토큰을 그대로 잘라 붙이는 방식이라 "203호 근처" 같은 무의미한 문구가 노출되던 버그 발견 — 운영기간 있으면 그걸 표시, 클래스는 "상시 운영", 둘 다 없을 때만 지역명으로 폴백
- 대부분 팝업인데 간혹 클래스/축제가 섞여 나오는 리스트에서 축제는 지역 배지로 구분됐지만 클래스는 표기가 없던 것을 발견 — `category='class'` 항목에 '클래스' 배지 추가 (`_popularity_rows()`에 category 필드 추가해 프론트에 노출)

#### 3. 장소 리스트 검색바 제거 + 인기순/최신순/마감임박순 정렬 도입
- "특정 팝업을 찾으러 오는 게 아니라 둘러보러 온다"는 판단 하에 검색바 제거, 그 자리에 3단 정렬 버튼(인기순/최신순/마감임박순)으로 교체 (백엔드 `/places`에 `sort=popular`(신규, 최근 30일 조회+좋아요 JOIN 스코어링)/`closing`(신규, `end_date ASC`) 옵션 추가)
- **최초 기본값은 인기순이 아니라 랜덤으로 수정** — 인기순을 기본으로 두면 소수 항목에 트래픽이 계속 쏠리는 자기강화 문제가 재발할 수 있다는 우려(48시간 랭킹 창 도입 때와 동일 이유)로, 정렬 버튼 어느 것도 안 눌린 초기 상태(=백엔드 기본 랜덤)로 시작하고 사용자가 누르는 순간부터 해당 정렬 적용
- 기존 `/search` 백엔드 엔드포인트 자체는 남겨둠(다른 용도 재사용 가능성 대비), UI에서만 제거

#### 4. 상세페이지 배지 3종 추가 (핫플인증/마감임박/NEW) + 랭킹 갱신 주기 단축
- "핫플레이스 상세" 라벨 옆에 조건부 배지: **핫플인증**(현재 TOP25 진입 시 순위 + 랭킹 갱신 시각 표시), **마감임박**(D-3 이내, 클래스/이미 종료된 곳 제외), **NEW**(등록 7일 이내)
- `/places/{id}`가 `hot_rank`/`hot_rank_updated_at`/`created_at`을 추가 반환하도록 확장
- 인기 랭킹 갱신 주기를 8시간→4시간 간격(하루 3회→6회)으로 단축(48시간 집계 창은 유지) — 단순 집계 쿼리 실행 횟수만 늘어나는 거라 서버 부하 영향은 미미

#### 5. 핫플 랭킹/어드민 CSV에서 원데이클래스 제외
- 어드민 CSV 8위에 원데이클래스(`category='class'`)가 섞여 나온 것을 사용자가 발견 — `place_views` 직접 조회로 조회수 자체는 이상 없음(진짜 누적된 조회) 확인했으나, CSV가 "이번주 핫플 팝업" 기사 작성용이라 학원류가 섞이면 편집상 어색하다는 판단으로 `_popularity_rows()`에 `category IS NULL` 조건 추가 — 팝업만 집계(축제는 category도 NULL이라 그대로 유지, 클래스만 제외)
- 이 변경으로 상세페이지 배지 3종 항목에서 추가한 "클래스" 배지는 이제 이 랭킹에 클래스가 아예 안 들어와 실질적으로 트리거될 일이 없어짐(제거하진 않음, 죽은 코드 아님 — 다른 랭킹 없는 리스트뷰에서 재사용 가능)

### 2026-07-19 — 하단 네비 개편(코스/매거진) + 매거진 신규 + 용산→강북 + 애널리틱스 버그 수정

#### 1. 하단 네비게이션 개편: '테마'+'AI코스' → '코스' 통합, '매거진' 신설
- 기존 5개 탭(핫플/지도/장소/**테마**/**AI코스**)을 핫플/지도/장소/**코스**/**매거진**으로 재편 — 테마와 AI코스를 '코스' 탭 하나로 합치고 그 안에서 서브탭(AI코스 | 테마)으로 전환
- 공연/제주/축제 지역엔 AI코스가 없어 예전엔 리스트 탭으로 강제 이동시켰는데, 이번엔 '코스' 탭 안에서 자동으로 '테마' 서브탭으로 대체(테마는 지역 무관 통합 운영이라 항상 가능) — 더 자연스러운 폴백으로 개선
- 기존 `?tab=theme`/`?tab=tour` 딥링크(플레이스 상세, 마이페이지 "테마 만들러 가기" 등 여러 곳에서 참조)는 코드 수정 없이 '코스' 탭+서브탭으로 자동 매핑되도록 하위호환 처리

#### 2. '매거진' 메뉴 신규 — 맛매치 콘텐츠를 나우 자체 UI로 서비스
- 배경: 맛매치(`nemoneai.com/special/5`)에 나우 관련 기사를 MD 업로드로 계속 쌓고 있는데, 이걸 나우 앱 안에서도 피드로 보여주고 싶다는 요청
- 아키텍처 검토 결과 (a) DB는 같은 서버·다른 database라 직접 JOIN 불가 (b) 콘텐츠 원본 소유·SEO는 맛매치 쪽에 유지하기로 결정(검색은 맛매치로) → **실시간 프록시 방식**으로 결정
  - `now_back`: `GET /magazine`(목록, 맛매치 `specials/5`를 그대로 프록시 + 본문에서 발췌문 생성 + 최신순 정렬), `GET /magazine/{id}`(상세, 맛매치 `posts/{id}` 프록시) 신규 엔드포인트 추가
  - `now_front`: `/magazine`(홈 하단 네비 5번째 탭, 장소 리스트와 동일한 카드 UI + 1번째 카드 아래 광고), `/magazine/[id]`(상세 페이지, 나우 자체 헤더/스타일로 렌더링하되 `<link rel="canonical">`은 맛매치 원문(`nemoneai.com/posts/{id}`)으로 지정해 검색엔진에는 맛매치가 정본으로 잡히도록 처리 — 나우 페이지는 앱 내 열람 UX 전용)
  - 상세페이지 광고는 맛매치 자체 게시글 페이지와 동일한 방식(본문을 `</p>` 기준 절반으로 나눠 그 사이에 삽입)으로 배치

#### 3. '용산' → '강북' 표시 라벨 변경 + '더현대서울' 팝업 스크래핑 추가
- 지역 탭 표시명만 '강북'으로 변경 — 네이버 지도 검색 키워드는 그대로 '용산 팝업스토어' 유지(실제로 '강북구'로 검색하면 결과가 완전히 달라지고 급감하기 때문). 기존 DB 182개 row(`region='용산'`)를 `region='강북'`으로 일괄 재라벨링
- '더현대서울' 팝업스토어(여의도 소재, 지리적으로는 강북/용산과 무관하지만 팝업이 많아 예외적으로 강북 버킷에 포함하기로 함)를 신규 검색 대상으로 추가 (`collector_naver.py`의 `run_deohyundai()`, `run_all()`에도 편입) — 1회 수동 실행해 10건 수집(신규 9/갱신 1)

#### 4. 네이버 애널리틱스 SPA 라우팅 버그 수정
- 랭킹 페이지(`/ranking/place` 등)들이 애널리틱스에서 서로 구별이 안 된다는 문제 제기로 점검 — `NaverAnalytics.tsx`가 `Script`의 `onLoad`에서 페이지뷰를 딱 한 번만 기록하고 있어서, Next.js App Router가 레이아웃을 공유하는 페이지 간 클라이언트 사이드 전환(리마운트 없음) 시 재기록이 안 되는 구조적 버그를 발견
- `usePathname()` 훅으로 경로가 바뀔 때마다 페이지뷰를 재기록하도록 수정 (`/posts/[id]`, `/magazine/[id]`, `/admin` 등 내부 링크로 이동하는 페이지들에 적용됨). 다만 랭킹 3개 페이지는 애초에 내부 링크가 전혀 없어 외부/직접 진입만 존재하므로 이 버그의 직접적인 영향은 아니었을 가능성이 큼 — 실제 원인은 아직 검색 클릭 트래픽이 적거나 네이버 애널리틱스 대시보드에서 "페이지별" 리포트를 따로 봐야 하는 문제일 수 있음(후속 확인 필요)

#### 5. 매거진 UI/광고/정렬 보완
- 매거진 목록 카드를 장소 리스트와 동일한 스타일(풀사이즈 썸네일 + 제목 + 발췌문 + 날짜)로 재구성, 첫 카드 아래 동일한 광고 슬롯(`1670386458`) 삽입
- 상세페이지 광고 위치를 본문 최하단 → 본문 중간(문단 `</p>` 기준 절반 지점, 맛매치 자체 게시글 페이지와 동일한 분할 방식)으로 이동
- 목록 정렬: 맛매치는 오래된 기사가 아래로 쌓이는 구조라, `now_back`에서 `created_at` 역순 정렬을 추가해 나우 쪽은 최신 기사가 위로 오도록 수정

#### 6. 지역 탭 '홍대' 색상 유실 복구
- 하단 네비/플레이스 상세페이지의 지역 탭에서 홍대가 성수와 동일한 에메랄드색으로 보이는 회귀 발견 — `isHongdaeActive` 분기가 누락돼 있었음(핫플 랭킹 카드는 정상적으로 오렌지색 유지 중이었음)
- 기존 핫플 랭킹(`Recommendation.tsx`)이 이미 쓰고 있던 오렌지(`text-orange-600 border-orange-500`)로 통일해 두 지역 탭 구현(`page.tsx`, `PlaceDetailClient.tsx`) 모두 수정

#### 7. 보안 사고 대응 — SQL 인젝션 스캐너 공격 발견 및 조치
- "성수/홍대 클릭이 안 먹힌다"는 제보를 조사하다가 `/ask` 엔드포인트가 SQL 인젝션 스캐너의 실시간 공격을 받고 있고, 그 부작용으로 사이트 전역이 10~20초씩 느려져 있었던 것을 발견
- 실제 SQL 인젝션은 성공하지 않음(파라미터 바인딩 및 화이트리스트 폴백 구조 덕분) — 그러나 `get_embedding`/`generate_answer`/`generate_walking_tour`(Gemini 호출)가 동기 함수인데 비동기 핸들러에서 그대로 호출되고 있어, 공격 요청 하나가 uvicorn 이벤트 루프 전체를 막아버리는 구조적 문제가 실제 원인이었음
- `/ask`, `/search`, `/itinerary`에 `lang` 화이트리스트 검증 추가 + Gemini 호출을 `asyncio.to_thread`로 오프로딩 — 공격이 계속되는 상태에서도 `/places` 응답 0.07~0.1초로 즉시 정상화 확인
- 추가로 `/feedbacks` 게시판도 같은 계열의 스팸(179건, SQLi 스캐너 페이로드)을 맞고 있던 것을 발견해 데이터 정리 + 인증 구조 전면 개편(Supabase 토큰 서버 검증, 로그인 필수, 본인/관리자만 수정·삭제)
- 인프라 조사 결과 now/matmatch 서버의 앱 포트(3000/3002/8080/8081)가 방화벽 없이 공인 IP에 직접 노출돼 nginx/도메인을 건너뛸 수 있는 상태였음을 발견 — iptables로 127.0.0.1만 허용하도록 차단, `iptables-persistent` 설치로 재부팅 후에도 유지되게 처리
- 별도 VM인 msm(주식 서비스)도 함께 점검 — 현재는 공격받지 않는 상태이며, GCP 클라우드 레벨 방화벽이 이미 포트 직접 접근을 차단 중이라 now/matmatch와 달리 애초에 안전했음. 2026-06-25에 12분간 동일 계열 스캔 시도가 있었으나 전부 FastAPI 타입 검증에서 거부됨(DB 도달 전 차단)
- 상세 기록은 `security_incident_2026-07-19.md` 참고

### 2026-07-21 — 제주 5번째 지역 신설 + 데이터 유실 사고 대응 + 어드민 보안 수정 + 텔레그램 봇

#### 1. 서브탭 리팩토링: 지역별 카테고리 하드코딩 → DISTINCT 기반 동적 렌더링
- 계기: "카테고리 늘어날수록 지역마다 있고 없고가 갈리기 시작하는 지금이 정리할 타이밍"이라는 문제 제기
- `main.py`에 `GET /places/categories?region=` 신규 — 해당 지역에 실제(만료 안 된) 데이터가 있는 category만 DISTINCT로 반환
- `page.tsx`/`PlaceDetailClient.tsx` 둘 다 하드코딩 배열(`['popup','class','shopping','전시']`) 대신 이 엔드포인트 결과로 서브탭을 그림 — 지역/카테고리가 늘어나도 코드 수정 없이 자동 대응
- 팝업이 `category IS NULL`로 저장되던 기존 관행 때문에 DISTINCT 결과에 안 잡히는 문제 발견 → 모든 관련 쿼리에 `COALESCE(category, 'popup')` 적용

#### 2. 제주를 5번째 독립 지역으로 승격 (기존엔 '공연' 하위 서브탭이었음)
- 지역 탭 구조를 성수·홍대·강북·강남·제주(장소형, 지도+AI코스+서브탭 전부 지원) | 공연·축제(이벤트형, 리스트만) 2그룹으로 재편, '|' 구분선으로 시각적 분리
- 제주 대표색은 기존 '공연>제주' 서브탭이 쓰던 블루(`#0369a1`)를 지역 자체 색으로 승격
- 데이터 소스 3종 신설: 네이버 지도(팝업/원데이클래스, 기존 인프라 그대로 재사용), 비짓제주 API(쇼핑/행사)
- 코피스(KOPIS) 제주 스크래핑은 이번에 중단(비짓제주로 대체) — 기존 kopis_/jeju.go.kr(jeju_)/문체부API(culture_) 3종 레거시 공연 데이터는 SEO 색인 보존을 위해 DB엔 남기되, 신규 목록·랭킹·AI코스·AskAI 전부에서 접두어 기반으로 제외 처리
- 지도(`MapView.tsx`)·AI코스 컴포넌트(`AITour.tsx`/`AskAI.tsx`)에 제주 좌표/색상/영문라벨 추가하는 과정에서 미지원 지역이 항상 'Hongdae'로 라벨링되던 기존 버그, `PlaceDetailClient.tsx`가 제주의 실제 네이버 팝업 데이터를 "공연 지역"으로 오분류해 네이버지도 링크를 숨기던 버그 등 발견해 같이 수정

#### 2-1. 비짓제주 API 통합 — 시행착오
- 1차: 공개 문서화된 `vsjApi/contents/searchList`(apiKey 필요) 사용 — 짧은 소개문만 나옴, 이용시간/편의시설 등 구조화 필드 없음, 기간(시작/종료일) 필드 자체가 없어 "진행중만 필터링"이 처음엔 불가능하다고 판단
- Playwright로 실제 브라우저가 상세페이지 로드 시 호출하는 네트워크 요청을 관찰해 비공식 내부 API 2종 발견: `api/contents/read`(단건 상세 — 이용시간/편의시설/장애인시설/홈페이지 링크 포함, apiKey 불필요 — 아무 페이지나 한 번 GET하면 서버가 익명 세션 쿠키를 내려줌), `api/contents/list`(목록 — `festivalcontents=y&state=ing&year=&month=` 조합 시 서버가 실제로 "진행중" 상태 필터링을 해주고, `sbst` 필드에 상세 API 없이도 풍부한 전체 설명이 포함돼 있음)
- 최종적으로 `api/contents/list` 하나로 쇼핑(c2)/행사(c5) 통합 — 행사는 이번달+다음 2개월치를 `state=ing`로 훑어 진짜 "진행중"만 수집(69건), 쇼핑은 상시운영으로 보고 전량 페이지네이션 + 건당 상세 API로 이용시간/편의시설 보강
- 중간 버그: 쇼핑 카테고리 값을 한글 `'쇼핑'`으로 저장했는데 나머지 코드 전체(Visit Seoul 쇼핑 포함)는 영문 `'shopping'` 컬럼값 규칙을 쓰고 있어서 프론트 서브탭에 쇼핑 탭 자체가 안 뜨던 버그 — DB 백필 + 스크래퍼 수정으로 해결
- 비공식 API라 스펙 변경 리스크 있음, `scraper_visitjeju.py` 상단 주석에 실측 사항 상세 기록해둠

#### 3. 데이터 유실 사고 조사 → 미인증 삭제 API 발견 (보안 수정)
- 재수집 전후로 제주 행사 데이터가 707건→378건으로 줄어든 것을 사용자가 발견, 원인 조사
- "옛 공연 데이터 이관 중 유실 아니냐"는 의심에 대해 소스별(kopis_/jeju_/culture_/visitjeju_) row 수를 대조해 옛 소스 3종은 전혀 안 건드려졌고 순수 오늘자 신규 비짓제주 데이터만 사라졌음을 확인
- 서버 로그에서 `DELETE /places/{id}` 호출 75건 발견 — 확인해보니 **이 엔드포인트에 인증 체크가 전혀 없어** 로그인 없이 ID만 알면 누구나 삭제 가능한 상태였음(어드민 화면 로그인은 프론트 UI에만 있고 백엔드 API는 막혀있지 않았음)
- `main.py`: `DELETE /places/{place_id}`에 `Depends(_verify_supabase_user)` + `ADMIN_EMAIL` 체크 추가(기존 `/feedbacks` 인증 패턴과 동일). `admin/page.tsx`: 삭제 요청에 `Authorization: Bearer <supabase access_token>` 헤더 추가
- 잔여 309건(새 `state=ing` 3개월 윈도우 밖의 옛 행사)은 실제로 최근(2026년 3~5월) 관리되던 정상 데이터로 확인돼(예: 이미 끝난 5월 축제) 수동 삭제하지 않고 기존 30일 롤링 만료 + 45일 유예 메커니즘에 자연 정리를 맡기기로 함

#### 4. 어드민 블로그갱신 시 프론트 캐시(ISR) 미반영 버그 수정
- "어드민에서 블로그갱신 눌러도 5분 뒤 봐도 그대로, 새로고침해야 바뀐다"는 제보 조사
- `/posts/[id]`가 `revalidate: 300`(5분) ISR을 쓰는데, on-demand revalidate를 트리거하는 `_revalidate_place()`가 **블로그갱신 엔드포인트(`/places/{id}/enrich`)에서 아예 호출 안 되고 있었음** — 일반 저장 플로우만 호출하고 있었음
- 더 근본적인 문제 발견: revalidate 요청 자체가 프론트 서버에 `ADMIN_SECRET_KEY` 환경변수가 아예 없어서 **모든 revalidate 시도가 "Invalid secret"으로 조용히 실패 중**이었음(일반 저장 포함, 넓은 범위의 기존 버그) — `/var/www/now_front/.env`에 백엔드와 동일한 키 추가로 해결
- `enrich_place_content`에도 `_revalidate_place()` 호출 추가

#### 5. 텔레그램으로 블로그갱신 원격 트리거 (신규, 로컬 전용)
- 배경: 블로그갱신(pcmap 스크래핑)은 Playwright가 로컬에만 설치돼 있어 로컬 백엔드에서만 동작 — 외출 중엔 테일스케일로 로컬 접속 → 어드민 로그인 → 이름/번호 검색 → 클릭, 매번 여러 단계를 거쳐야 했음
- `telegram_admin_bot.py` 신설 — 등록된 chat_id로 플레이스 ID 숫자만 보내면 `enrich_place_content`와 동일한 로직을 실행하고 결과(생성된 소개문 미리보기)를 답장으로 전송. 기존 `notification.py`(발신 전용)에 수신 폴링을 추가하는 구조
- `main.py`의 `enrich_place_content` 로직을 `_enrich_place_core()`로 분리해 HTTP 엔드포인트와 텔레그램 봇 양쪽에서 재사용
- **로컬 전용 가드 필수**: 프로덕션 서버는 Playwright가 없어 애초에 실행 불가능한데다, 텔레그램 `getUpdates` 롱폴링을 로컬/프로덕션 두 곳에서 동시에 하면 충돌하므로 로컬 `.env`에만 있는 `TELEGRAM_BOT_ENABLED=true`로 게이트 — 프로덕션 `.env`에는 절대 추가하면 안 됨
- 실제 텔레그램으로 번호 전송 → 봇이 스크래핑+Gemini 생성+DB저장+캐시무효화까지 처리하고 결과 회신하는 것까지 실기 테스트 완료

#### 6. 챗봇(AskAI) 답변을 테마로 저장하는 버튼 추가
- 계기: 챗봇에 "7월30일 제주일정을 짜죠" 식으로 물어보면 실제 장소 리스트가 딸린 답변이 오는데, 이걸 마이페이지/테마지도에 바로 저장하고 싶다는 요청
- 백엔드 신규 작업 없이 기존 `POST /themes/save`를 그대로 재사용 — title=직전 사용자 질문, description=AI 답변 텍스트, places=답변에 딸린 장소 목록(id/title/location), region=현재 지역
- `AskAI.tsx`: 장소가 딸린 답변 카드 아래 "테마로 저장" 버튼 추가, 로그인 안 된 상태면 구글 로그인 유도. 저장 성공 시 버튼이 "저장됨"으로 바뀜(중복 저장 방지)
- 테마는 공개/비공개 구분 필드가 없어 저장하는 즉시 공개 테마지도에도 노출됨(기존 테마들과 동일한 동작) — 로그인 필수인 이유이기도 함
- 챗봇이 주는 장소 정보엔 썸네일(image_url)이 없어 테마 카드에 플레이스홀더 이미지로 표시됨 — AI코스(저장된 코스)도 마찬가지로 썸네일이 없어 원래 다른 테마들과 표시 방식이 다른 상태였음을 확인, 이번엔 일단 그대로 두고 추후 한 번에 정리하기로 함

### 2026-07-22 — msm VM으로 matmatch+now 인프라 통합 이전 + 컷오버 사고 대응 + 보안 취약점 추가 발견

#### 1. matmatch+now를 msm VM으로 통합 이전 (Phase 1~4 완료)
- 배경: msm(주식 서비스)은 포트폴리오용 최소 서비스로 축소하고, matmatch&now(핵심 사업)를 msm의 안정적인 VM 하나로 합쳐 인프라를 단순화하기로 결정
- Phase 1(VM 준비): msm VM에 venv/앱 소스/빌드 배치, msm 자체 포트를 8080/3000에서 8095/3005로 이전해 matmatch 표준 포트(8080/3000)를 그대로 쓸 수 있게 함
- Phase 2(DB 이전): 구 Cloud SQL 인스턴스의 `nemone_now`/`postgres`(→`matmatch`) DB를 msm-db 인스턴스로 pg_restore, row-count 대조로 무결성 확인
- Phase 3(기능검증): pgvector, 양쪽 프론트/어드민, 보안 수정 유지 여부, Gemini 연동, GCS 썸네일 업로드까지 검증 — GCS는 처음에 msm VM이 다른 GCP 프로젝트 소속이라 403이 났으나 사용자가 구 콘솔에서 버킷 IAM 권한을 직접 부여해 해결
- Phase 4(DNS/SSL 컷오버): home/nemoneai.com(+www)/admin/auth/now.nemoneai.com 5개 도메인을 Gabia에서 순차적으로 msm VM(34.64.111.65)로 전환, 각각 certbot SSL 발급 후 로그인/댓글/좋아요/어드민편집/검색엔진 인증파일/GA/사이트맵 등 실기 테스트
- Phase 5(구 VM/DB 정리)는 컷오버 후 24~48시간 모니터링 기간을 갖기로 하고 아직 보류 중 — 구 서버(34.64.98.113)는 롤백 안전망으로 당분간 유지

#### 2. PM2 데몬 전체 다운 사고 — 원인 규명 및 재발 방지
- 컷오버 직후 now.nemoneai.com 502, nemoneai.com이 matmatch 대신 msm 콘텐츠를 보여주는 장애 발생
- journalctl/pm2.log 대조 결과, Phase 1 포트 정리 작업 중 실행했던 `sudo pkill -f 'God Daemon'` + `fuser -k 8080/tcp` + `fuser -k 3000/tcp`가 PM2 데몬 자체를 통째로 죽인 게 직접 원인으로 확인됨
- 이 세션에서 matmatch/now 프로세스 6개를 추가한 뒤 `pm2 save`를 한 번도 안 해서, 데몬 재기동 시 msm 3개짜리 옛 dump로 복구되며 나머지가 전부 증발 — 추가로 되살아난 msm-backend/frontend가 `ecosystem.config.js`에 실제로는 반영 안 돼있던 구 포트(8080/3000)로 뜨면서 matmatch 포트를 뺏은 것까지 겹쳐 장애가 커짐
- `ecosystem.config.js` 포트를 실제로 8095/3005로 고치고 9개 프로세스 전부 재기동 + `pm2 save`로 정상 상태 영구 저장 — 재발 방지 차원에서 앞으로는 전체 데몬킬 대신 `pm2 stop <이름>` 방식만 쓰기로 함

#### 3. 컷오버 후속으로 드러난 잔여 버그 3종
- **matmatch 어드민 "기사 리스트 안 뜸"**: 어드민의 BFF 프록시(`adminProxy.ts`)가 `BACKEND_URL` 환경변수 미설정 시 구서버(`34.64.98.113:8080`) 하드코딩 폴백을 쓰고 있었는데, 구서버 8080은 외부에 안 열려있어 전부 실패 — msm 로컬(`127.0.0.1:8080`)로 `.env.local` 수정
- **로컬 스크래핑이 구 DB를 보고 있던 문제**: now_back/matmatch backend 로컬 `.env`가 여전히 구 Cloud SQL(`34.64.236.78`)을 가리키고 있어, 로컬에서 돌리는 스크래퍼나 텔레그램 트리거가 새 서버엔 반영 안 되는 데이터를 구DB에만 쌓고 있었음 — msm-db 공인 IP(`34.50.63.89`)를 Cloud SQL 승인된 네트워크에 등록하고 로컬 `.env` 2개를 새 DB로 전환, row-count 대조로 정상 연결 확인
- **텔레그램으로 갱신한 place(6835)가 실제 라이브에 반영 안 됨**: 위 구DB 문제가 원인 — 구DB에서 갱신된 content/blog_reviews를 새DB로 수동 복사 + revalidate 트리거로 즉시 복구

#### 4. msm 축소 작업 착수
- 18:00 평일 `daily_batch_analysis`(스코어링+DART 펀더멘탈+백테스트) 스케줄러 잡 중단 — msm은 종목분석(SaintJin 스캔)만 남기고 이 배치는 없애기로 한 결정의 첫 실행
- `/api/daily`, `/api/daily/value`의 "오늘 데이터 없으면 최근 7일 내에서 폴백" 로직을 "DB에 있는 가장 최근 날짜로 무기한 폴백"으로 변경 — 배치가 영구히 안 도는 상태에서도 마지막 생성분이 프론트에 고정 노출되게 함(사용자 요청: "그냥 움직이지 않는 텍스트로 박아놓고")
- 08:10 `morning_price_refresh`도 위 배치 중단으로 오늘자 row가 없어 no-op이 된 상태라 같이 중단
- 16:30 `crawl_ohlcv_daily`(200종목, SaintJin 스캔이 실제로 쓰는 데이터라 유지)는 실측 결과 배치 전후 메모리 변화가 거의 없어(320~360MB 유지) 200개 종목 유지로 결정 — 메모리를 잡아먹던 건 이미 중단한 18시 배치였음

#### 5. msm VM 헬스체크 자동화 신설
- PM2 프로세스 상태 + 주요 도메인 응답을 10분 간격으로 점검하는 `healthcheck.sh`를 cron에 등록
- 프로세스 다운 감지 시 `pm2 restart` 자동 시도 후 성공/실패 결과를 텔레그램으로 알림, 상태가 바뀔 때만 알림을 보내 스팸 방지
- PM2 데몬 다운 사고를 계기로 만든 것 — 앞으로 유사 사고 발생 시 사람이 알아채기 전에 자동 복구+알림이 되도록 함

#### 6. now 보안 취약점 추가 발견 — `/ask`, `/itinerary` 완전 무인증 상태였음
- 계기: "챗봇 첫 질문 입력 시 인증 필요하게 해달라, 지난번처럼 트래픽 공격 안 되게"라는 요청으로 점검 시작(과거 `/ask` SQL 인젝션 스캐너 공격 및 `/feedbacks` 스팸 사고 이력 있음, 상단 2026-07-19 기록 참고)
- 확인해보니 프론트(`AskAI.tsx`)는 UI상 로그인 체크가 아예 없었고, `/itinerary`(AI코스)는 프론트만 로그인을 요구할 뿐 **백엔드 자체엔 인증이 전혀 없어 API를 직접 호출하면 완전히 우회 가능한 상태**였음
- `main.py`의 `/ask`, `/itinerary` 양쪽에 `Depends(_verify_supabase_user)` 추가, `AskAI.tsx`/`AITour.tsx`에 로그인 체크 및 `Authorization: Bearer` 헤더 전송 추가 — 무인증 요청 401 확인
- 겸사겸사 피드백 게시판은 반대 방향으로 조정: 읽기는 로그인 없이 가능하게(백엔드 `GET /feedbacks` 인증 제거), 쓰기만 로그인 요구하도록 프론트 로그인 전체 차단 화면 제거

#### 7. now 프론트엔드 버그 수정 모음
- **장소 메뉴 지역 탭 2줄 줄바꿈**: 제주 추가 이후 지역+이벤트 탭이 8개로 늘면서 좁은 화면에서 줄바꿈 발생 — `overflow-x-auto` 가로 스크롤로 전환(`page.tsx`, `PlaceDetailClient.tsx`)
- **매거진 탭 하단 풋터 안 보임**: 매거진 탭 컨테이너에 불필요하게 걸려있던 `h-full` 클래스 제거로 해결
- **AskAI 챗봇 중국어(zh) 미지원**: 챗봇 UI 텍스트 딕셔너리에 zh 번역이 통째로 빠져있어(en만 있고) 중국어 선택 시 한국어로 폴백되던 문제 — zh 번역 추가, 지역명 표시 및 답변 속 "바로가기" 링크 텍스트도 언어별로 분기
- **공연/축제 카테고리 다국어 미지원 확인**: KOPIS 스크래퍼가 `title_en=""`으로 번역을 아예 시도 안 해 en/zh 모드에서 한국어 원문으로 폴백 중인 것을 확인 — 프론트 폴백 덕에 빈 화면은 아니지만 다른 카테고리와 번역 일관성이 없는 상태, 개선 여부는 보류 중. 장기적으로는 공연/축제를 이벤트형이 아닌 정식 지역으로 편입하고 지역 자체도 확대하는 방향을 사용자가 구상 중(아직 미착수)

### 2026-07-23 — msm CI/CD가 matmatch/now를 반복적으로 다운시키던 근본 원인 발견 + 톱25 NEW 배지 + 이중 방화벽

#### 1. [치명] msm-v5 CI/CD 배포가 같은 VM의 matmatch/now를 통째로 다운시키던 문제
- 어제(2026-07-22) PM2 데몬 전체 다운 사고를 "누군가 수동으로 `pkill -f 'God Daemon'`을 쳤다"로 결론 내렸으나, 오늘 msm-v5에 push할 때마다 **똑같은 장애가 재발**하면서 진짜 원인 파악 — `/home/ubuntu/msm-v5/deploy.sh`(msm 전용 GitHub Actions 배포 스크립트)가 PM2 재시작 단계에서 `pm2 kill` + `sudo pkill -f "God Daemon"` + `fuser -k 8080/3000`을 실행하고 있었음
- msm이 VM을 단독으로 쓰던 시절엔 문제없던 코드지만, 2026-07-22 인프라 통합 이전 이후로는 **msm-v5에 push할 때마다 같은 PM2 데몬을 공유하는 matmatch/now 6개 프로세스까지 전부 죽는 구조**가 됨 — 게다가 `pm2 save`까지 실행해 msm 3개짜리 상태로 영구 저장까지 해버려 재발 방지 조치(어제 넣은 `pm2 save`)도 매번 무력화됨
- 부가 발견: `ecosystem.config.js`의 포트 수정(8080→8095, 3000→3005)이 그동안 서버에만 되어있고 **git엔 한 번도 커밋된 적이 없어서**, `deploy.sh`의 `git reset --hard origin/main`이 돌 때마다 포트가 구값으로 되돌아가 matmatch와 충돌 — 이것도 같은 근본 원인(코드와 서버 상태 불일치)의 연장선
- 조치: `deploy.sh`를 `pm2 delete msm-backend msm-frontend cloud-sql-proxy` + `pm2 start ecosystem.config.js`로 스코프 축소(데몬 전체를 절대 안 건드림), `ecosystem.config.js` 포트 수정을 이번엔 실제로 커밋+푸시. 수정 커밋을 push해 CI가 실제로 다시 도는 것까지 지켜봤고, matmatch/now 6개 프로세스는 uptime이 전혀 안 끊기고 msm 3개만 깨끗이 재시작되는 것으로 검증 완료
- 이 과정에서 msm 프론트(`next.config.js`)의 SSE 프록시 리라이트 대상도 구 포트(8080)로 하드코딩된 채 방치돼있던 것을 같이 발견해 수정("종목분석 연결 끊김" 버그의 원인이었음) — Next.js는 rewrites를 빌드타임에 고정하므로 config만 고치고 재시작해선 반영 안 되고 재빌드가 필요했다는 점도 확인

#### 2. 톱25 신규 진입 'NEW' 배지
- "톱25 중 어떤 게 블로그갱신 안 됐는지 어드민에서도 잘 안 보인다"는 문제 제기에서 출발 — 완전 자동 갱신은 Playwright가 로컬 전용이라 불가하다고 설명 후, 대안으로 "4시간 동안 없던 플레이스가 새로 등장하면 NEW 표시"로 범위 좁혀 진행
- `refresh_place_popularity()`가 4시간마다 이전 톱25와 대조해 신규 진입 id를 계산, DB 스냅샷 테이블(`ranking_snapshot`)에 저장 — 인메모리 캐시만 쓰면 재배포할 때마다 전부 NEW로 오탐되는 문제가 있어 DB로 영속화
- 1차 구현에 결함 발견(사용자 지적): `refresh_place_popularity()`가 서버 재시작 시에도 호출되는데, 그때마다 스냅샷을 덮어쓰면 4시간이 안 지나도 NEW가 사라짐 — 마지막 스냅샷 후 3시간 미만이면 스냅샷 자체를 갱신하지 않고 기존 기준선으로만 비교하도록 수정, 강제 재시작을 시뮬레이션해 NEW 개수가 안 흔들리는 것까지 검증
- 어드민 "갱신됨" 배지도 같이 손봄 — 원래 `updated_at` 유무로 판단해 부정확했던 것을 `blog_reviews` 존재 여부로 변경했다가, 이마저도 4시간 주기 캐시라 캐시 갱신 사이에 블로그갱신해도 "미갱신"으로 잘못 나오는 것을 발견해 `/admin/ranking/weekly`가 blog_reviews만은 실시간 DB 조회로 덮어쓰도록 재수정

#### 3. 기타 프론트 조정
- 핫플 랭킹(코스/테마/플레이스/공연/축제) 5개 전부 광고 위치를 3번째→2번째 항목 뒤로 이동(첫 화면에 광고가 안 보인다는 피드백)
- 하단 네비게이션 패딩 축소(`pt-3 pb-6`→`pt-2 pb-4`) — 사파리에서 과도하게 커 보이던 문제

#### 4. 서버 이전 후 보안 태세 재점검 + 이중 방화벽
- 2026-07-19 사고 대응 때 넣었던 조치들이 msm VM 이전 후에도 유지됐는지 점검 — 코드 레벨(인증, lang 화이트리스트, 비동기 오프로딩)은 파일이 그대로 옮겨져 문제없었고, 인프라 레벨(포트 직접 노출 차단)은 msm VM 자체 iptables엔 규칙이 없었지만 **msm이 원래 갖고 있던 GCP 클라우드 방화벽을 matmatch/now가 물려받아 실질적으로는 이미 안전**했던 것으로 확인
- 그래도 이중 안전장치로 iptables를 VM에도 겹쳐 적용 — 8개 포트(3000/3001/3002/3003/8080/8081/8095/3005)를 127.0.0.1 외 차단, `iptables-persistent`로 재부팅 후에도 유지되게 처리. 상세 기록은 `security_incident_2026-07-19.md`의 2026-07-23 후속 섹션 참고

#### 5. 로컬 스크래핑 신DB 반영 확인 + 텔레그램 봇 상시 구동 + 신규 팝업 자동 블로그갱신
- 오후 2시 코피스/네이버 스크래핑분(코피스 1,125건, 네이버 31건)이 실제로 새 DB(msm-db, `34.50.63.89`)에 정상 반영되는 것을 직접 확인 — 지난 세션에 고친 로컬 `.env` DB 전환이 잘 작동 중임을 재검증
- **텔레그램 봇 상시 구동**: 그동안 텔레그램으로 블로그갱신을 트리거하려면 로컬에서 `python main.py`를 수동으로 띄워둬야 했는데(안 띄워져 있어서 매번 나에게 직접 요청), `com.nemoneai.now.telegram-bot.plist`(launchd)로 등록해 로그인 시 자동 시작 + 크래시 시 자동 재시작되도록 전환. 인터프리터는 기존 스크래퍼 launchd 잡들과 동일하게 `matmatch/backend/venv/bin/python3` 재사용, `-u`(unbuffered)로 실행해 로그가 실시간으로 찍히게 함. 기존에 어제부터(구DB 환경변수로) 떠있던 좀비 프로세스(포트 8081 점유) 정리 후 새로 등록
- **신규 팝업 자동 블로그갱신 스케줄러 추가**: `main.py`에 `AUTO_ENRICH_POPUPS=true`(로컬 전용 게이트) 시에만 동작하는 APScheduler 잡 추가 — `blog_reviews IS NULL`인 네이버 팝업(공연/축제/코피스/비짓제주 등 제외) 중 매주 스크래핑 주기에 맞춰 **최근 7일 이내 생성분만** 오래된 순으로 10분마다 1건씩 자동 처리
  - 처음엔 기간 제한 없이 "미갱신 전체"를 대상으로 설계했다가, DB 확인 결과 6/25부터 쌓인 백로그가 157건이나 있어(하루 종일 걸릴 뻔) 사용자 지적으로 7일 이내로 범위 축소 — 그 이전 백로그는 기존처럼 어드민/텔레그램 수동 트리거로만 처리
  - 배치 크기 1건 + 항목당 120초 타임아웃 적용 — Playwright가 멈춰도 다음 주기(10분, 처음엔 5분이었으나 "불안하다"는 이유로 늘림)를 막지 않도록 안전장치
  - 프로덕션 서버엔 `AUTO_ENRICH_POPUPS` 환경변수 자체가 없어 코드가 배포돼도 잡이 등록조차 안 됨(Playwright 없는 서버에서 절대 실행되지 않도록 보장)

### 2026-07-24 — 대표 공유이미지 교체 + 구글 서치콘솔 크롤링 오류 리뷰 후 실제 이슈 2건 수정

#### 1. 카카오톡/SNS 공유 시 대표 이미지가 랜덤 팝업 썸네일로 뜨던 문제
- `og-image.png` 자체가 프로젝트에 없어서 OG 이미지 지정이 사실상 무효 상태였고, 그 결과 공유 시 매번 다른 팝업 썸네일이 대표 이미지로 잡히던 것으로 확인
- 브랜드 이미지를 `public/og-image.jpg`로 추가하고 `layout.tsx`의 `openGraph.images`/`twitter.images`를 `.jpg`로 교체

#### 2. 외부에서 받은 구글 서치콘솔 크롤링 오류 분석 검토
- 사용자가 붙여준 GSC 리소스 로드 오류 리스트를 그대로 반영하지 않고 항목별로 실제 원인을 직접 재확인 — 상당수는 이미 조치됐거나 실제 크롤링에 영향 없는 항목으로 판단, 실제로 손볼 가치가 있는 2건만 수정:
  - **외부 Google Fonts fetch**: `layout.tsx`가 `fonts.googleapis.com`을 `<link>`로 직접 불러오고 있어 Googlebot 크롤링 시 외부 fetch 실패/타임아웃 리스크가 있었음 — `next/font/google`(Inter, Space Grotesk)로 빌드타임 자체 호스팅 전환, 외부 요청 자체를 제거(CLS 개선도 부수 효과)
  - **KOPIS 포스터 이미지 혼합 콘텐츠**: `scraper_kopis_concert.py`가 KOPIS 포스터를 그대로(`http://`, 비HTTPS) 핫링크하고 있어 HTTPS 페이지에서 혼합 콘텐츠가 되고 KOPIS 서버 상태에도 의존하던 문제 — 다른 소스(네이버/비짓서울/비짓제주)와 동일하게 `rehost_image()`로 우리 스토리지에 재호스팅하도록 수정

### 2026-07-25 — NEW 배지 검증체계 + 공연/축제/지역 랭킹 개편 + '이런 곳도 있어요' 개선

#### 1. 네이버 서치어드바이저 "description 중복" 재확인 — 조치 불필요로 결론
- "1300페이지"라던 지적이 실제로는 "120개"였고, 개수가 지난번에 이미 고친 홈(`/`) 쿼리스트링 이슈(64/120건)와 정확히 일치 — `middleware.ts`의 `X-Robots-Tag: noindex`가 실서버에 이미 정상 배포·작동 중임을 `curl`로 재확인, 추가 조치 없이 네이버 재크롤링에 따른 자연 소진 대기로 결론
- 조사 과정에서 별개로 발견한 문제 하나는 그대로 수정: `posts/[id]` 상세페이지가 만료·삭제된 place에 대해 `notFound()` 없이 200으로 "운영이 종료됐습니다" 화면만 보여주고 있었고, 이때 `generateMetadata`가 description을 아예 안 정해줘서 사이트 전역 기본 description을 그대로 상속받고 있었음 — 만료 페이지 전용 title/description을 지정하고 `robots: { index: false }`로 색인 제외 처리

#### 2. 톱25 NEW 배지 검증체계 구축
- "몇 번째 사이클째 NEW가 안 붙는다"는 문의에 대응하려 했으나 `ranking_snapshot`이 직전 상태 1줄만 덮어쓰는 구조라 소급 검증이 불가능했던 것 확인 — `prev_top25_ids` 컬럼을 추가해 직전 한 사이클치 톱25를 같이 보관, PM2 로그에도 사이클마다 직전/이번/new_ids를 남기도록 추가해 다음부터는 DB 조회 없이 로그만으로 확인 가능
- 확인 결과 방금 지목된 항목은 조회 이력상 조회수가 낮고 오래전부터 순위 경계선 근처에 있던 것으로 보여, 버그가 아니라 "직전 사이클에도 이미 톱25 안에 있었을 가능성이 높음"으로 결론 (100% 소급검증은 이력 미보관 한계로 불가)

#### 3. 공연/축제 랭킹 개편
- 공연 랭킹 배지가 항상 "공연" 고정이던 것을 실제 서브장르(연극/뮤지컬/음악/종합)로, 하단 텍스트도 "서울 공연" 고정문구 대신 실제 일정(`date_range`)으로 변경
- 공연·축제 랭킹 둘 다 NEW 배지 신규 추가 — 원래 플레이스 랭킹에만 있었고 이 두 랭킹엔 아예 구현이 안 돼 있었음(그래서 사용자가 한 번도 못 본 것). 플레이스 랭킹과 동일한 스냅샷 방식(`performance_ranking_snapshot`, `festival_ranking_snapshot`)으로 추가
- 축제 랭킹 일정 미표시 원인 확인: 문체부 지역축제 API(축제 대부분의 출처)가 실제 일정 텍스트(`eventPeriod`)를 갖고 있는데도 `scraper_culture_api_festival.py`가 그걸 `date_range` 필드에 담지 않고 있었음(임의로 숨긴 게 아니라 단순 누락) — 필드 추가 후 즉시 재수집해 기존 70건 중 8건→98건 중 68건으로 백필. 반대로 비짓제주 축제/행사는 소스 API 자체에 구조화된 일정 데이터가 없어 원천적으로 표시 불가

#### 4. 비짓제주 자동 수집 스케줄 추가
- `scraper_visitjeju.py`(쇼핑+행사)가 그동안 launchd/cron 어디에도 등록 안 돼 있던 것을 확인 — 매주 수요일 자정 실행되는 `com.nemoneai.now.collector-visitjeju.plist` 신규 등록

#### 5. 플레이스 랭킹 지역 서브탭 신설
- 목적: 검색 유입 이탈률 개선을 위한 체류시간 증대 — "플레이스 랭킹" 클릭 시 기존처럼 종합(전 지역 통합) 톱25가 나오되, 그 아래 종합/성수/홍대/강북/강남/제주 6개 서브탭으로 지역별 톱25도 탐색 가능하게 함(종합 탭 유지 안을 추천해 채택)
- 백엔드: `_popularity_rows()`에 `only_region` 파라미터 추가, 4시간 주기 갱신 때 5개 지역 톱25를 별도 계산해 `_place_popularity_by_region` 딕셔너리로 캐시, `/places/popular?region=X`로 노출
- 지역 서브탭 NEW 배지도 추가 요청받아 반영 — 지역마다 별도 테이블을 만드는 대신 `place_region_ranking_snapshot` 테이블 하나에 `region`을 PK로 둬서 5개 지역을 구분(공연/축제처럼 지역별 개별 테이블을 만들지 않음)

#### 6. '이런 곳도 있어요' 추천 카테고리 분리
- 목적: 위와 동일(체류시간 증대) — 기존엔 지역만 맞추고 카테고리(팝업/클래스/쇼핑/전시)는 안 가리고 섞어서 추천하던 것을, 팝업 / 클래스+쇼핑("상시 운영" 성격이 같아 하나로 묶음) / 전시 3개 독립 그룹으로 분리해 같은 성격끼리만 추천되도록 수정
- 공연 장르(연극/뮤지컬/음악/종합)·제주 행사(카테고리값 `행사`) 등은 이번 범위 밖이라 기존처럼 지역 전체에서 추천하는 동작 유지

### 2026-07-27 — now_back main.py 리팩토링 완료 (1,897줄 → 98줄, 모듈 분리)

오래 미뤄왔던 main.py 분리(처음 계획 시점엔 1,053줄이었는데 그새 1,897줄까지 커짐)를 3단계 커밋으로 진행. 각 단계마다 로컬 uvicorn 기동 + 주요 엔드포인트 curl 스모크 테스트 → 서버 배포 → 라이브 검증 순서로 안전하게 완료.

#### 새 구조
```
now_back/
├── main.py               앱 조립 전용(98줄): FastAPI 생성/CORS/스키마 업데이트/라우터 등록/스케줄러/봇 게이트
├── deps.py               공용 유틸(순환참조 기준점): _lang_col, _verify_supabase_user, _client_ip, ADMIN_EMAIL, 지역 상수
├── schemas.py            Pydantic 모델 12종
├── ranking_service.py    랭킹 캐시 6종 + _popularity_rows + refresh_place_popularity + 마감임박
├── enrich_service.py     _enrich_place_core + 백그라운드 번역/ISR 재검증 + 신규 팝업 자동갱신 잡
└── routers/
    ├── social.py         좋아요/코스/테마/피드백
    ├── rankings.py       /places/popular* 5종 + closing-soon + /ranking/share*
    ├── ai.py             /ask, /search, /itinerary, usage
    ├── magazine.py       /magazine (맛매치 프록시)
    ├── places.py         장소 CRUD/조회/이미지업로드/enrich 트리거
    └── admin.py          어드민 테마/랭킹/장소/배너/통계
```

#### 이 리팩토링에서 조심했던 두 가지 함정 (다음에 또 만질 때 필독)
1. **랭킹 캐시는 변수 직접 import 금지**: `refresh_place_popularity()`가 캐시 리스트를 global 재할당으로 통째로 갈아끼우는 구조라, `from ranking_service import _place_popularity_cache`처럼 이름을 직접 import하면 갱신 전 리스트에 영원히 고정됨(문법 오류가 아니라 배포 후에야 드러남). 반드시 `ranking.get_popular()` 등 접근자 함수로만 읽을 것 — ranking_service.py docstring에도 명시해둠.
2. **라우터 include 순서**: rankings(/places/popular*, /places/closing-soon)를 places(/places/{place_id})보다 먼저 include해야 함. 뒤바뀌면 'popular'가 place_id(int)로 파싱돼 422 — main.py 등록부에 주석으로 박아둠.

#### 배포 절차 변경 (중요)
- 기존: `scp main.py` 단일 파일 → **이제 금지.** 모듈 세트가 어긋나면 서버 즉사.
- 변경: `tar czf ... main.py deps.py schemas.py ranking_service.py enrich_service.py routers/` 로 py 세트 전체를 묶어 배포. 파일 목록을 명시한 tar라 서버 `.env`는 안 건드림.
- 로컬 launchd 텔레그램 봇도 같은 main.py를 쓰므로 배포 후 `launchctl kickstart -k`로 재기동 필요(이번에 재기동해 새 구조로 정상 폴링 확인 완료).

### 2026-07-28 — 코스 기능 개편 1차 완료 (3시간코스/자유코스 생성·편집·발행)

`/Users/hansjung/Desktop/course_feature_spec.md`(외부 지시서)를 코드베이스 실사와 대조해 실행전략(`course_feature_실행전략.md`)으로 재정리 후 구현. 핵심: **AI가 만들어주는 코스를 유저가 재편집해서 발행**. 테마지도(themes 테이블·`?tab=theme`)는 완전히 손대지 않고 격리.

#### 전략 수정(원본 스펙과 다르게 간 부분)
- **저장 위치를 themes가 아니라 saved_courses로 변경** — 실제 AI코스가 이미 여기 살고 있었고, themes에 얹으면 테마지도와 뒤엉킴. 스펙대로 갔으면 비공개 [퍼감] 테마가 "전부 is_public=true 백필" 지시로 공개 노출되는 사고로 직결됐을 것
- API 위치를 main.py가 아니라 신설 `routers/courses.py`로 (전날 리팩토링한 라우터 구조에 맞춤)
- 장소 검색은 어드민 걸 재사용하는 대신 신규 ILIKE 경량 엔드포인트 신설(벡터 검색은 임베딩 호출 비용 때문에 자동완성 용도로 부적합, 어드민 검색은 애초에 서버 엔드포인트가 없었음 — 브라우저 필터링 방식이었음)

#### 백엔드
- `saved_courses`에 `scope`(timed/free) / `source`(ai_draft/fork/manual/likes) / `forked_from` / `is_public` / `updated_at` 추가
- `POST /courses/draft` — scope=timed(AI 생성, 지역+동행 반영)/free(빈 코스)/source=likes(찜한 장소로 구성) 3갈래. AI 생성 2회/일 한도는 기존 `/itinerary`와 **공유**(명칭이 "3시간코스"로 바뀌어도 한도 우회 창구가 안 되도록)
- `routers/ai.py`에서 후보선정(pgvector)+Gemini 호출 로직을 `generate_timed_course()`로, 레이트리밋을 `check_daily_ai_limit()`/`log_ai_usage()`로 분리해 `/itinerary`(기존, 캐시 있음)와 `/courses/draft`(신규, 매번 새 row 생성이 목적이라 캐시 없음)가 공유
- steps 저장 규칙: `time` 필드는 저장하지 않음 — 시작 14:00 + duration 누적으로 상세 페이지가 렌더 시 계산. **순서를 바꿔도 AI 재호출 없이 시간표가 재배열되는 핵심 장치**
- `POST /courses/{id}/publish` — 제목 미입력 시 "{지역} {상위 카테고리} {개수}곳" 자동 제안(카테고리 최빈값 집계)
- `GET /places/search` — ILIKE 기반, 임베딩 호출 없는 경량 검색
- `POST /place_reports` — 검색 0건 제보 로그, IP 레이트리밋(ranking_share와 동일 패턴)
- 기존 33건 백필(`migrate_courses_v2.py`, 일회성 스크립트 — 기존 관례인 `migrate_*.py`를 그대로 따름): [퍼감] 10건→`source=fork/is_public=false`, 나머지 23건→`source=ai_draft/is_public=true`(기존 노출 동작 그대로 보존), scope 전부 timed
- `GET /courses`(코스 랭킹) 필터를 `title NOT LIKE '[퍼감]%'`에서 `is_public=true`로 교체
- 구 `POST /courses/save`(AITour)는 하위호환 유지하되 `scope=timed/source=ai_draft/is_public=true` 명시해 기존 동작(저장=즉시공개) 보존
- 로컬에서 실제 함수 호출로 전체 플로우 검증(생성→소유자조회→타인차단 404/403→편집→발행→자동제목→빈코스발행차단→찜기반draft→제보→레이트리밋 403) 후 배포

#### 프론트
- `/course`(코스 홈): 3시간코스(지역+동행 선택 모달)/자유코스 CTA + 내 코스 목록 + 일일 생성 잔여 횟수
- `/course/[id]/edit`: 제목/설명 인라인, 스텝 순서(위아래 버튼, 드래그 라이브러리 없어 이 방식 채택)/삭제, 장소 추가 검색 오버레이(0건 시 제보 폼), 임시저장/발행(발행 시 PUT으로 먼저 저장 후 publish 호출)
- `/course/[id]`: SSR + generateMetadata(발행 코스만, 비공개는 404). 스텝을 실시간 장소 데이터로 보강해 이미지/만료여부("종료됨" 배지) 표시, 시간 라벨은 백엔드와 동일하게 14:00+duration 누적으로 렌더 시 계산(값이 아니라 로직을 프론트에도 복제)
- **기존 홈 '코스' 탭의 AI코스 서브탭을 전면 교체** — 클릭 시 `/course`로 리다이렉트, `AITour.tsx` 컴포넌트 삭제. '테마' 서브탭(테마지도)은 그대로 유지. `?tab=tour` 딥링크도 `/course`로 리다이렉트
- 마이페이지 코스 카드: 클릭 시 기존 모달 대신 `/course/{id}/edit`로 이동, scope/공개여부 배지 추가(기존 코스 상세 모달 dead code 제거)

#### 이번 범위 제외(2차)
fork(복사), 인기 코스 목록, 찜 넛지 배너, place_reports 어드민 UI, 발행 코스 grounding — API는 이미 있는 것도 있어(`source=likes` draft, `GET /courses` is_public 필터) 2차는 프론트 노출만 남은 상태

### 2026-07-29 — 코스 기능 2차: 헤더/내비 일관성 통일 + UX 개편 + 인기코스 추천 위젯

1차 배포 직후 "코스메뉴 이동하면 상단타이틀 사라지고 위치를 잃는다"는 피드백을 시작으로 여러 라운드에 걸쳐 코스 관련 페이지 전반의 일관성/UX를 다듬음.

#### 헤더·하단내비 일관성
- `/course`, `/course/[id]`, `/course/[id]/edit`가 독립 라우트라 메인 SPA(`page.tsx`)의 브랜드 헤더(로고+언어토글+로그인)·하단내비가 안 보이던 문제 — `PlaceDetailClient.tsx`에 있던 하단내비를 `components/BottomNav.tsx`로, 헤더 우측 컨트롤(언어토글+마이)을 `components/HeaderControls.tsx`로 각각 공용 추출해 3개 페이지에 적용
- `BottomNav`가 예전 5탭(핫플/지도/장소/**테마**/코스)을 그대로 복제해 메인의 실제 5탭(핫플/지도/장소/**코스**/**매거진**)과 어긋나 있던 것도 동기화
- 메인 SPA `page.tsx`의 코스 탭 서브탭 라벨도 "코스/테마" → **"3시간코스/자유코스"**로 통일, 핫플 탭의 코스 랭킹 라벨도 "코스"→"3시간"

#### `/course` 허브 개편 (여러 라운드 피드백 반영)
- 상단을 큰 CTA 버튼 2개에서 아이콘 탭 2개("3시간코스"/"자유코스")로 변경 — "자유코스"는 로그인 여부와 무관하게 바로 테마 리스트(`/?tab=theme`)로 이동(중간에 실수로 넣었던 로그인 강제/`action=create` 딥링크 모두 제거)
- "AI생성"은 좌하단 무설명 플로팅 버튼 → 목록 위 가로 버튼("AI 자동코스 생성")+안내문구로, 일일 잔여 생성횟수 표시도 목록 페이지가 아니라 모달 안으로 이동
- 내 코스 목록: scope=timed만 필터링, "내가 저장한 코스 재편집" 제목, 항목에 "편집" 명시(기존 `>`만 있던 것), 빈 상태 문구+"코스 랭킹 바로가기"(`/ranking/course`) 버튼 추가
- 메인 하단내비 "코스" 아이콘 클릭 시 디폴트가 (구현 잔재로 인해) 자유코스로 보였던 것 → `/course`(3시간코스 허브)로 직행하도록 통일
- 하단에 네모네스토어 광고배너(`StoreBanner`, 기존 컴포넌트 재사용) 추가
- 테마(`ThemeMenu.tsx`) 쪽도 좌하단 무설명 "+" 버튼 삭제 → 목록 상단 "코스 생성하기" 가로 버튼으로 통일
- DB에 남아있던 예전 버그로 생성된 빈 자유코스(제목 없음, scope=free) 4건 삭제, 백엔드 `POST /courses/draft`도 `scope=free`는 `source=likes` 없이는 400 반환하도록 막아 재발 방지(자유형식 코스는 테마지도와 개념이 겹쳐 별도 구현하지 않기로 결정)

#### 플레이스 상세페이지 — "추천! 인기코스" 위젯
- `components/RecommendedCoursePromo.tsx` 신설, 배너광고와 "이런 곳도 있어요" 사이에 배치
- 3시간코스 1위/테마 1위 중 랜덤 노출 → 클릭 시 모달(3시간코스는 기존 핫플 코스랭킹 모달과 동일한 타임라인 UI로 시간 계산은 값 저장 없이 14:00+duration 누적 재사용, 테마는 장소 카드 리스트)
- 모달 하단 저장하기(기존 `/courses/save`, `/themes/save` 퍼가기 API 재사용)/공유하기(코스는 실제 `/course/{id}` 링크, 테마는 `ranking_share` 신규 생성 링크)/코스생성(`/course`로 이동) 3버튼
- 모달이 `motion.div`로 감싸인 조상 안에 중첩되면서 `fixed` 포지셔닝이 뷰포트가 아닌 조상 기준으로 계산돼 하단내비에 가려지던 버그 — `createPortal`로 `document.body` 직접 렌더링해 해결

### 2026-07-29(2차) — 풋터 추가, 축제 랭킹 무기한노출 버그, 장소 검색+정렬 콤보박스, 네이버 로그인

#### 풋터 누락
- `components/SiteFooter.tsx` 신설(기존 page.tsx/PlaceDetailClient 풋터와 동일 마크업 공용화), 사용자피드백/`/course` 페이지에 빠져있던 풋터 추가

#### 축제 랭킹 — 이미 끝난 축제가 무기한 1위 노출
- 원인: 랭킹 쿼리는 `end_date IS NULL`을 "무기한 활성"으로 취급하는데, "매년 X월초~Y월초" 식 반복 축제는 수집기가 구체적 종료일을 못 만들어 `end_date`가 계속 NULL로 남음
- `scraper_culture_api_festival.py`의 `_end_date_actual()` 수정 — 반복 축제도 이번 회차 종료월 말일을 잠정 종료일로 채우도록(다음 수집 때 자동 갱신, 최소 유한 시점엔 랭킹에서 빠짐)
- DB에 이미 NULL로 남아있던 기존 2건(청수 반딧불이 축제, 인천펜타포트 락 페스티벌) 직접 백필

#### 장소 리스트 — 검색창 + 정렬 콤보박스
- 기존 인기순/최신순/마감임박순 버튼 3개를 오른쪽 콤보박스로 통합(`ChevronDown` 아이콘 — 처음엔 CSS 배경이미지로 화살표를 넣으려다 Tailwind 임의값 파싱 이슈로 안 보여서 아이콘 컴포넌트로 교체), 왼쪽에 검색창 신설(300ms 디바운스)
- 백엔드는 코스 편집용으로 만들어뒀던 `/places/search`(경량 ILIKE) 재사용, 카드 렌더에 필요한 필드(영/중문 제목, 본문, 비디오URL) 추가 확장
- 정렬 없을 때 실제로는 `ORDER BY RANDOM()`인데 콤보박스가 "인기순"으로 표시돼 실제 상태와 다르고 재선택도 안 되던 문제 — `PlaceSort`에 `'random'` 추가해 "랜덤순"을 명시적 첫 옵션으로 노출

#### 네이버 로그인
- Supabase가 네이버를 기본 제공 안 해서 Custom Provider(`custom:naver`)로 연동 — 실제 작업은 `nemone-auth` 레포(통합 인증 센터)에서 진행, 여기서는 `AuthContext.tsx`에 `signInWithNaver` 추가만(일관성 목적, 실제 버튼은 auth 서버에만 존재)

### 2026-08-04 — SEO 소프트404 전환, 핫플 AI버튼(코스/가이드), 마이페이지 찜 페이지네이션, 네이버 즐겨찾기·카카오맵 수집기 + 테마 자동생성

#### 네이버 서치어드바이저 "description 중복" 재점검 — 소프트404 → 진짜404 전환
- 삭제된 팝업 URL(`/posts/[id]`)이 `#id 운영종료` 템플릿 문구로 매번 200을 반환하고 있었음(6/10에 이미 noindex+고유 description 처리는 돼 있었음, 회귀 아님) — 다만 45일 유예 후 영구 삭제된 팝업은 앞으로도 영원히 이 소프트404를 반환해 크롤 예산을 갉아먹는 구조적 문제 발견
- `posts/[id]/page.tsx`: place가 null이면 `notFound()` 호출로 전환. `posts/[id]/not-found.tsx` 신규(같은 "운영종료" UI 유지 + `/places/popular`에서 실제 추천 장소 6개 채워 넣음 — 기존엔 이 자리가 항상 빈 배열이었음)
- `PlaceDetailClient.tsx`의 이제 도달 불가능해진 null 분기 제거, `place` prop 타입 `Place|null` → `Place`

#### 만료 팝업 재수집 방지 — 삭제 블록리스트
- `아차산토요한마당`(2014년 데이터 그대로 남아있는 문체부 축제API 항목)이 삭제해도 재수집 때마다 부활하는 문제 — `upsert_items()`가 naver_place_id/title로만 매칭해 삭제된 행은 재수집 시 새 INSERT로 취급되던 게 원인
- `deleted_places_blocklist` 테이블 신설, 관리자 삭제(`DELETE /places/{id}`) 시 자동 기록. `collector_base.py`의 공용 `upsert_items()`(kopis/naver/visitjeju/visitseoul/seoul_exhibition/culture 전부 경유)가 재수집 전 블록리스트를 걸러내도록 수정

#### 핫플 상단 — AI코스생성 / AI가이드 버튼
- `Recommendation.tsx`: NEW팝업 티커와 카테고리 탭 사이에 버튼 2개 신설. AI코스생성은 `/course` 페이지의 기존 모달(지역+동행 선택 → `/courses/draft`)을 그대로 이식, AI가이드는 기존 `AskAI` 컴포넌트에 `fullHeight` prop을 추가해 바텀시트 모달 안에서도 레이아웃이 깨지지 않게 함
- 로그인 요구 시점 수정: 버튼 클릭 시 바로 로그인 강제하던 것 → 모달부터 열고 실제 "생성/전송" 액션에서만 로그인 요청(`/course` 페이지의 기존 패턴과 통일)
- 우하단 플로팅 AI버튼("둥둥이")은 핫플 탭에서 인라인 버튼과 중복이라 숨김 처리, 다른 탭에서는 아이콘+"AI가이드" 텍스트 라벨이 있는 알약 형태로 변경(기존엔 아이콘만 있어 역할이 불명확했음)
- 버튼 추가로 줄어든 광고 노출 공간 확보를 위해 NEW팝업 티커/버튼바/탭/지역필터 패딩을 순서대로 조금씩 축소
- 두 AI코스생성 모달(핫플 탭, `/course` 페이지) 모두 "3시간코스 만들기" 버튼 아래에 랭킹리스트용 광고(`5769413560`) 추가

#### 마이페이지 — 찜 목록 페이지네이션 + 삭제
- `/my` 찜(place) 탭에 10개 단위 페이지네이션(숫자 버튼+화살표) 추가, 항목별 삭제 버튼 신설(기존 `/likes/toggle` 재사용해 찜 해제)

#### 네이버 지도 "즐겨찾기(공유폴더)" 스크래퍼 신규
- `map.naver.com/p/favorite/.../folder/{id}` 링크가 내부적으로 쓰는 `pages.map.naver.com` 공개 API(로그인/봇방지 토큰 불필요, Playwright 불필요)를 직접 호출
- `scraper_naver_favorite.py`(수집) + `collector_favorite.py`(DB 반영) 신규. 큐레이터가 남긴 개인 메모는 저작권 리스크로 DB에 절대 저장하지 않고, title/location/네이버 세부업종만으로 AI가 소개문을 새로 작성(메모 없이 생성해 표현이 겹치지 않음을 확인)
- end_date는 항상 NULL로 저장(팝업이 아니라 상시 매장이라 `cleanup_expired_data()`의 45일 자동삭제 대상에서 자연히 빠짐)
- 실행은 정기 스케줄 없이 텔레그램 `/fav <폴더URL> <지역> [카테고리]`로 온디맨드(로컬 텔레그램 봇에 명령 추가, `telegram_admin_bot.py`)

#### 카카오맵 키워드 검색 스크래퍼 신규
- `map.kakao.com`의 `search.map.kakao.com/mapsearch/map.daum` API가 네이버와 달리 브라우저/봇방지 토큰 없이 순수 HTTP만으로 전체 페이지 수집 가능함을 확인, 광고는 응답의 `place` 배열과 이미 분리되어 있어 별도 필터링 불필요. 정렬은 정확도순이 아니라 실제 "인기도순" 토글과 동일한 `msFlag=S&sort=1` 사용
- `scraper_kakao.py`(수집, AI/번역 없이 카카오 원본 정보 그대로 content 구성 — 업체 등록 정형정보라 저작권 이슈 없음) + `collector_kakao.py`(DB 반영)
- 서울처럼 넓은 키워드는 결과가 여러 구에 흩어지는데, now는 아직 성수/홍대/강북/강남 4개 권역만 다루므로 구(區) 단위로 자동 매핑(`DISTRICT_REGION_MAP`) — 성동구→성수, 마포구→홍대, 강남·서초·송파→강남, **그 외 모든 구는 강북**(기타 서울 편의상 버킷)
- 업체 홈페이지는 `link_url` 컬럼에 분리 저장(기존 "공식 페이지" 박스가 그대로 렌더링) — 이전엔 content 안에 plain text로 박혀 있어 클릭이 안 됐음
- 텔레그램 `/kakao <키워드> <카테고리> [지역]` — 지역 생략 시 구 자동매핑, 매핑표에 없는 지역(제주 등) 키워드는 명시 필수
- 실 사용: "서울 독립서점" 150곳 전량 수집(강북100/홍대34/강남13/성수3), 프로덕션 반영 확인

#### 수집기 완료 시 테마지도 자동 생성
- `theme_helper.py` 신규(`create_theme()`) — `/fav`, `/kakao` 완료 후 이번에 수집한 장소들을 묶어 테마 자동 생성, system user_id(`now-collector-system`)로 소유
- 카카오는 전체는 DB에 등록하되 테마에는 인기도순 상위 15개만 포함, 즐겨찾기는 폴더 전체 포함(폴더명을 테마 제목으로 사용)

#### 플레이스 상세페이지 — 네이버/카카오맵 링크 박스 정리
- `hasValidNaverId`에서 `kakao_` 접두사 제외(그동안 카카오 소스 항목이 잘못된 네이버지도 링크를 만들고 있었음), "카카오맵에서 보기" 박스 신설(네이버 박스와 동일 스타일)
- `collector_favorite.py`/`collector_kakao.py`의 content에서 "OO 지도 바로가기: URL" plain text 줄 제거(각 소스 전용 링크 박스가 이미 렌더링하므로 중복)

#### 기타
- matmatch: 어드민 회원현황에 네이버(`custom:naver`) 로그인 카운트 추가, 카드 5개로 재배치(`Total Members`→`Total` 등 라벨 축약해 한 줄 유지)
- matmatch: 기사 상세페이지에 같은 섹션(카테고리) 내 이전/다음 글로 이동하는 좌우 화살표 신설(`ArticleNavArrows.tsx`), 백엔드 `/posts/{id}/adjacent`를 전체 글 기준 → 같은 category 내에서만 조회하도록 수정

### 2026-08-05 — "PACE" 브랜드 전면 리브랜딩 (색상/로고/파비콘/안드로이드/카피)

now(지금여기)를 "NEMONE PACE"로 리브랜딩. 지시서 진행 전 현황 진단 결과, "기존 골드 테마"라는 전제와 달리 실제 대표색은 에메랄드 그린이었음(골드는 matmatch 색) — 에메랄드를 Jeju Blue(`#35577A`)로 교체하는 작업으로 재정의하고 진행.

#### 컬러 토큰화
- `tailwind.config.js`에 `pace` 커스텀 팔레트(50~950) 추가, 600을 스펙값 `#35577A`에 정확히 고정, 나머지는 HSL 보간으로 생성
- 코드베이스 전체(25개 파일)의 `emerald-*` 클래스를 `pace-*`로 일괄 치환 — 단, 제주 지역색(`#0369a1`)·카카오/네이버 버튼 브랜드색·지도 마커색은 emerald가 아니었으므로 영향 없음
- **부작용 발견 및 수정**: 일괄 치환 때문에 지역별 색상 매핑(`REGION_ACCENT`/`REGION_PILL_ACTIVE`, `regionBorder`/`regionText`, 랭킹 뱃지 fallback)에서 "성수"(및 같은 슬롯을 쓰던 "공연") 전용 색까지 Jeju Blue로 바뀌어 제주와 구분이 안 되는 문제 발생 — `page.tsx`/`PlaceDetailClient.tsx`/`ClosingSoonTicker.tsx`/`Recommendation.tsx` 5곳에서 성수·공연만 다시 emerald로 되돌림(전역 브랜드색과 지역 고유색은 같은 토큰을 공유하면 안 된다는 교훈)

#### 로고/파비콘
- `public/brand/`에 SVG 6종 배치, 공용 `Logo.tsx` 신설 → 텍스트로 8곳에 중복돼 있던 헤더 타이틀을 이미지 로고로 교체(`page.tsx`, `course/page.tsx`, `course/[id]/page.tsx`, `course/[id]/edit/page.tsx`, `PlaceDetailClient.tsx`, `signup/page.tsx`)
- 어드민/매거진 헤더처럼 페이지 고유 타이틀("지금 여기 관리자", "매거진")은 브랜드 마크 자리가 아니라고 판단해 로고로 안 바꾸고 텍스트 유지(지시서가 카피 문구는 범위 밖이라 명시)
- 파비콘: `brew install librsvg`(rsvg-convert)로 SVG→PNG 변환, Python Pillow로 `favicon.ico`(16/32/48 멀티사이즈)까지 생성해 `layout.tsx`에 ico/svg/png 우선순위로 연결. 기존 `matmatch-icon.png`(now_front에 잘못 들어와 있던 파일)·구 `favicon.png` 정리

#### 안드로이드 앱(Capacitor)
- 완전 커스터마이징 안 된 기본 템플릿 아이콘(청록 그리드 패턴)이 그대로 남아있던 걸 발견 — `pace-icon-solid.svg` 기준으로 레거시 아이콘(36~192px 6단계) + 어댑티브 아이콘(배경 Jeju Blue 단색 + 전경 흰 마크, 81~432px 6단계) 전부 재생성
- 앱 이름 "NowHere" → "NEMONE PACE"(`strings.xml`, `capacitor.config.ts`), `applicationId`(`com.nemoneai.now`)는 스토어 등록 유지 위해 그대로
- `versionCode` 4→5, `versionName` "1.0.3"→"1.1.0"(최신 배포 버전 다음으로) — 실제 APK/AAB 빌드·서명·Play Console 업로드는 로컬에 Android SDK가 없어 사용자가 직접 진행해야 함

#### SEO 타이틀/카피 통일
- `<title>`을 하나로 길게 쓰면(약 73자) 검색결과에서 잘려서, title 30자("NEMONE PACE, 당신의 다음 3시간을 설계합니다") + description 40자("성수, 홍대 팝업 등 지역별 지금 당장 즐길 수 있는 플레이스 코스 추천")로 분리(OG/Twitter/JSON-LD도 동일하게 통일)
- 상단 슬로건(`BrandTagline.tsx`)과 하단 풋터(`SiteFooter.tsx`, `page.tsx` 인라인 풋터) 태그라인도 같은 문구로 통일, 풋터 서비스명("지금여기"/"NOW HERE")도 "NEMONE PACE"로 교체

#### 헤더 뒤로가기 버튼 — 핫플 탭에서만 숨김
- 홈(메인) 진입 시 뒤로가기 화살표가 갈 곳이 없어 불필요하다는 피드백으로 제거했다가, 핫플/지도/장소/코스/매거진 탭이 전부 `page.tsx` 하나의 헤더를 공유하는 구조라 전체 탭에서 사라지는 부작용 발생
- `activeTab !== 'rec'` 조건으로 핫플 탭에서만 숨기고 나머지 탭에서는 복원 — 완전 제거가 아니라 조건부 렌더링으로 해결

#### 연관 작업 (다른 저장소)
- matmatch(nemoneai.com) 헤더의 "Nowhere" 초록 뱃지 버튼을 다크배경용 가로형 PACE 로고 버튼으로 교체(`pace-logo-horizontal-40-dark.svg`)
- home.nemoneai.com(정적 export, GitHub Actions 배포가 구 서버 시크릿을 그대로 물고 있어 실패 — msm VM의 `~/apps/home_dist/dist`에 직접 rsync로 배포)와 matmatch 전체에서 "지금여기"/"NOW HERE" 잔존 텍스트 정리. matmatch는 UI 라벨뿐 아니라 실제 발행된 기사 8건의 제목/본문/태그에도 박혀있어 DB 직접 수정 + 랭킹 인메모리 캐시(`_top_ranking_cache`, 백엔드 재시작 전까지 안 갱신) 재기동 + 프론트 `.next/cache` 삭제 후 재빌드까지 필요했음(자세한 내용은 matmatch 저장소 기록 참고)
- home.nemoneai.com 어드민(`/admin`)에 소식 수정(PUT) 기능이 없어서 추가 — matmatch 백엔드에 `PUT /news/{id}` 신설, 어드민 페이지에 연필 아이콘 버튼으로 기존 "새 소식 작성" 모달을 수정 모드로 재사용

### 2026-08-09 — 서울시 실시간 도시데이터(유동인구/혼잡도) 신규 기능 + 일본어 파이프라인 버그 수정

#### 1. 사전 진단 — API 키/지점명 실검증
- 기존 `SEOUL_API_KEY`(서울 열린데이터광장)가 `openapi.seoul.go.kr:8088`의 citydata(실시간 도시데이터) 서비스에도 별도 신청 없이 그대로 유효함을 실호출로 확인
- 지점명은 반드시 정확한 등록명이어야 하는데 상식적 추정과 실제가 계속 어긋남 — 후보 문자열을 여러 개 만들어 실제 API 호출로 하나씩 검증하는 방식으로 확정
  - `홍대관광특구`(오류) → `홍대 관광특구`(공백 포함, POI007)
  - `이태원`(오류) → `이태원 관광특구`(POI004)
  - `성수카페거리`(POI068), `강남역`(POI014), `광화문·덕수궁`(POI009)은 예상대로 정확
- 응답 JSON 구조(`LIVE_PPLTN_STTS`의 혼잡도/인구범위/예측배열/연령·성비, `WEATHER_STTS`) 실제 필드명 확인

#### 2. DB/백엔드
- `crowd_status` 테이블 신규(지점당 1행, PK=area_nm) — 지점명 매핑은 `deps.py`의 `CROWD_AREA_MAP`(프론트 짧은 키 ↔ API 실등록명)에서 관리, 여기 한 줄만 추가하면 폴링·API·프론트 전체에 자동 반영되는 구조
- `scraper_seoul_crowd.py` 신규: UPSERT 시 `prev_congest_lvl = crowd_status.congest_lvl`처럼 ON CONFLICT 안에서 갱신 전 값을 그대로 참조해, 별도 SELECT 없이 "현재값→prev 이동, 신규값 반영"을 한 번의 쿼리로 원자적 처리. `crowd_status`는 지점당 1행이라 `cleanup_expired_data()`의 45일 TTL 대상에서 예외로 명시
- **로컬 launchd → 서버 cron 이전**: 최초엔 다른 스크래퍼들과 같은 관례로 로컬 launchd(1시간 간격)로 구현했으나, "실시간" 데이터가 로컬 맥 전원/네트워크 상태에 좌우되면 서비스 연속성이 깨진다는 지적으로 `main.py` APScheduler(`IntervalTrigger(minutes=10)`)로 완전 이전. 서버 재시작 직후에도 스케줄러 첫 틱(최대 10분)을 기다리지 않도록 기동 시 1회 동기 호출 추가(`ranking.refresh_place_popularity()`와 동일 패턴). 로컬 launchd job은 이중 폴링 방지를 위해 unload
  - 10분 간격 근거: 서울시 원본 데이터 자체가 내부적으로 약 5분 주기로 갱신돼 그보다 촘촘히 폴링해도 새 값을 못 받음. 지점 5개×6회/시간 호출량도 미미
- `routers/crowd.py`: `GET /crowd?area=`(단건) + `GET /crowd/all`(전체 일괄, 메인 티커용 — 지점별 개별 호출을 하나의 쿼리로 통합). 델타(%)는 서버에서 계산해 반환, prev 없는 최초 수집 직후엔 델타 필드 자체를 생략(프론트 오해석 방지)
- 강남역(POI014)·이태원 관광특구(POI004)·광화문·덕수궁(POI009) 순차 추가 — `CROWD_AREA_MAP`에 한 줄씩만 추가, 폴링/검증 로직 변경 없이 자동 반영됨을 확인

#### 3. 프론트 — 지도 탭 카드 + 메인 티커
- `CrowdCard.tsx`(지도 탭 sticky 카드): 강북처럼 넓은 지역은 지점이 여러 개일 수 있어 `REGION_CROWD_POINTS`(지역→지점 배열)로 관리, 드롭다운으로 지점 전환. 레이아웃은 "혼잡도가 잘린다"는 피드백을 여러 차례 받으며 반복 압축 — 최종적으로 상단 얇은 헤더(지점선택·연령·날씨·자세히) 1줄 + 혼잡도·인구수·델타·성별을 전부 한 flex 컨테이너에 담은 강조 1줄, 총 2줄로 정리. 남/여를 둘 다 보여주면 줄이 밀려 우세한 쪽 하나만(동률이면 "남여동일") 표시
- `CrowdTicker.tsx`(메인 상단): 5개 지점을 순환 노출하는 티커. 진짜 기계식 split-flap 느낌을 내려고 `react-split-flap`(LongFlap) 라이브러리를 검증 후 도입했으나, 내부 콘텐츠가 전부 `position:absolute`라 `digitWidth`를 명시하지 않으면 부모가 0×0으로 찌그러져 실기기에서 검은 배경만 남는 문제 발견 — 고정폭으로 재시도했으나 여전히 부적합해 기존 framer-motion 슬라이드 버전으로 롤백, 의존성 제거(LED 점 애니메이션 + 어두운 배경 + 모노스페이스 숫자로 "전광판" 느낌은 CSS만으로 유지)
- 좁은 화면에서 혼잡도가 계속 잘리는 문제로 여러 차례 우선순위 조정: 온도/날씨 제거 → 델타는 숫자만(라벨 없이) → 그래도 부족해 결국 카드(공간 여유)와 티커(공간 빠듯)를 다른 기준으로 분리 적용
- 티커 탭 시 해당 지역의 지도 탭으로 이동(`page.tsx`→`Recommendation`→`CrowdTicker`로 콜백 프롭 체인 연결)
- 4개 언어(ko/en/zh/ja) 전체 대응 — 혼잡도 단계·성별·연령대·인구단위·지점명까지 번역, API/내부 키는 한글 유지하고 표시 레이어에서만 매핑(백엔드 응답 자체는 항상 한글)

#### 4. 다국어 점검 중 발견한 별개 버그 — title_ja 파이프라인 누락
- 혼잡도 기능 다국어 작업 김에 전체 다국어 상태를 재점검하다가, 최근 수집분(부산 등)은 `title_ja`/`content_ja`가 DB에 정상 저장돼 있는데도 화면엔 계속 한글로만 뜨는 걸 발견
- 원인 2가지: (1) `routers/places.py`의 `GET /places`(목록)·`GET /places/{id}`(상세) SELECT 문에 애초에 `title_ja`/`content_ja` 컬럼이 빠져있었음(`ranking_service.py`의 `/places/popular`만 포함하고 있었음) (2) 프론트 5개 컴포넌트(`Recommendation`/`ClosingSoonTicker`/`MapView`/`PlaceList`/`PlaceDetailClient`)가 en/zh 분기는 있는데 ja 분기만 통째로 빠져있었음

### 2026-08-10 — 순위변동 배지·PWA·Web Push(리텐션 루프) + shadcn/ui 디자인 시스템 도입 + 랭킹 지역 버그 수정

#### 1. 순위변동 배지 (종합 랭킹만)
- `ranking_service.py`의 `refresh_place_popularity()`가 NEW 배지 판별용으로 이전 톱25를 읽을 때 `set(prev_snapshot[0])`으로 즉시 집합화하고 있어서, 순서(=순위) 정보가 읽는 시점에 버려지는 걸 발견 — 순위 델타(▲/▼N) 계산 자체가 불가능한 상태였음. `prev_top25_list`(순서 보존 리스트)와 `prev_rank_by_id` 매핑을 추가해 이전순위-현재순위 계산, 종합(`ranking_snapshot`)·지역 서브탭(`place_region_ranking_snapshot`) 둘 다 반영
- 공연/축제/쇼핑/전시 4개 카테고리는 같은 함수 안에 거의 동일한 패턴이 4번 더 중복돼 있어 전부 고치면 리스크가 커서, "종합만" 범위로 한정(사용자 판단)
- `RankBadge.tsx` 신설(▲N 초록/▼N 회색/0·신규는 무표시), `Recommendation.tsx` 종합 탭에 적용. 어드민 CSV(`routers/admin.py`의 `/admin/ranking/weekly7d`, 프론트 `admin/page.tsx`)에도 순위변동 컬럼 추가 — 이쪽은 화면표시용 캐시(`ranking_snapshot.top25_ids`)를 비교 기준으로 재사용

#### 2. PWA 설치 유도
- `public/manifest.json` 신규(PACE 아이콘 재사용), `layout.tsx`에 `manifest` 메타데이터 연결, `viewport.themeColor` 추가
- `lib/pwaInstall.ts`(모듈 싱글턴으로 `beforeinstallprompt` 캡처 — 이벤트가 페이지당 한 번만 발생해서 늦게 구독하면 놓치므로 전역에서 미리 잡아둠) + `usePwaInstall.ts` 훅 + `PwaInstallBanner.tsx`
- 노출 시점: 코스 발행 완료 직후(`course/[id]/page.tsx`에 `?published=1` 쿼리로 신호), 찜 3개 이상 달성 시점(`PlaceDetailClient.tsx`의 `toggleLike` 성공 후 좋아요 개수 체크). iOS Safari는 `beforeinstallprompt` 미지원이라 UA로 감지해 "공유→홈 화면에 추가" 수동 안내 문구로 분기

#### 3. Web Push (익명 구독)
- VAPID 키페어 발급(`.env`의 `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`), `push_subscriptions` 테이블(user_id 없이 endpoint 기준 익명 구독), `routers/push.py`(`/push/vapid-public-key`·`/push/subscribe`·`/push/unsubscribe`), `push_service.py`(발송 + 410/404 실패 시 구독 자동삭제)
- **버그 1 — TTL 기본값 0**: `pywebpush.webpush()`에 `ttl`을 안 넘기면 기본값 0이 적용되는데, 이는 "그 순간 브라우저가 푸시 서비스에 연결돼있지 않으면 즉시 폐기"라는 뜻이라 FCM이 발송 자체는 성공(`success:1`)으로 응답해도 실제로는 조용히 사라짐 — 실제로 첫 발송 테스트에서 재현 확인 후 `ttl=86400`으로 수정
- **버그 2 — 로컬 테스트가 운영 텔레그램으로 누출**: `notification.py`의 `send_alert()`가 로컬 `.env`에 있는 텔레그램 토큰이 프로덕션과 동일 채널이라, 로컬에서 발송 테스트(`run_weekly_push`)를 돌렸더니 사장님 텔레그램에 실제 알림이 감 — `TELEGRAM_ALERTS_DISABLED=true`를 로컬 `.env`에만 추가해서 이 경로만 억제(프로덕션 `.env`엔 추가 안 함)
- `public/sw.js`(push 이벤트 수신→알림 표시, notificationclick→url 이동), `lib/pushSubscription.ts`(구독/해제 API 연동) + `usePushSubscription.ts` 훅
- 노출 시점: 랭킹 톱25 스크롤 중 13번째 카드가 뷰포트에 절반 이상 들어오면(`IntersectionObserver`) 하단 배너(`PushSubscribeBanner.tsx`), 코스 발행 완료 화면 보조 버튼(`PushSubscribeButton.tsx`)
- 마이페이지 알림 토글은 처음엔 커스텀 버튼으로 구현했다가 이후 shadcn 도입 후 `Switch`+`Card`로 교체(4번 항목 참고)
- 목요일 주간 발송 스케줄 등록(`main.py`, KST 12:30) — "구독자 수와 무관하게 정기 발송해야 한다"는 판단으로 수동 트리거 검증만 하고 미루지 않고 바로 크론 등록. 발송 카피는 처음에 TOP3를 전부 나열했더니 "너무 빡빡하다"는 피드백으로, 1위만 보여주고 나머지는 궁금하게 남기는 방식으로 수정

#### 4. shadcn/ui 디자인 시스템 도입 — Tailwind v3 호환성 이슈 다발
- `npx shadcn@latest init -b radix -p nova`로 초기화(Radix 베이스, Lucide 아이콘 프리셋이 기존 `lucide-react` 의존성과 맞음). 초기화 직후 `next build`가 `"The border-border class does not exist"`로 즉시 실패 — 최신 shadcn CLI(v4.16.2)가 Tailwind v4를 전제로 CSS를 생성하는데 이 프로젝트는 v3.4.1이라 발생
- **원인 1**: `tailwind.config.js`에 shadcn이 만든 CSS 변수(`--primary` 등)를 `bg-primary`/`border-border` 같은 v3 유틸로 쓸 수 있게 하는 색상 매핑이 아예 없었음 — v4는 이 매핑 없이도 동작하지만 v3는 명시적 연결이 필요. `colors`/`borderRadius`에 직접 추가해 해결
- **원인 2**: `globals.css`에 자동 삽입된 `@import "tw-animate-css"`와 `@import "shadcn/tailwind.css"`가 통째로 Tailwind v4 전용 문법(`@theme inline`, `@utility`, `@custom-variant`)이라 v3에서는 완전히 죽은 코드 — `data-checked:`/`data-open:` 같은 커스텀 베리언트, `--spacing(4)` 같은 CSS 함수, `bg-(--var)` 괄호 축약 문법이 전부 무효 처리됨. `tw-animate-css`는 제거하고 v3 호환 정식 대체 패키지 `tailwindcss-animate`로 교체, `switch.tsx`/`card.tsx`/`sheet.tsx`/`button.tsx`의 v4 전용 문법을 Radix가 실제로 세팅하는 `data-state=checked|open` 등 기준으로 대괄호 문법(`data-[state=checked]:`)으로 전부 재작성
- 컬러 토큰 매핑: shadcn 기본 중립색(oklch) → 기존 PACE 브랜드 토큰(Jeju Blue `#35577A` 등)으로 치환, 새 색상 정의 없이 기존 값만 대입. `body`의 `bg-background`(아직 컬러 매핑 전 상태에서 shadcn init이 자동으로 바꿔놓은 것)는 점진적 교체 원칙에 따라 원래 `bg-zinc-50`으로 되돌림
- 마이페이지(`my/edit/page.tsx`) 알림 토글을 커스텀 버튼에서 shadcn `Switch`+`Card`로 교체 — 첫 적용 사례
- `Sheet`(바텀시트) 도입해 `CrowdCard.tsx`의 유동인구 상세 바텀시트를 교체했으나, 애니메이션·접근성(ESC/스크롤락)만 추가될 뿐 사용자 체감 차이가 작다고 판단해 롤백 — `CrowdCard.tsx` 원상복구, `sheet.tsx`/`button.tsx`/`tailwindcss-animate` 제거
- **bento-grid**: 랭킹 톱3를 1위(세로로 긴 큰 타일)+2·3위(작은 타일 2개) 카드형 레이아웃으로 전환(Aceternity bento-grid 패턴을 순수 CSS grid로 직접 구현, 의존성 없음). 종합 탭에 먼저 적용 후 공연/축제/쇼핑/전시 4개 탭까지 확장 — `computePlaceMeta`/`BentoTop3`/`placeToBentoItem` 공용 헬퍼로 5개 탭의 중복 배지 로직을 정리. 광고 삽입 위치도 톱3(바뀐 bento 블록) 직후로 재조정
- **버그**: 1위 타일 이미지 박스에 `aspect-[3/4]` 고정 비율을 썼더니, 그리드 행의 실제 높이(2·3위 타일 합산 높이)가 그보다 길 때 카드 배경(흰색)이 이미지 아래로 드러나는 문제 발생 — 고정 비율 대신 `flex-1`로 부모 그리드 셀 높이를 그대로 채우도록 수정

#### 5. 프로필 사진 리퍼러 정책 누락
- 헤더 프로필 사진(`HeaderControls.tsx`, `page.tsx`, `my/page.tsx` 3곳)의 `<img>`에 다른 이미지들과 달리 `referrerPolicy="no-referrer"`가 빠져있어서, 구글 아바타 CDN이 리퍼러 기반으로 이미지를 차단할 가능성이 있던 기존 결함 발견·수정(로컬 `localhost`가 리퍼러로 잡히면 더 잘 걸릴 수 있음)

#### 6. 제주·부산 랭킹 지역 예외 처리
- 종합 랭킹이 48시간 윈도우로도 25개 이상 채워지면 지역 서브탭도 전부 같은 48시간 기준을 강제하는 기존 로직(2026-08-07, 지역마다 기간이 다르면 같은 장소 점수가 화면마다 달라 보이는 문제 방지용) 때문에, 활동량이 절대적으로 적은 제주(48시간 내 0건, 30일로 넓히면 5건)·부산이 통째로 빈 탭으로 보이는 문제 발견
- 부산·제주 두 지역만 예외로, 자체 결과가 25개 미만이면 30일까지 독립적으로 확장하도록 수정(`ranking_service.py`) — 성수/홍대/강남/강북은 종합 상위권과 풀을 많이 공유해 점수 불일치 리스크가 크지만, 부산·제주는 종합 상위권과 거의 안 겹쳐서 그 리스크가 낮다고 판단

#### 7. SEO 점검 (코드 변경 없음)
- 오늘 작업(bento-grid 등)이 전부 기존에 이미 완전 CSR이던 홈 화면(`Recommendation.tsx`) 안에서 구조만 바꾼 것이라 크롤러 노출 특성에 변화가 없음을 `curl -A "Yeti"`로 직접 재확인(2026-06-21 히스토리 문서에 이미 기록된 now 홈의 CSR 특성과 일치)
- 네이버 서치어드바이저 CSV 3종(색인현황/크롤완료/다운로드크기) 대조 결과, 8/6에 색인 관련 지표(색인·수집제한·색인제외·SEO)만 전부 0으로 찍히고 같은 날 크롤완료(762건)·다운로드(52.6MB)는 전후 날짜와 동일 범위로 정상이었음 — 사이트 문제가 아니라 네이버 대시보드의 색인현황 스냅샷 리포팅 결측(reporting gap)으로 진단, 조치 불필요

#### 8. 홈 SSR 전환 — 크롤러에게 랭킹 콘텐츠가 아예 안 보이던 구조 결함 수정 (SEO 핵심)
- `#7`에서 "홈이 완전 CSR이지만 노출은 잘 된다(2026-06-21 문서 기록)"고 넘겼으나, 이후 "PACE 네이버 노출이 계속 하락 중이고 그 문서는 예전 글"이라는 지적으로 재점검 — `curl -A "Yeti" https://now.nemoneai.com/`로 확인 시 홈 초기 HTML에 **posts 링크 0개·이미지 1개**(nav/footer 텍스트만), 랭킹 카드가 통째로 크롤러에게 안 보이던 상태였음
- 원인: 홈 `page.tsx`가 route 파일 자체로 `'use client'`라 region/tab 상태를 `window.location`으로 클라이언트에서만 읽고, 랭킹 데이터(`/places/popular`)도 `useEffect`로 브라우저에서만 fetch → 서버가 크롤러에게 주는 첫 HTML엔 데이터가 하나도 안 담김
- **서버/클라이언트 컴포넌트 분리**: `page.tsx`를 서버 컴포넌트로 바꿔 종합 랭킹을 서버에서 미리 fetch(5분 ISR) 후 prop으로 전달, 기존 전체 로직(상태·탭 전환·애니메이션)은 `HomeClient.tsx`(신규)로 그대로 이동해 초기 데이터로 첫 렌더부터 실제 카드가 박히게 함. 과거 matmatch에서 문제됐던 `useSearchParams()` 훅 패턴은 쓰지 않아 홈이 완전 정적(`○ Static`)으로 프리렌더됨
- 검증: 배포 후 운영 서버를 Yeti로 재확인 — 초기 HTML에 **posts 링크 25개·이미지 26개** 노출 확인(title/메타데이터도 정상 유지). 색인·노출 회복은 네이버 재크롤링 주기 대기(자세한 진단은 SEO 히스토리 문서 10장 참고)

#### 9. 브랜드 잔존 텍스트 정리 + 기타
- 리브랜딩(8/5)이 일부 파일만 반영되고 "지금여기"/"NOW HERE"/"Now Here"가 13개 파일에 잔존한 걸 발견(상세페이지 풋터에서 확인 시작) — 랭킹 다국어 페이지(en/zh/ja) title, 개인정보처리방침, 어드민 헤더, 지도 fallback 텍스트, 매거진 설명, 상세 풋터(4개 언어) 등 전부 `NEMONE PACE`로 교체. 안 쓰이는 죽은 상수(`BRAND_TITLE`, dict의 미사용 `title` 키)는 삭제
- 하단 탭바 애니메이션: framer-motion `layoutId`로 활성 탭 배경(pace-50 pill)이 탭 사이를 부드럽게 슬라이드 + `whileTap` scale(홈 `HomeClient.tsx`의 NavButton, 타 페이지 공용 `BottomNav.tsx` 둘 다)
- 유동인구 전광판(`CrowdTicker.tsx`) 배경을 검정(`bg-zinc-950`)에서 제주블루(`bg-pace-900`)로 변경, 구분점 색도 pace 톤으로 통일
- **matmatch 연관**: `posts/195` 스포티파이 임베드가 안 뜨는 문제 — 최근 100개 정적 생성(SSG) 목록에 포함된 글이라 빌드 시점 이후 저장된 video_url이 재빌드 전까지 반영 안 되는 구조(PM2 재시작·`.next/cache` 삭제로도 안 지워짐). matmatch frontend 재빌드·배포로 해결
- **로컬 배치 알림 누락 사고**: 8/10 오전 웹푸시 테스트 누출 방지용으로 `notification.py`의 공용 `send_alert()`에 넣었던 전역 `TELEGRAM_ALERTS_DISABLED` 억제가, 같은 함수를 공유하는 로컬 스크래퍼들(서울 전시 수집 등)의 정상 완료 알림까지 묵음 처리하는 부작용 발견 — 전역 억제를 제거하고 `push_service.run_weekly_push()` 호출부에서만 개별 억제하도록 범위 축소
- 번역 자체가 안 된 게 아니라 조회 API와 화면 표시 사이에서 완성된 번역 데이터가 버려지고 있던 것 — 백엔드 SELECT 2곳 + 프론트 5곳 모두 수정. 과거 수집 데이터는 애초에 title_ja가 비어있어 기존 방침대로 미조치(신규 데이터부터 정상 노출)

#### 10. 다국어 SEO 완성 — "표면은 다국어인데 해외 유입이 거의 없다"는 지적에서 출발
- `/en·/zh·/ja/ranking/place`(요약 페이지)는 실제 영어 콘텐츠로 잘 만들어져 있었지만, 거기서 클릭해 들어가는 개별 상세페이지(`/posts/[id]`)가 언어 대응이 사실상 전무했음 — 다국어 "표면"만 있고 실제 콘텐츠 뎁스(장소 상세 수천 개)는 크롤링이 안 되는 구조라 해외 유입 부진이 당연한 결과였음
- 번역 데이터 자체는 이미 충분(활성 장소 2,997개 중 title_en 64%·title_zh 61%·title_ja 46% — 전부 수집 단계 AI 번역), 새 번역 작업 없이 순수 배선 문제였음
- **`posts/[id]/page.tsx` `generateMetadata`가 `searchParams`(lang)를 아예 안 받아** `?lang=en`을 붙여도 title이 `"한글 · English"`로 뒤섞여 나가던 것 → lang별로 title_en/content_en 등을 명시적으로 선택하도록 수정, 언어별 자기참조 canonical + hreflang 5종(ko/en/zh/ja/x-default) 추가
- `sitemap.ts`의 상세페이지 URL마다 hreflang alternates 삽입(대규모 사이트에서 언어판 발견의 정석 경로) — 배포 후 sitemap에 hreflang 태그 15,097개 확인
- `<html lang>`이 모든 페이지에 `"ko"`로 하드코딩돼 실제 콘텐츠 언어와 안 맞던 것 — `PlaceDetailClient.tsx`에서 언어 변경 시 `document.documentElement.lang`을 클라이언트에서 갱신
- 랭킹 페이지(en/zh/ja) 개별 장소 링크에 `lang` 쿼리가 안 붙어있어 클릭하면 한국어 URL로 튕기던 것 수정
- **부수 발견 버그 1 — canonical 오염**: root layout(`layout.tsx`)의 `alternates.canonical`이 모든 하위 페이지에 기본값으로 cascade돼서 `/privacy`·`/feedback`·`/signup`이 전부 canonical=홈으로 나가 "홈의 중복본"으로 취급되던 상태 — root에서 `alternates` 제거, 각 페이지가 자기 canonical을 직접 명시하도록 이동
- **부수 발견 버그 2 — 제목 이중 접미사**: 랭킹 페이지 5개(en/zh/ja 랭킹 + course/theme 랭킹)가 자체적으로 `| NEMONE PACE`를 또 붙여서 root layout의 title template과 겹쳐 `"... | NEMONE PACE | NEMONE PACE"`로 나가던 것 수정
- 홈은 root 경로+쿼리 조합에서 Next.js가 hreflang URL의 쿼리스트링을 정규화로 떨구는 현상이 있어(`?lang=en` → `https://now.nemoneai.com`으로 손실) 홈만 hreflang을 의도적으로 생략, self-canonical만 유지 — 실제 다국어 색인 무게는 상세페이지(정상 작동)와 전용 `/en·/zh·/ja/ranking` 페이지가 담당

#### 11. "갑자기 유입이 끊겼다" 신고 — 종합 SEO 점검, 기술적 원인 없음으로 결론
- 다국어 배포 직후 실시간 유입 감소 신고 → 주요 페이지 HTTP 상태, robots.txt, noindex 메타/헤더, 홈 SSR 콘텐츠, sitemap, GA4·네이버·애드센스 추적 스크립트, 실제 렌더 콘텐츠까지 전수 점검 — 전부 정상(200, 색인 허용, 추적 정상, 콘텐츠 정상 렌더)
- 점검 중 실제 버그 하나 발견: 봇이 `/posts/robots.txt`처럼 숫자가 아닌 id로 긁으면 백엔드가 422를 주고, 프론트가 이를 처리 못 해 500 에러 페이지가 나가고 있었음(크롤 예산 낭비, 실유입과는 무관) — `getPlace()`에 id가 숫자가 아니면 백엔드 호출 없이 곧장 `notFound()`(404) 처리하도록 가드 추가
- 결론: 오늘 배포한 변경들은 전부 색인(며칠 단위 반영)에 작용하는 종류라 구조적으로 실시간 유입을 즉시 끊을 수 없음 — 실시간 유입 저하는 저녁 시간대 자연 감소·네이버 재크롤링 대기 등으로 설명되고, 오히려 오늘 작업(홈 SSR·canonical 정리·다국어 hreflang) 전부 회복 방향

### 2026-08-11 — 유동인구 크래시 수정 + 어드민 통계 + 봇 조회수 오염 발견 + 랭킹/공유 버그 3종 + UI 폴리시(원형 게이지·버튼 애니메이션) + iOS 입력창 확대 버그 전수 수정

#### 1. 유동인구(`/crowd`) 500 에러 — Telegram 알림으로 발견
- 텔레그램으로 받은 에러 로그 추적 → `routers/crowd.py`의 `_serialize()`가 `prev_ppltn_min/max`는 null 체크하면서 정작 `curr_mid` 계산에 쓰는 현재 `ppltn_min/max`는 체크 안 해서, 이번 폴링에서 값이 비면 `None + None`으로 크래시
- 근본 원인은 스크래퍼 쪽: `scraper_seoul_crowd.py`가 서울시 API 응답에 인구수 필드가 빈 주기에도 UPSERT에서 `ppltn_min = EXCLUDED.ppltn_min`을 무조건 덮어써서, 직전 정상값을 NULL로 지워버리고 있었음 — `COALESCE(EXCLUDED.ppltn_min, crowd_status.ppltn_min)`으로 기존 값 보존하도록 수정, `_serialize()`에도 방어 가드 추가(이중 안전장치)
- 로컬 uvicorn으로 실제 폴링 실행 + curl 검증 후 배포, `pm2 restart now_backend`로 반영

#### 2. 어드민 분야별 통계 패널 신설 — 12칸 시간대 버킷 → 카테고리 분해로 전면 교체
- "분야별 세부 플레이스수와 조회수를 보고 싶다"는 요청으로 `/admin/region-stats` 신규 엔드포인트 + `admin/page.tsx`의 top25 메뉴(상단 4개 통계 카드와 TOP25 리스트 사이)에 패널 추가
- 1차로 48시간을 4시간 단위 12칸으로 쪼갠 미니 바 차트를 만들었으나 "다 모양이 똑같아 의미가 없다"는 피드백 — 팝업/클래스/쇼핑/전시 카테고리별 장소수+조회수 분해로 전면 교체(`category IN ('전시','행사')→전시`, `'class'→클래스`, `'shopping'→쇼핑`, 그 외(공연 장르 등 포함)→팝업으로 귀속시켜 4개 버킷이 지역 전체를 빠짐없이 분할하도록 설계, 장소수/조회수 총합은 항상 지역 전체 합계와 일치)

#### 3. Googlebot이 조회수·랭킹 점수를 오염시키던 구조적 버그 발견
- 위 통계 패널에서 "공연·제주 조회수가 왜 3000이나 되냐"는 질문에서 출발해 nginx 로그 대조 → `/places/{id}/view` POST 요청의 상당수(로그 구간 기준 6524건 전부)가 Googlebot UA였음 — Googlebot이 상세페이지를 JS까지 렌더링하며 크롤링할 때 클라이언트 코드의 조회수 기록 요청을 그대로 실행시켜, 실제 사람 트래픽 없이 조회수/인기 랭킹 점수(view_count 기반)가 부풀려지고 있었음
- `routers/places.py`의 `record_place_view()`에 User-Agent 기반 봇 필터(`bot|spider|crawl|yeti|slurp|facebookexternalhit`) 추가, 매칭 시 DB insert 생략. 배포 후 봇 UA/일반 UA 각각 테스트해 `counted:false`/`counted:true` 정상 분기 확인
- 과거에 이미 쌓인 봇발 조회수는 사후 식별 불가(User-Agent 미저장)라 정리 안 함 — 랭킹·통계 둘 다 48시간 롤링 윈도우라 최대 48시간 내 자연 소멸

#### 4. 블로그갱신(enrich) 소개글이 통째로 사라지던 버그
- 텔레그램으로 블로그갱신한 장소(#4629)가 blog_reviews는 정상 저장됐는데 content만 빈 문자열이 된 것을 발견 — `enrich_service.py`의 Gemini 생성 단계가 드물게 빈 응답을 반환해도 그대로 DB에 덮어쓰는 경로가 유일한 원인 후보(로컬 로그가 유실돼 그 순간 자체는 재현 못 함)
- 빈 응답이면 DB를 건드리지 않고 예외로 처리해 기존 소개글을 보존하도록 방어 추가 + "광고가 너무 밑으로 밀린다"는 요청으로 프롬프트를 문장수 상한(최대 6문장)으로 통일하고, 모델이 그래도 넘겨줄 경우를 대비해 `_limit_sentences()`로 코드에서도 한 번 더 강제 절단(이중 안전장치)
- #4629는 로컬에 살아있는 Playwright 서버로 재갱신해 즉시 복구, 프로덕션에도 동일 코드 배포

#### 5. 유동인구 UI — 원형 게이지 신설 + 티커 슬림화
- 지도 탭 혼잡도 표시를 텍스트 pill에서 원형 게이지(도넛, 4단계 진행률)로 교체 — `CongestionRing.tsx` 신설(공용 컴포넌트로 분리해 `CrowdCard.tsx`/`CrowdTicker.tsx` 양쪽에서 재사용). 처음엔 큰 링(상세시트) 안에 텍스트 라벨만 넣었다가 "숫자가 안 보인다"는 피드백으로 퍼센트 숫자를 크게, 그 아래 작은 글씨로 라벨을 병기하도록 수정. 헤더의 미니 링(30px)은 공간이 없어 라벨 없이 숫자 한 줄만
- 메인 티커(`CrowdTicker.tsx`)의 장식용 펄스 점(지역명 색과 중복 정보) 삭제, 끝에 붙던 "여유" 텍스트도 삭제하고 대신 인구수 자체를 혼잡도 색으로 표기(호버 시 툴팁) — 폭이 줄어 모바일에서 끝이 잘리던 문제 완화. 대신 지역명 앞에 18px 미니 링(라벨 없이 색+진행률만) 추가
- 지도 상세시트 하단에 광고 추가 — 처음엔 상세페이지(`posts/[id]`)에 잘못 추가했다가("지도>자세히"를 상세페이지로 오인) 롤백, 위치를 바로잡은 뒤에도 `InArticleAd`(정사각형)를 넣었다가 "AI코스생성 하단과 동일한 걸 원한다"는 요청으로 `AdUnit`(슬롯 5769413560, course/page.tsx와 동일 레이아웃)로 교체

#### 6. 테마 공유 버튼이 100% 실패하던 버그
- "이번주 TOP10 핫플" 테마 공유 클릭 시 "공유 링크 생성에 실패했습니다" 에러 재현 — `Recommendation.tsx`의 `handleShareTheme`이 테마 장소 데이터의 `id` 필드를 읽는데, 자동생성 테마(`admin.py`의 `admin_generate_weekly_theme()`)는 `place_id`로 저장하고 있어서 `id`가 항상 `undefined` → `JSON.stringify`가 해당 키를 통째로 드롭 → 백엔드 검증(`schemas.py`의 `RankingShareCreate`)이 "id 없는 항목"으로 전부 걸러내 결국 0건이 되며 실패
- `p.id ?? p.place_id` 폴백으로 수정, 실제 프로덕션 데이터로 `/ranking/share` 엔드포인트 직접 호출해 정상 생성(`{"id":19}`) 확인 후 테스트 row 삭제

#### 7. Web Push 배너 재노출 주기 — 세션 단위 → 3개월
- "어제 닫았는데 오늘 또 뜬다"는 신고 → `PushSubscribeBanner.tsx`가 dismiss 상태를 `sessionStorage`에 저장하고 있어서 탭/브라우저를 닫으면 바로 초기화되던 게 원인 — `localStorage`에 닫은 시각을 저장해 90일간 재노출 안 하도록 수정(실제 구독 완료 시엔 서비스워커의 진짜 구독 상태로 별도 체크되므로 무관)

#### 8. 랭킹 UI 폴리시 — 순위 배지·변동 아이콘·검정 버튼 애니메이션
- 순위 배지: 플랫 검정 사각형 → 그라데이션 + 진입 시 스프링 팝 애니메이션(`RankNumberBadge`, place/concert/festival/shopping/exhibition 5개 탭 공용으로 분리)
- 순위변동: 텍스트 화살표(▲▼) → lucide 아이콘(TrendingUp/Down) + 팝 애니메이션(`RankBadge.tsx`)
- 검정 CTA 버튼(공유하기·마이페이지 저장·코스/테마 퍼가기·3시간코스 만들기) 전부 `motion.button`으로 전환해 탭/호버 마이크로 인터랙션 추가

#### 9. iOS Safari 입력창 자동 확대 버그 — 전수 조사·수정
- "장소>검색을 누르는 순간 화면이 커진다"는 신고 → 검색창 글자 크기가 14px(`text-sm`)라 iOS Safari가 포커스 시 자동 확대하는 것이 원인(16px 미만 입력창 공통 이슈) — `PlaceList.tsx` 검색창을 `text-base`(16px)로 수정
- 같은 패턴이 있는지 전수 조사(admin 제외) 후 마이페이지 편집(`my/edit/page.tsx`, `my/page.tsx`)·테마 생성 폼(`ThemeMenu.tsx`)의 input/textarea/select 총 14곳도 함께 16px로 통일

#### 10. 어드민 TOP25 화면 탭 분리 + 분야별 분포 시각화 개선
- 분야별 카테고리 분포·공지 배너·TOP25 리스트 3개 섹션이 한 화면에 전부 쌓여 있어 "한꺼번에 보여주지 말고 탭으로 분리해달라"는 요청 — `rankingSubTab` 상태로 3개 탭(🗂️ 분야별 분포 기본값 / 📣 공지 배너 / 📊 TOP25) 전환식으로 재구성
- 분야별 분포의 카테고리 칸이 텍스트 숫자만 있어 "잘 인식이 안 된다"는 피드백 → 장소수(회색)·조회수(남색) 막대를 나란히 세운 미니 바차트로 교체(각 분야 내 최댓값 기준 상대 비율)
- `/admin/region-stats`에 직전 48시간(48~96시간 전) 조회수도 함께 계산(curr/prev CTE 방식)해 변화율(%) 추가, ±20% 이상이면 카드 테두리 강조 — 처음엔 상승/하락 모두 빨간색으로 넣었다가 "국내 증시 관례대로 상승=빨강/하락=파랑"으로 재요청받아 방향별 색상 분리(`isSpikeUp`/`isSpikeDown`)

#### 11. 4시간마다 분야별 조회수 텔레그램 리포트 신설
- `notification.py`에 `send_four_hourly_report()` 추가 — 8개 분야 조회수+직전 48시간 대비 변화율, 전체 DB/코스/유저수를 정리해 발송. 랭킹 갱신과 동일한 KST 0/4/8/12/16/20시 6개 슬롯에 cron 등록(`main.py`), "새벽 4시만 빼달라"는 요청은 등록 자체가 아니라 함수 내부에서 `now_kst.hour == 4`면 조용히 return하는 방식으로 처리
- **배포 후 발견한 잠재 버그**: 이 cron이 로컬 개발 서버(`main.py`가 동일 코드라 로컬도 동일하게 6개 슬롯 등록)에도 그대로 등록돼, 텔레그램 봇용으로 로컬 서버를 켜두는 시간대와 겹치면 서버·로컬 양쪽에서 중복 발송될 뻔함 — `TELEGRAM_BOT_ENABLED=true`(로컬 전용 게이트) 있을 때는 이 cron을 아예 등록하지 않도록 조건 추가, 로컬 프로세스 재시작해 실제로 등록 안 되는 것까지 확인
