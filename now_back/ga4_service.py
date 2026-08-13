"""Google Analytics 4(GA4) Data API 리포트 — 방문자/조회수/광고수익/국가별 통계를 텔레그램으로 발송.
서비스 계정 인증(OAuth 불필요) — GA4 속성 액세스 관리에 서비스 계정을 뷰어로 등록해둬야 함.
광고수익(totalAdRevenue)은 GA4 속성이 애드센스와 연결돼 있어야 실제 값이 나옴(2026-08-13 확인, 정상 연동됨)."""
import os
from datetime import datetime, timedelta, timezone

from notification import send_alert

_KST = timezone(timedelta(hours=9))

_COUNTRY_LABEL = [
    ("United States", "미국"),
    ("Hong Kong", "홍콩"),
    ("Taiwan", "대만"),
    ("Japan", "일본"),
]


def _client():
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.oauth2 import service_account

    creds_path = os.getenv("GA4_CREDENTIALS_PATH", "credentials/ga4-service-account.json")
    credentials = service_account.Credentials.from_service_account_file(creds_path)
    return BetaAnalyticsDataClient(credentials=credentials)


def _delta_text(curr: float, prev: float, is_currency: bool = False) -> str:
    diff = curr - prev
    sign = "+" if diff >= 0 else "-"
    if is_currency:
        return f"{sign}₩{abs(diff):,.0f}"
    return f"{sign}{abs(diff):,.0f}"


def send_ga4_report() -> None:
    """KST 6/9/12/15/18/21/24시 발송 — 오늘 0시부터 지금(발송 시각)까지 누적치를 어제·지난주 같은
    요일의 같은 시간대(0시~같은 시각)와 비교. GA4 데이터는 몇 시간 처리 지연이 있을 수 있어
    발송 시점 기준 최신치가 아직 안 잡혀 있을 수 있음(구글 쪽 특성, 우리가 제어 불가)."""
    from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Dimension, Metric

    property_id = os.getenv("GA4_PROPERTY_ID", "542035264")
    now_kst = datetime.now(timezone.utc).astimezone(_KST)
    today = now_kst.date()
    yesterday = today - timedelta(days=1)
    last_week = today - timedelta(days=7)
    cutoff_hour = now_kst.hour

    client = _client()

    # 1) 방문자/조회수/광고수익 — 오늘/어제/지난주 3개 구간을 한 번에 조회 후, 0시~cutoff_hour만 합산
    hourly_req = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name="hour")],
        metrics=[Metric(name="activeUsers"), Metric(name="screenPageViews"), Metric(name="totalAdRevenue")],
        date_ranges=[
            DateRange(start_date=str(today), end_date=str(today), name="today"),
            DateRange(start_date=str(yesterday), end_date=str(yesterday), name="yesterday"),
            DateRange(start_date=str(last_week), end_date=str(last_week), name="lastweek"),
        ],
    )
    hourly_resp = client.run_report(hourly_req)
    sums = {"today": [0, 0, 0.0], "yesterday": [0, 0, 0.0], "lastweek": [0, 0, 0.0]}
    for row in hourly_resp.rows:
        hour = int(row.dimension_values[0].value)
        dr = row.dimension_values[1].value
        if hour < cutoff_hour and dr in sums:
            sums[dr][0] += int(row.metric_values[0].value)
            sums[dr][1] += int(row.metric_values[1].value)
            sums[dr][2] += float(row.metric_values[2].value)

    users, views, revenue = sums["today"]
    y_users, y_views, y_revenue = sums["yesterday"]
    w_users, w_views, w_revenue = sums["lastweek"]

    # 2) 국가별 — 오늘 하루 누적(비교 없음), 지정된 4개국 외엔 전부 기타로 합산
    country_req = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name="country")],
        metrics=[Metric(name="activeUsers")],
        date_ranges=[DateRange(start_date=str(today), end_date=str(today))],
    )
    country_resp = client.run_report(country_req)
    country_counts = {ga_name: 0 for ga_name, _ in _COUNTRY_LABEL}
    others = 0
    for row in country_resp.rows:
        name = row.dimension_values[0].value
        count = int(row.metric_values[0].value)
        if name in country_counts:
            country_counts[name] += count
        else:
            others += count

    lines = [
        f"📈 GA4 리포트 ({now_kst.strftime('%m/%d %H:%M')} 기준, 오늘 00시~현재 누적)",
        "",
        f"오늘 누적 방문자: {users:,}명 (어제대비 {_delta_text(users, y_users)} / 지난주대비 {_delta_text(users, w_users)})",
        f"오늘 누적 조회수: {views:,}회 (어제대비 {_delta_text(views, y_views)} / 지난주대비 {_delta_text(views, w_views)})",
        f"오늘 누적 광고수익: ₩{revenue:,.0f} (어제대비 {_delta_text(revenue, y_revenue, True)} / 지난주대비 {_delta_text(revenue, w_revenue, True)})",
        "",
        "오늘 누적 국가",
        " | ".join(
            [f"{ko} {country_counts[ga]:,}명" for ga, ko in _COUNTRY_LABEL] + [f"기타 {others:,}명"]
        ),
    ]
    send_alert("\n".join(lines))
