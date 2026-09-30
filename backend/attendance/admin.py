from django.contrib import admin

from .models import AttendanceRecord, Employee


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "shift_start", "shift_end", "created_at")
    search_fields = ("name", "user__username")


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ("date", "employee", "work_location", "first_in", "last_out", "work_minutes")
    list_filter = ("employee", "work_location")
