from django.urls import path

from . import auth_views, views

urlpatterns = [
    path("auth/session/", auth_views.session, name="auth-session"),
    path("auth/register/", auth_views.register, name="auth-register"),
    path("auth/login/", auth_views.sign_in, name="auth-login"),
    path("auth/logout/", auth_views.sign_out, name="auth-logout"),
    path("auth/password/", auth_views.change_password, name="auth-password"),
    path("profile/", views.profile, name="profile"),
    path("records/", views.records, name="records"),
    path("clock-in/", views.clock_in, name="clock-in"),
    path("clock-out/", views.clock_out, name="clock-out"),
    path("export/", views.export_excel, name="export-excel"),
]
