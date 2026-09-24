from datetime import datetime, time, timedelta

from django.utils import timezone


NIGHT_DIFF_START = time(22, 0)  # 10:00 PM
NIGHT_DIFF_END = time(5, 0)  # 5:00 AM


def compute_night_diff_minutes(start, end):
    """Return minutes worked between 10:00 PM and 5:00 AM within [start, end).

    Handles shifts that span midnight by checking every night window that
    overlaps the worked range, one calendar day at a time.
    """
    if not start or not end or end <= start:
        return 0

    total = timedelta()
    local_start = timezone.localtime(start)
    local_end = timezone.localtime(end)

    day = local_start.date() - timedelta(days=1)
    last_day = local_end.date()

    while day <= last_day:
        window_start = timezone.make_aware(datetime.combine(day, NIGHT_DIFF_START), local_start.tzinfo)
        window_end = timezone.make_aware(
            datetime.combine(day + timedelta(days=1), NIGHT_DIFF_END), local_start.tzinfo
        )
        overlap_start = max(local_start, window_start)
        overlap_end = min(local_end, window_end)
        if overlap_end > overlap_start:
            total += overlap_end - overlap_start
        day += timedelta(days=1)

    return int(total.total_seconds() // 60)
