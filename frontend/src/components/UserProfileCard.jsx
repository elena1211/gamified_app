export default function UserProfileCard({ user }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex flex-col items-center text-center space-y-3">
        <img
          src={user.avatar}
          alt="avatar"
          className="w-20 h-20 rounded-full border-3 border-pink-200 object-cover"
        />
        <div>
          <h2 className="text-lg font-bold text-gray-800">{user.name}</h2>
          <p className="text-sm text-gray-600">Level {user.level} Adventurer</p>
          <p className="text-sm text-pink-500 font-medium">{user.streak} days Streak 🔥</p>
        </div>
      </div>
    </div>
  );
}