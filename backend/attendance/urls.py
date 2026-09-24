from django.urls import path

from . import views

urlpatterns = [
    path("records/", views.records, name="records"),
    path("clock-in/", views.clock_in, name="clock-in"),
    path("clock-out/", views.clock_out, name="clock-out"),
    path("export/", views.export_excel, name="export-excel"),
]
