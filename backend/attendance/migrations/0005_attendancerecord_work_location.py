from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0004_shiftsetting"),
    ]

    operations = [
        migrations.AddField(
            model_name="attendancerecord",
            name="work_location",
            field=models.CharField(
                blank=True,
                choices=[("RTO", "RTO"), ("WFH", "WFH")],
                max_length=3,
            ),
        ),
    ]
