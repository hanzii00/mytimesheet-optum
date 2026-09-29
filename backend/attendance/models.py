from datetime import time

from django.db import models


class ShiftSetting(models.Model):
    """The user's saved shift, stored once so it survives browser/device changes."""

    start = models.TimeField(default=time(9, 0))
    end = models.TimeField(default=time(18, 0))

    @classmethod
    def load(cls):
        setting, _ = cls.objects.get_or_create(pk=1)
        return setting

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Shift {self.start}-{self.end}"


class AttendanceRecord(models.Model):
    """A single day's self-recorded attendance: one time in and one time out."""

    class WorkLocation(models.TextChoices):
        RTO = "RTO", "RTO"
        WFH = "WFH", "WFH"

    date = models.DateField(unique=True)
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

    def __str__(self):
        return f"Attendance {self.date}"
