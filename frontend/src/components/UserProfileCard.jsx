import { getAvatarSrc, getAvatarTitle } from '../utils/avatar';

const FALLBACK_AVATAR =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiByeD0iMTAwIiBmaWxsPSIjZmM5MWJmIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iI2ZmZmZmZiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTUwIiByeD0iNDAiIHJ5PSIzMCIgZmlsbD0iI2ZmZmZmZiIvPgo8L3N2Zz4K";

export default function UserProfileCard({ user, userStats = {} }) {
  const avatarSrc = getAvatarSrc(user.level);
  const avatarTitle = getAvatarTitle(user.level);

  return (
    <div className="flex flex-col items-center text-center">
      {/* Portrait — large, vellum-framed */}
      <div className="relative">
        <div className="absolute -inset-2 rounded-full bg-[var(--paper-deep)] border-2 border-[var(--frame)] shadow-[0_3px_0_rgba(107,79,44,0.2),inset_0_0_0_4px_var(--paper)]" />
        <img
          src={avatarSrc}
          alt={`${avatarTitle} portrait`}
          className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full object-contain bg-[var(--paper)] p-2"
          onError={(e) => {
            e.target.src = user.avatar || FALLBACK_AVATAR;
          }}
        />
      </div>

      {/* Name plaque */}
      <div className="mt-5 w-full">
        <h2 className="font-display text-2xl text-ink tracking-wide">
          {user.name}
        </h2>
        <p className="text-sm text-ink-soft mt-1 italic">
          Lv. <span className="tabular-nums font-semibold">{user.level}</span>
          {" · "}
          {avatarTitle}
        </p>
      </div>

      {/* Streak */}
      <div className="mt-3 flex items-center gap-2 text-rose font-semibold text-sm">
        <span aria-hidden>★</span>
        <span className="tabular-nums">{user.streak}</span>
        <span>day streak</span>
      </div>

      {userStats && userStats.max_streak > 0 && (
        <p className="text-xs text-ink-mute mt-1">
          best streak — <span className="tabular-nums">{userStats.max_streak}</span> days
        </p>
      )}
    </div>
  );
}
