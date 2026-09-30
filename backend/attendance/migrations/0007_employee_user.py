import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def create_users_for_employees(apps, schema_editor):
    """Give every pre-auth profile a real account so no attendance is orphaned.

    The accounts start with an unusable password: nobody can log in as them until
    a password is set with `manage.py changepassword <username>`.
    """
    Employee = apps.get_model("attendance", "Employee")
    User = apps.get_model(settings.AUTH_USER_MODEL)

    for employee in Employee.objects.all():
        username = (employee.key or employee.name or f"user{employee.pk}")[:150]
        user = User.objects.filter(username=username).first()
        if user is None:
            user = User.objects.create(
                username=username,
                password="!",  # unusable; Django treats a leading "!" as no password
                is_active=True,
                is_staff=False,
                is_superuser=False,
            )
        employee.user = user
        employee.save(update_fields=["user"])


def drop_generated_users(apps, schema_editor):
    Employee = apps.get_model("attendance", "Employee")
    Employee.objects.update(user=None)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("attendance", "0006_employee"),
    ]

    operations = [
        migrations.AddField(
            model_name="employee",
            name="user",
            field=models.OneToOneField(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="employee",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(create_users_for_employees, drop_generated_users),
        migrations.AlterField(
            model_name="employee",
            name="user",
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="employee",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RemoveField(model_name="employee", name="key"),
    ]
