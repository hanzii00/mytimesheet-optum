from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import NAME_MAX_LENGTH, Employee
from .serializers import EmployeeSerializer

USERNAME_MAX_LENGTH = 150


def clean_username(value):
    return (value or "").strip().lower()[:USERNAME_MAX_LENGTH]


def profile_payload(user):
    employee = getattr(user, "employee", None)
    if employee is None:
        employee = Employee.objects.create(user=user, name=user.username)
    data = EmployeeSerializer(employee).data
    data["username"] = user.username
    return data


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def session(request):
    """Bootstrap the CSRF cookie and report who, if anyone, is signed in."""
    if not request.user.is_authenticated:
        return Response({"authenticated": False})
    return Response({"authenticated": True, "profile": profile_payload(request.user)})


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    username = clean_username(request.data.get("username"))
    password = request.data.get("password") or ""
    display_name = (request.data.get("name") or "").strip()[:NAME_MAX_LENGTH] or username

    if not username:
        return Response({"detail": "Pick a username."}, status=status.HTTP_400_BAD_REQUEST)
    if not username.replace("_", "").replace("-", "").replace(".", "").isalnum():
        return Response(
            {"detail": "Usernames can use letters, numbers, and . - _ only."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    User = get_user_model()
    if User.objects.filter(username=username).exists():
        return Response(
            {"detail": "That username is taken. Try another one."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        validate_password(password)
    except ValidationError as error:
        return Response({"detail": " ".join(error.messages)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            user = User.objects.create_user(username=username, password=password)
            Employee.objects.create(user=user, name=display_name)
    except IntegrityError:
        return Response(
            {"detail": "That username is taken. Try another one."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    login(request, user)
    return Response(
        {"authenticated": True, "profile": profile_payload(user)}, status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def sign_in(request):
    username = clean_username(request.data.get("username"))
    password = request.data.get("password") or ""

    user = authenticate(request, username=username, password=password)
    if user is None:
        # Deliberately vague so this cannot be used to discover who has an account.
        return Response(
            {"detail": "Incorrect username or password."}, status=status.HTTP_401_UNAUTHORIZED
        )

    login(request, user)
    return Response({"authenticated": True, "profile": profile_payload(user)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sign_out(request):
    logout(request)
    return Response({"authenticated": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    current = request.data.get("current_password") or ""
    new_password = request.data.get("new_password") or ""

    if not request.user.check_password(current):
        return Response(
            {"detail": "Your current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        validate_password(new_password, user=request.user)
    except ValidationError as error:
        return Response({"detail": " ".join(error.messages)}, status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])
    # Keep this browser signed in after the password rotation.
    login(request, request.user)
    return Response({"detail": "Password updated."})
