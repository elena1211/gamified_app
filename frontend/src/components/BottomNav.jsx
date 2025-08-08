import { Home, Settings } from "lucide-react";
import { useTranslation } from 'react-i18next';

/**
 * Bottom navigation component
 * Provides navigation between main sections of the app
 */
export default function BottomNav({ onSettingsClick }) {
  const { t } = useTranslation('common');
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg safe-area-pb">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex justify-center items-center gap-16">
          <div className="flex flex-col items-center text-pink-600">
            <Home size={24} />
            <span className="text-xs mt-1 font-medium">{t('navigation.home')}</span>
          </div>
          
          <button 
            onClick={onSettingsClick}
            className="flex flex-col items-center text-gray-500 hover:text-pink-600 transition-colors"
          >
            <Settings size={24} />
            <span className="text-xs mt-1 font-medium">{t('navigation.settings')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
