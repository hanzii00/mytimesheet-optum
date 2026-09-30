import os

import django.db.models.deletion
from django.db import migrations, models
from django.utils.text import slugify

# The records that exist before this migration belong to whoever has been using
# the single-user app, so they are moved onto one profile instead of deleted.
DEFAULT_EMPLOYEE_NAME = os.getenv("ATTENDANCE_DEFAULT_EMPLOYEE", "Hanz")


def claim_existing_data(apps, schema_editor):
    Employee = apps.get_model("attendance", "Employee")
    AttendanceRecord = apps.get_model("attendance", "AttendanceRecord")
    ShiftSetting = apps.get_model("attendance", "ShiftSetting")

    orphans = AttendanceRecord.objects.filter(employee__isnull=True)
    setting = ShiftSetting.objects.first()
    if not orphans.exists() and setting is None:
        return

    name = (DEFAULT_EMPLOYEE_NAME or "Owner").strip()[:64]
    key = slugify(name)[:64] or "owner"
    employee, _ = Employee.objects.get_or_create(
        key=key,
        defaults={
            "name": name,
            "shift_start": setting.start if setting else None,
            "shift_end": setting.end if setting else None,
        },
    )
    orphans.update(employee=employee)


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0005_attendancerecord_work_location"),
    ]

    operations = [
        migrations.CreateModel(
            name="Employee",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.SlugField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=64)),
                ("shift_start", models.TimeField(blank=True, null=True)),
                ("shift_end", models.TimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.AddField(
            model_name="attendancerecord",
            name="employee",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="records",
                to="attendance.employee",
            ),
        ),
        migrations.RunPython(claim_existing_data, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="attendancerecord",
            name="employee",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="records",
                to="attendance.employee",
            ),
        ),
        migrations.AlterField(
            model_name="attendancerecord",
            name="date",
            field=models.DateField(),
        ),
        migrations.AddConstraint(
            model_name="attendancerecord",
            constraint=models.UniqueConstraint(
                fields=("employee", "date"), name="unique_attendance_per_employee_day"
            ),
        ),
        migrations.DeleteModel(name="ShiftSetting"),
    ]
