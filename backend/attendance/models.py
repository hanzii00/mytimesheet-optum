from django.db import models


class AttendanceRecord(models.Model):
    """A single day's self-recorded attendance: one time in and one time out."""

    date = models.DateField(unique=True)
    first_in = models.DateTimeField(null=True, blank=True)
    last_out = models.DateTimeField(null=True, blank=True)
    work_minutes = models.PositiveIntegerField(default=0)
    night_diff_minutes = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"Attendance {self.date}"
