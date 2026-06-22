import base64
import binascii
from dataclasses import dataclass

from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed


@dataclass
class StaticAuthenticatedUser:
    username: str
    role: str = "reception"   # "doctor" | "reception"

    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_doctor(self) -> bool:
        return self.role == "doctor"


class FixedBasicAuthentication(BaseAuthentication):
    """
    Basic auth against fixed credentials defined in settings.FIXED_BASIC_AUTH_USERS.
    Each entry is either a plain password string (legacy) or a dict with
    'password' and 'role' keys.
    """

    www_authenticate_realm = "api"

    def authenticate(self, request):
        auth = get_authorization_header(request).split()

        if not auth:
            return None

        if auth[0].lower() != b"basic":
            return None

        if len(auth) != 2:
            raise AuthenticationFailed("Invalid basic auth header format.")

        try:
            decoded = base64.b64decode(auth[1]).decode("utf-8")
        except (TypeError, UnicodeDecodeError, binascii.Error) as exc:
            raise AuthenticationFailed("Invalid basic auth credentials encoding.") from exc

        if ":" not in decoded:
            raise AuthenticationFailed("Invalid basic auth credentials.")

        username, password = decoded.split(":", 1)

        allowed_users = getattr(settings, "FIXED_BASIC_AUTH_USERS", {})
        entry = allowed_users.get(username)

        if entry is None:
            raise AuthenticationFailed("Invalid username/password.")

        # Support both legacy plain-string and new dict format
        if isinstance(entry, dict):
            if entry.get("password") != password:
                raise AuthenticationFailed("Invalid username/password.")
            role = entry.get("role", "reception")
        else:
            if entry != password:
                raise AuthenticationFailed("Invalid username/password.")
            role = "doctor" if username == "doctor" else "reception"

        return StaticAuthenticatedUser(username=username, role=role), None

    def authenticate_header(self, request):
        return f'Basic realm="{self.www_authenticate_realm}"'
