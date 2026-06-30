"""문체부 통합 공연 API(CNV_060) 테스트 — 실제 응답 구조/필드/규모 확인용 1회성 스크립트."""
import os
import requests
import xml.dom.minidom
from dotenv import load_dotenv

load_dotenv()

CULTURE_API_KEY = os.getenv("CULTURE_API_KEY")
URL = "https://api.kcisa.kr/openapi/CNV_060/request"


def call(numOfRows=10, pageNo=1, extra=None):
    params = {
        "serviceKey": CULTURE_API_KEY,
        "numOfRows": numOfRows,
        "pageNo": pageNo,
    }
    if extra:
        params.update(extra)
    r = requests.get(URL, params=params, timeout=15)
    print(f"status={r.status_code} url={r.url}")
    return r.text


if __name__ == "__main__":
    raw = call()
    try:
        pretty = xml.dom.minidom.parseString(raw).toprettyxml(indent="  ")
        print(pretty[:5000])
    except Exception:
        print(raw[:3000])
