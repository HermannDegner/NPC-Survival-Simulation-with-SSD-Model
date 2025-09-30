import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect } from 'react';

export type Language = 'en' | 'ja';

interface LocalizationContextType {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (key: string, options?: { [key: string]: string | number }) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

const getNestedValue = (obj: any, path: string): string | undefined => {
    if (!obj) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const LocalizationProvider = ({ children }: { children: ReactNode }) => {
    const [language, setLanguage] = useState<Language>('ja');
    const [translations, setTranslations] = useState<Record<Language, any> | null>(null);

    useEffect(() => {
        const fetchTranslations = async () => {
            try {
                const [enResponse, jaResponse] = await Promise.all([
                    fetch('/locales/en.json'),
                    fetch('/locales/ja.json')
                ]);
                const en = await enResponse.json();
                const ja = await jaResponse.json();
                setTranslations({ en, ja });
            } catch (error) {
                console.error("Failed to load translation files:", error);
            }
        };
        fetchTranslations();
    }, []);

    const t = useMemo(() => (key: string, options?: { [key: string]: string | number }): string => {
        if (!translations) {
            // Return key or a loading indicator string instead of empty
            return key;
        }
        
        let text = getNestedValue(translations[language], key);

        if (text === undefined) {
            console.warn(`Translation key "${key}" not found for language "${language}".`);
            // Fallback to English if key not found in current language
            text = getNestedValue(translations['en'], key);
            if(text === undefined) return key;
        }

        if (options) {
            Object.keys(options).forEach(placeholder => {
                const regex = new RegExp(`{{${placeholder}}}`, 'g');
                text = text!.replace(regex, String(options[placeholder]));
            });
        }

        return text;
    }, [language, translations]);

    return (
        <LocalizationContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LocalizationContext.Provider>
    );
};

export const useTranslation = () => {
    const context = useContext(LocalizationContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within a LocalizationProvider');
    }
    return context;
};
