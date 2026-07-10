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
