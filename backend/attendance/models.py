from django.conf import settings
from django.db import models

NAME_MAX_LENGTH = 64


class Employee(models.Model):
    """Attendance profile for one signed-in account."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="employee"
    )
    name = models.CharField(max_length=NAME_MAX_LENGTH)
    shift_start = models.TimeField(null=True, blank=True)
    shift_end = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    @property
    def shift_configured(self):
        return self.shift_start is not None and self.shift_end is not None

    def __str__(self):
        return self.name


class AttendanceRecord(models.Model):
    """A single day's self-recorded attendance: one time in and one time out."""

    class WorkLocation(models.TextChoices):
        RTO = "RTO", "RTO"
        WFH = "WFH", "WFH"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="records")
    date = models.DateField()
    work_location = models.CharField(max_length=3, choices=WorkLocation.choices, blank=True)
    first_in = models.DateTimeField(null=True, blank=True)
    last_out = models.DateTimeField(null=True, blank=True)
    shift_start = models.TimeField(null=True, blank=True)
    shift_end = models.TimeField(null=True, blank=True)
    time_in_status = models.CharField(max_length=32, blank=True)
    work_minutes = models.PositiveIntegerField(default=0)
    night_diff_minutes = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "date"], name="unique_attendance_per_employee_day"),
        ]

    def __str__(self):
        return f"Attendance {self.date} ({self.employee.name})"
