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
    Basic auth that checks:
    1. Database User model first
    2. Falls back to settings.FIXED_BASIC_AUTH_USERS if database check fails
    
    This allows migration from settings-based auth to database-based auth
    while maintaining backward compatibility.
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

        # Try database authentication first
        try:
            from .models import User
            # Check if user exists in database
            try:
                user = User.objects.get(username=username)
                # User exists in database, so we MUST use database auth only
                if not user.is_active:
                    raise AuthenticationFailed("Account is inactive.")
                if user.check_password(password):
                    return StaticAuthenticatedUser(username=username, role=user.role), None
                else:
                    # Password is wrong, don't fall back to settings
                    raise AuthenticationFailed("Invalid username/password.")
            except User.DoesNotExist:
                # User doesn't exist in database, try settings-based auth
                pass
        except AuthenticationFailed:
            # Re-raise authentication failures (wrong password, inactive account)
            raise
        except Exception:
            # For other errors, log and continue to settings-based auth
            pass

        # Fall back to settings-based authentication ONLY if user doesn't exist in database
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
        # Don't return WWW-Authenticate header for AJAX requests to prevent browser popup
        # Check if it's an AJAX/API request
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or \
           request.headers.get('Content-Type') == 'application/json' or \
           request.path.startswith('/api/'):
            return None
        return f'Basic realm="{self.www_authenticate_realm}"'
