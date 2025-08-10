import { Home, Settings, ClipboardList } from "lucide-react";
import { useTranslation } from 'react-i18next';

/**
 * Bottom navigation component
 * Provides navigation between main sections of the app
 */
export default function BottomNav({ onSettingsClick, onHomeClick, onTaskManagerClick }) {
  const { t } = useTranslation('common');
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg safe-area-pb">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex justify-center items-center gap-12">
          <button 
            onClick={onHomeClick}
            className="flex flex-col items-center text-pink-600 hover:text-pink-700 transition-colors"
          >
            <Home size={24} />
            <span className="text-xs mt-1 font-medium">Home</span>
          </button>
          
          <button 
            onClick={onTaskManagerClick}
            className="flex flex-col items-center text-gray-500 hover:text-pink-600 transition-colors"
          >
            <ClipboardList size={24} />
            <span className="text-xs mt-1 font-medium">Tasks</span>
          </button>
          
          <button 
            onClick={onSettingsClick}
            className="flex flex-col items-center text-gray-500 hover:text-pink-600 transition-colors"
          >
            <Settings size={24} />
            <span className="text-xs mt-1 font-medium">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
