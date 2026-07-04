from rest_framework.throttling import SimpleRateThrottle


class SystemChatIPThrottle(SimpleRateThrottle):
    """Second throttle layer for the System chat endpoint, keyed by client IP.

    The per-account ScopedRateThrottle alone can be dodged by minting fresh
    guest accounts, so this also caps total chat requests per IP address
    across all accounts.
    """
    scope = 'system_chat_ip'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }
