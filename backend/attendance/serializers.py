from rest_framework import serializers

from .models import AttendanceRecord, ShiftSetting


class ShiftSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShiftSetting
        fields = ["start", "end"]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "date",
            "first_in",
            "last_out",
            "shift_start",
            "shift_end",
            "time_in_status",
            "work_minutes",
            "night_diff_minutes",
        ]
