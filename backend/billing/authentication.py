import base64
import binascii
from dataclasses import dataclass

from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed


@dataclass
class StaticAuthenticatedUser:
    username: str

    @property
    def is_authenticated(self) -> bool:
        return True


class FixedBasicAuthentication(BaseAuthentication):
    """
    Basic auth against fixed credentials defined in settings.FIXED_BASIC_AUTH_USERS.
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
        if allowed_users.get(username) != password:
            raise AuthenticationFailed("Invalid username/password.")

        return StaticAuthenticatedUser(username=username), None

    def authenticate_header(self, request):
        return f'Basic realm="{self.www_authenticate_realm}"'
