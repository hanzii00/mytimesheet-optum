from rest_framework import serializers

from .models import AttendanceRecord, Employee


class EmployeeSerializer(serializers.ModelSerializer):
    shift_configured = serializers.BooleanField(read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Employee
        fields = ["username", "name", "shift_start", "shift_end", "shift_configured"]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "date",
            "work_location",
            "first_in",
            "last_out",
            "shift_start",
            "shift_end",
            "time_in_status",
            "late_reason",
            "work_minutes",
            "night_diff_minutes",
        ]
