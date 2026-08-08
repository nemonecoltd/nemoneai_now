"""서울시 실시간 도시데이터(인구밀도/혼잡도) 폴링 — 지도 탭 혼잡도 카드용.
launchd(com.nemoneai.now.collector-seoul-crowd, 1시간 간격)가 로컬에서 실행.
지점당 1행 UPSERT라 데이터가 누적되지 않음 — cleanup_expired_data()의 45일 TTL 대상 아님(예외)."""
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


def fetch_citydata(area_nm: str) -> Optional[dict]:
    url = f"http://openapi.seoul.go.kr:8088/{SEOUL_API_KEY}/json/citydata/1/5/{area_nm}"
    try:
        res = requests.get(url, timeout=15)
        data = res.json()
    except Exception as e:
        print(f"  ❌ [{area_nm}] 요청 실패: {e}")
        return None
    if "CITYDATA" not in data:
        print(f"  ❌ [{area_nm}] 응답 오류: {data.get('RESULT.CODE')} {data.get('RESULT.MESSAGE')}")
        return None
    return data["CITYDATA"]


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
                        ppltn_min = EXCLUDED.ppltn_min,
                        ppltn_max = EXCLUDED.ppltn_max,
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
    if fail_count:
        send_alert(f"서울시 혼잡도 폴링 일부 실패: {fail_count}/{len(CROWD_AREA_MAP)}건")


if __name__ == "__main__":
    poll_crowd()
