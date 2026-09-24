from datetime import datetime

from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import AttendanceRecord
from .serializers import AttendanceRecordSerializer
from .utils import compute_night_diff_minutes


@api_view(["GET"])
def records(request):
    queryset = AttendanceRecord.objects.all()
    month = request.query_params.get("month")
    if month:
        try:
            month_start = datetime.strptime(month, "%Y-%m").date()
        except ValueError:
            return Response({"detail": "Month must use YYYY-MM format."}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(date__year=month_start.year, date__month=month_start.month)

    totals = queryset.aggregate(work_minutes=Sum("work_minutes"), night_diff_minutes=Sum("night_diff_minutes"))
    return Response(
        {
            "records": AttendanceRecordSerializer(queryset, many=True).data,
            "totals": {
                "work_minutes": totals["work_minutes"] or 0,
                "night_diff_minutes": totals["night_diff_minutes"] or 0,
            },
        }
    )


@api_view(["POST"])
def clock_in(request):
    open_record = AttendanceRecord.objects.filter(first_in__isnull=False, last_out__isnull=True).first()
    if open_record:
        return Response(
            {
                "detail": (
                    f"You already timed in on {open_record.date} at "
                    f"{timezone.localtime(open_record.first_in):%I:%M %p}. Time out first."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    today = timezone.localdate()
    now = timezone.now()
    record, created = AttendanceRecord.objects.get_or_create(date=today, defaults={"first_in": now})
    if not created:
        record.first_in = now
        record.save(update_fields=["first_in"])
    return Response(
        AttendanceRecordSerializer(record).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["POST"])
def clock_out(request):
    # Match the currently open session rather than strictly "today's" record,
    # so overnight shifts that cross midnight are closed out correctly.
    record = AttendanceRecord.objects.filter(first_in__isnull=False, last_out__isnull=True).order_by("-date").first()
    if not record:
        return Response({"detail": "Time in before you can time out."}, status=status.HTTP_400_BAD_REQUEST)
    now = timezone.now()
    elapsed_minutes = int((now - record.first_in).total_seconds() // 60)
    record.last_out = now
    record.work_minutes = max(0, elapsed_minutes)
    record.night_diff_minutes = compute_night_diff_minutes(record.first_in, now)
    record.save(update_fields=["last_out", "work_minutes", "night_diff_minutes"])
    return Response(AttendanceRecordSerializer(record).data)


@api_view(["GET"])
def export_excel(request):
    queryset = AttendanceRecord.objects.all()
    month = request.query_params.get("month")
    if month:
        try:
            month_start = datetime.strptime(month, "%Y-%m").date()
        except ValueError:
            return Response({"detail": "Month must use YYYY-MM format."}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(date__year=month_start.year, date__month=month_start.month)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Attendance"

    headers = ["Date", "Time In", "Time Out", "Hours Worked", "Night Diff Hours"]
    sheet.append(headers)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(horizontal="center")

    for record in queryset.order_by("date"):
        time_in = timezone.localtime(record.first_in).strftime("%I:%M %p") if record.first_in else ""
        time_out = timezone.localtime(record.last_out).strftime("%I:%M %p") if record.last_out else ""
        hours_worked = round(record.work_minutes / 60, 2) if record.work_minutes else 0
        night_diff_hours = round(record.night_diff_minutes / 60, 2) if record.night_diff_minutes else 0
        sheet.append([record.date.strftime("%Y-%m-%d"), time_in, time_out, hours_worked, night_diff_hours])

    for index, header in enumerate(headers, start=1):
        column_letter = get_column_letter(index)
        sheet.column_dimensions[column_letter].width = max(14, len(header) + 4)

    filename = f"attendance_{month or 'all'}.xlsx"
    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    workbook.save(response)
    return response
