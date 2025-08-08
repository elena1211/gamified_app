import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';

/**
 * Language switcher component with dropdown interface
 * Allows users to switch between supported languages
 */
function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'zh', name: '繁體中文', flag: '🇹🇼' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' }
  ];
  
  const changeLanguage = async (languageCode) => {
    setIsOpen(false);
    
    try {
      await i18n.changeLanguage(languageCode);
      
      // Update URL parameter (optional)
      const url = new URL(window.location);
      url.searchParams.set('lng', languageCode);
      window.history.pushState({}, '', url);
      
      // Update HTML lang attribute for accessibility
      document.documentElement.lang = languageCode;
      
    } catch (error) {
      console.error('Language change failed:', error);
    }
  };
  
  const currentLang = languages.find(lang => lang.code === i18n.language) || languages[0];
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center px-3 py-2 rounded-lg border hover:bg-gray-50 transition-colors"
        aria-label="Select language"
      >
        <Globe className="w-4 h-4 mr-2" />
        <span className="mr-1" role="img" aria-label={currentLang.name}>
          {currentLang.flag}
        </span>
        <span className="text-sm">{currentLang.name}</span>
        <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-full">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center ${
                i18n.language === lang.code ? 'bg-blue-50 text-blue-600' : ''
              }`}
              aria-label={`Switch to ${lang.name}`}
            >
              <span className="mr-2" role="img" aria-label={lang.name}>
                {lang.flag}
              </span>
              <span className="text-sm">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
