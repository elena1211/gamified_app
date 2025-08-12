import { getAvatarSrc, getAvatarTitle, getExpForLevel } from '../utils/avatar';

export default function UserProfileCard({ user, userStats = {} }) {
  const avatarSrc = getAvatarSrc(user.level);
  const avatarTitle = getAvatarTitle(user.level);

  // Calculate EXP progress for the current level with safe handling
  const currentLevel = Math.max(1, user.level || 1); // Ensure level is at least 1
  const currentLevelExp = getExpForLevel(currentLevel);
  const nextLevelExp = getExpForLevel(currentLevel + 1);
  const currentExp = Math.max(0, user.exp || 0); // Ensure EXP is not negative

  // Calculate progress within current level
  const expProgress = Math.max(0, currentExp - currentLevelExp);
  const expNeeded = nextLevelExp - currentLevelExp;
  const progressPercentage = expNeeded > 0 ? Math.min((expProgress / expNeeded) * 100, 100) : 100;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="relative">
          <img
            src={avatarSrc}
            alt={`${avatarTitle} Avatar`}
            className="w-20 h-20 rounded-full border-3 border-pink-200 object-contain bg-gray-50"
            onError={(e) => {
              // Fallback to default avatar if image fails to load
              e.target.src = user.avatar || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIHJ4PSIxMDAiIGZpbGw9IiNmYzkxYmYiLz4KPGNpcmNsZSBjeD0iMTAwIiBjeT0iODAiIHI9IjMwIiBmaWxsPSIjZmZmZmZmIi8+CjxlbGxpcHNlIGN4PSIxMDAiIGN5PSIxNTAiIHJ4PSI0MCIgcnk9IjMwIiBmaWxsPSIjZmZmZmZmIi8+Cjwvc3ZnPgo=";
            }}
          />
          <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold shadow-sm">
            {user.level}
          </div>
        </div>
        <div className="w-full">
          <h2 className="text-lg font-bold text-gray-800">{user.name}</h2>
          <p className="text-sm text-gray-600">Level {user.level} {avatarTitle}</p>

          {/* EXP Progress Bar */}
          <div className="mt-2 mb-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>EXP: {expProgress}/{expNeeded}</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, progressPercentage)}%` }}
              ></div>
            </div>
          </div>

          <p className="text-sm text-pink-500 font-medium">{user.streak} days streak 🔥</p>
          {userStats && userStats.max_streak > 0 && (
            <p className="text-xs text-gray-500">
              📈 Max Streak: {userStats.max_streak} days
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
