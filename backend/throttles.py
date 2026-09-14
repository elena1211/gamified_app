from rest_framework.throttling import SimpleRateThrottle


class IPRateThrottle(SimpleRateThrottle):
    """Throttles by client IP across every account.

    A per-account ScopedRateThrottle alone can be dodged by minting fresh
    guest accounts, so endpoints that call the AI provider also cap requests
    per IP address. Subclasses set the scope.
    """

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class SystemChatIPThrottle(IPRateThrottle):
    scope = 'system_chat_ip'


class PathProposalIPThrottle(IPRateThrottle):
    scope = 'path_proposal_ip'
