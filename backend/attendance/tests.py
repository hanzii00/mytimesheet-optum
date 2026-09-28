from datetime import datetime, time, timedelta
from unittest import mock

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework.test import APIClient

from .models import AttendanceRecord


class AttendanceApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_records_endpoint_starts_empty(self):
        response = self.client.get(reverse("records"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["records"], [])
        self.assertEqual(response.data["totals"]["work_minutes"], 0)

    def test_clock_in_creates_todays_record(self):
        self.assertEqual(AttendanceRecord.objects.count(), 0)
        response = self.client.post(reverse("clock-in"))
        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(response.data["first_in"])
        self.assertIsNone(response.data["last_out"])
        self.assertEqual(AttendanceRecord.objects.count(), 1)

    def test_double_clock_in_is_rejected(self):
        self.client.post(reverse("clock-in"))
        response = self.client.post(reverse("clock-in"))
        self.assertEqual(response.status_code, 400)

    def test_clock_in_attaches_shift_and_labels_almost_late(self):
        today = timezone.localdate()
        almost_late = timezone.make_aware(datetime.combine(today, time(8, 55)))

        with mock.patch("django.utils.timezone.now", return_value=almost_late):
            response = self.client.post(reverse("clock-in"), {"shift_start": "09:00", "shift_end": "18:00"})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["shift_start"], "09:00:00")
        self.assertEqual(response.data["shift_end"], "18:00:00")
        self.assertEqual(response.data["time_in_status"], "Almost late")

    def test_clock_in_labels_early_bird(self):
        today = timezone.localdate()
        early = timezone.make_aware(datetime.combine(today, time(7, 45)))

        with mock.patch("django.utils.timezone.now", return_value=early):
            response = self.client.post(reverse("clock-in"), {"shift_start": "09:00"})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["time_in_status"], "Early bird")

    def test_clock_in_labels_late_arrival(self):
        today = timezone.localdate()
        late = timezone.make_aware(datetime.combine(today, time(9, 1)))

        with mock.patch("django.utils.timezone.now", return_value=late):
            response = self.client.post(reverse("clock-in"), {"shift_start": "09:00"})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["time_in_status"], "Late arrival")

    def test_clock_in_rejects_invalid_shift_time(self):
        response = self.client.post(reverse("clock-in"), {"shift_start": "9am"})
        self.assertEqual(response.status_code, 400)

    def test_shift_setting_persists_and_is_returned(self):
        response = self.client.put(reverse("shift-setting"), {"start": "18:00", "end": "03:00"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["start"], "18:00:00")
        self.assertEqual(response.data["end"], "03:00:00")

        response = self.client.get(reverse("shift-setting"))
        self.assertEqual(response.data["start"], "18:00:00")
        self.assertEqual(response.data["end"], "03:00:00")

    def test_clock_in_falls_back_to_saved_shift(self):
        self.client.put(reverse("shift-setting"), {"start": "18:00", "end": "03:00"}, format="json")
        today = timezone.localdate()
        clock_in_at = timezone.make_aware(datetime.combine(today, time(17, 51)))

        with mock.patch("django.utils.timezone.now", return_value=clock_in_at):
            response = self.client.post(reverse("clock-in"))

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["shift_start"], "18:00:00")
        self.assertEqual(response.data["time_in_status"], "Almost late")

    def test_records_exposes_open_overnight_session(self):
        yesterday = timezone.localdate() - timedelta(days=1)
        AttendanceRecord.objects.create(
            date=yesterday,
            first_in=timezone.make_aware(datetime.combine(yesterday, time(18, 0))),
            shift_start=time(18, 0),
            shift_end=time(3, 0),
        )

        response = self.client.get(reverse("records"))
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["open_record"])
        self.assertEqual(response.data["open_record"]["date"], yesterday.isoformat())

    def test_clock_out_closes_session_started_yesterday(self):
        yesterday = timezone.localdate() - timedelta(days=1)
        started_at = timezone.make_aware(datetime.combine(yesterday, time(18, 0)))
        AttendanceRecord.objects.create(date=yesterday, first_in=started_at, shift_start=time(18, 0))

        with mock.patch("django.utils.timezone.now", return_value=started_at + timedelta(hours=9)):
            response = self.client.post(reverse("clock-out"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["date"], yesterday.isoformat())
        self.assertAlmostEqual(response.data["work_minutes"], 540, delta=1)

    def test_clock_out_requires_clock_in_first(self):
        response = self.client.post(reverse("clock-out"))
        self.assertEqual(response.status_code, 400)

    def test_double_clock_out_is_rejected(self):
        self.client.post(reverse("clock-in"))
        self.client.post(reverse("clock-out"))
        response = self.client.post(reverse("clock-out"))
        self.assertEqual(response.status_code, 400)

    def test_clock_out_records_last_out_and_work_minutes(self):
        self.client.post(reverse("clock-in"))
        record = AttendanceRecord.objects.get(date=timezone.localdate())
        record.first_in = timezone.now() - timedelta(hours=8)
        record.save(update_fields=["first_in"])

        response = self.client.post(reverse("clock-out"))
        self.assertEqual(response.status_code, 200)
        record.refresh_from_db()
        self.assertIsNotNone(record.last_out)
        self.assertAlmostEqual(record.work_minutes, 480, delta=1)

    def test_night_diff_is_computed_for_overnight_shift(self):
        self.client.post(reverse("clock-in"))
        record = AttendanceRecord.objects.get(date=timezone.localdate())
        today = timezone.localdate()
        shift_start = timezone.make_aware(datetime.combine(today, time(21, 0)))
        record.first_in = shift_start
        record.save(update_fields=["first_in"])

        with mock.patch("django.utils.timezone.now", return_value=shift_start + timedelta(hours=8)):
            response = self.client.post(reverse("clock-out"))

        self.assertEqual(response.status_code, 200)
        record.refresh_from_db()
        # Shift 9 PM -> 5 AM: night diff applies from 10 PM -> 5 AM = 7 hours = 420 minutes.
        self.assertAlmostEqual(record.night_diff_minutes, 420, delta=1)

    def test_day_shift_has_no_night_diff(self):
        self.client.post(reverse("clock-in"))
        record = AttendanceRecord.objects.get(date=timezone.localdate())
        today = timezone.localdate()
        shift_start = timezone.make_aware(datetime.combine(today, time(8, 0)))
        record.first_in = shift_start
        record.save(update_fields=["first_in"])

        with mock.patch("django.utils.timezone.now", return_value=shift_start + timedelta(hours=8)):
            response = self.client.post(reverse("clock-out"))

        self.assertEqual(response.status_code, 200)
        record.refresh_from_db()
        self.assertEqual(record.night_diff_minutes, 0)

    def test_export_returns_xlsx_with_recorded_rows(self):
        today = timezone.localdate()
        AttendanceRecord.objects.create(
            date=today,
            shift_start=time(8, 0),
            shift_end=time(17, 0),
            time_in_status="Right on time",
            first_in=timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time())) + timedelta(hours=8),
            last_out=timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time())) + timedelta(hours=17),
            work_minutes=540,
            night_diff_minutes=60,
        )

        response = self.client.get(reverse("export-excel"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        workbook = load_workbook(filename=__import__("io").BytesIO(response.content))
        sheet = workbook.active
        header = [cell.value for cell in sheet[1]]
        self.assertEqual(
            header,
            ["Date", "Shift Start", "Shift End", "Time In", "Time Out", "Time In Label", "Hours Worked", "Night Diff Hours"],
        )
        data_row = [cell.value for cell in sheet[2]]
        self.assertEqual(data_row[0], today.strftime("%Y-%m-%d"))
        self.assertEqual(data_row[5], "Right on time")
        self.assertEqual(data_row[6], 9.0)
        self.assertEqual(data_row[7], 1.0)
