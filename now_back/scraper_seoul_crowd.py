"""서울시 실시간 도시데이터(인구밀도/혼잡도) 폴링 — 지도 탭/메인 티커 혼잡도용.
main.py APScheduler(poll_crowd, 10분 간격)가 서버에서 실행(2026-08-09, 로컬 launchd에서 이전 —
"실시간" 데이터가 로컬 맥 전원/네트워크 상태에 좌우되면 서비스 연속성이 깨지기 때문).
지점당 1행 UPSERT라 데이터가 누적되지 않음 — cleanup_expired_data()의 45일 TTL 대상 아님(예외).
CLI로 직접 실행(python scraper_seoul_crowd.py)도 그대로 가능 — 로컬 디버깅/최초 시딩용."""
import json
import os
from typing import Optional

import requests
from dotenv import load_dotenv
from sqlalchemy import text

from database import engine
from deps import CROWD_AREA_MAP
from notification import send_alert

load_dotenv()

SEOUL_API_KEY = os.getenv("SEOUL_API_KEY")

# 서울시 API가 순간적으로(한 폴링 주기 전체, 5개 지점 다) 응답을 안 주는 경우가 잦아서
# (우리 쪽 문제가 아니라 저쪽 서버가 그때만 그런 것 — 몇 분 뒤 재확인하면 정상 응답함),
# 실패할 때마다 알림을 보내면 10분마다 알림이 온다. 연속 6회(60분) 이상 전부 실패할 때만
# 알리고, 그 사이 한 번이라도 성공하면 조용히 카운터만 리셋한다(2026-08-30, 2회/20분에서
# 60분으로 완화).
_consecutive_full_failures = 0


def _ensure_table(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS crowd_status (
            area_nm TEXT PRIMARY KEY,
            area_cd TEXT,
            congest_lvl TEXT,
            prev_congest_lvl TEXT,
            ppltn_min INTEGER,
            ppltn_max INTEGER,
            prev_ppltn_min INTEGER,
            prev_ppltn_max INTEGER,
            fcst_text TEXT,
            age_gender_summary JSONB,
            weather_summary JSONB,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))


def fetch_citydata(area_nm: str, retries: int = 2) -> Optional[dict]:
    url = f"http://openapi.seoul.go.kr:8088/{SEOUL_API_KEY}/json/citydata/1/5/{area_nm}"
    last_err = None
    for attempt in range(retries + 1):
        try:
            res = requests.get(url, timeout=15)
            data = res.json()
        except Exception as e:
            last_err = e
            continue
        if "CITYDATA" not in data:
            print(f"  ❌ [{area_nm}] 응답 오류: {data.get('RESULT.CODE')} {data.get('RESULT.MESSAGE')}")
            return None
        return data["CITYDATA"]
    print(f"  ❌ [{area_nm}] 요청 실패({retries + 1}회 시도): {last_err}")
    return None


def _age_gender_summary(live: dict) -> dict:
    return {
        "male_rate": live.get("MALE_PPLTN_RATE"),
        "female_rate": live.get("FEMALE_PPLTN_RATE"),
        "age_rates": {
            age: live.get(f"PPLTN_RATE_{age}")
            for age in ["0", "10", "20", "30", "40", "50", "60", "70"]
        },
    }


def _weather_summary(weather_list: list) -> Optional[dict]:
    if not weather_list:
        return None
    w = weather_list[0]
    sky = (w.get("FCST24HOURS") or [{}])[0].get("SKY_STTS")
    return {
        "temp": w.get("TEMP"),
        "sky": sky,
        "pcp_msg": w.get("PCP_MSG"),
        "air_idx": w.get("AIR_IDX"),
    }


def _fcst_text(fcst_list: list) -> Optional[str]:
    if not fcst_list:
        return None
    nxt = fcst_list[0]
    time_hm = (nxt.get("FCST_TIME") or "")[-5:]
    return f"{time_hm} {nxt.get('FCST_CONGEST_LVL', '')} 예상" if time_hm else None


def poll_crowd():
    print("=" * 50)
    print("🏙️  서울시 실시간 도시데이터(혼잡도) 폴링 시작")
    print("=" * 50)
    if not SEOUL_API_KEY or SEOUL_API_KEY == "sample":
        print("⚠️ SEOUL_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.")
        return

    ok_count = fail_count = 0
    with engine.connect() as conn:
        _ensure_table(conn)
        conn.commit()

    for key, area_nm in CROWD_AREA_MAP.items():
        citydata = fetch_citydata(area_nm)
        if not citydata:
            fail_count += 1
            continue

        live = (citydata.get("LIVE_PPLTN_STTS") or [{}])[0]
        ppltn_min = int(live["AREA_PPLTN_MIN"]) if live.get("AREA_PPLTN_MIN") else None
        ppltn_max = int(live["AREA_PPLTN_MAX"]) if live.get("AREA_PPLTN_MAX") else None

        params = {
            "area_nm": key,
            "area_cd": citydata.get("AREA_CD"),
            "congest_lvl": live.get("AREA_CONGEST_LVL"),
            "ppltn_min": ppltn_min,
            "ppltn_max": ppltn_max,
            "fcst_text": _fcst_text(live.get("FCST_PPLTN") or []),
            "age_gender_summary": json.dumps(_age_gender_summary(live), ensure_ascii=False),
            "weather_summary": json.dumps(_weather_summary(citydata.get("WEATHER_STTS") or []), ensure_ascii=False),
        }

        try:
            with engine.connect() as conn:
                # ON CONFLICT 내에서 prev_* = 갱신 전(crowd_status.*) 값을 그대로 참조 —
                # 별도 SELECT 없이 한 번의 UPSERT로 "현재값→prev로 이동, 새값 반영"을 원자적으로 처리.
                # 최초 INSERT(행 없음)는 prev_* 컬럼을 안 채우므로 NULL 그대로.
                # ppltn_min/max는 COALESCE로 기존 값을 보존 — 서울시 API가 특정 주기에 해당 필드를
                # 빈 값으로 주면(=ppltn_min/max가 None) 직전 정상값을 NULL로 덮어써 /crowd 500 에러를
                # 유발했음(2026-08-11). API 응답 누락은 "값 없음"이 아니라 "이번엔 못 받음"으로 취급.
                conn.execute(text("""
                    INSERT INTO crowd_status
                        (area_nm, area_cd, congest_lvl, ppltn_min, ppltn_max, fcst_text,
                         age_gender_summary, weather_summary, updated_at)
                    VALUES
                        (:area_nm, :area_cd, :congest_lvl, :ppltn_min, :ppltn_max, :fcst_text,
                         CAST(:age_gender_summary AS jsonb), CAST(:weather_summary AS jsonb), NOW())
                    ON CONFLICT (area_nm) DO UPDATE SET
                        area_cd = EXCLUDED.area_cd,
                        prev_congest_lvl = crowd_status.congest_lvl,
                        congest_lvl = EXCLUDED.congest_lvl,
                        prev_ppltn_min = crowd_status.ppltn_min,
                        prev_ppltn_max = crowd_status.ppltn_max,
                        ppltn_min = COALESCE(EXCLUDED.ppltn_min, crowd_status.ppltn_min),
                        ppltn_max = COALESCE(EXCLUDED.ppltn_max, crowd_status.ppltn_max),
                        fcst_text = EXCLUDED.fcst_text,
                        age_gender_summary = EXCLUDED.age_gender_summary,
                        weather_summary = EXCLUDED.weather_summary,
                        updated_at = NOW()
                """), params)
                conn.commit()
            print(f"  ✅ [{key}] {live.get('AREA_CONGEST_LVL')} · {ppltn_min}~{ppltn_max}명")
            ok_count += 1
        except Exception as e:
            # DB 오류가 나도 기존 행은 이번 UPDATE가 안 먹었을 뿐 그대로 남아있음 — 화면엔 직전 정상값 유지됨
            fail_count += 1
            print(f"  ❌ [{key}] DB 반영 실패: {e}")

    print(f"🏁 완료 — 성공 {ok_count} / 실패 {fail_count}")

    global _consecutive_full_failures
    total = len(CROWD_AREA_MAP)
    if fail_count == total:
        _consecutive_full_failures += 1
        # 폴링 주기가 30분으로 늘어나(2026-08-31) 2회 연속 실패면 이미 60분째라 스팸 걱정 없이
        # 다시 2회부터 알림. 이후로도 2회(60분)에 한 번씩만 반복 알림.
        n = _consecutive_full_failures
        if n >= 2 and n % 2 == 0:
            send_alert(f"서울시 혼잡도 폴링 {n}회 연속 전체 실패 (약 {n * 30}분째 지속)")
    elif fail_count:
        # 일부 지점만 실패는 지금까지도 알림 없이 넘겨왔던 수준이라 그대로 둠(로그로만 확인)
        pass
    else:
        if _consecutive_full_failures >= 2:
            send_alert(f"서울시 혼잡도 폴링 정상 복구됨 ({_consecutive_full_failures}회 연속 실패 후)")
        _consecutive_full_failures = 0


if __name__ == "__main__":
    poll_crowd()
