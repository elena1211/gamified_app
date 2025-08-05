export default function WarningPopup({ type, penalty, onClose }) {
  const isRejection = type === 'rejection';
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{zIndex: 9999}}>
      <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-2xl relative" style={{zIndex: 10000}}>
        <div className="text-center mb-4">
          <div className="text-6xl mb-2">{isRejection ? '😰' : '⏰'}</div>
          <h2 className="text-xl font-bold text-red-600">
            {isRejection ? 'Quest Dismissed!' : 'Time\'s Up!'}
          </h2>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="text-center">
            <p className="text-red-800 font-medium mb-2">
              {isRejection ? 'You chose to avoid the challenge...' : 'The quest time has ended...'}
            </p>
            <div className="text-red-600">
              <span className="font-semibold">Penalty:</span>
              <span className="ml-1">{penalty}</span>
            </div>
          </div>
        </div>

        <div className="text-center mb-6">
          <p className="text-gray-600 text-sm">
            {isRejection 
              ? 'Remember to accept challenges bravely next time - you can do it!' 
              : 'That\'s okay, act faster next time!'
            }
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-medium transition-colors"
        >
          I Understand 😤
        </button>
      </div>
    </div>
  );
}
