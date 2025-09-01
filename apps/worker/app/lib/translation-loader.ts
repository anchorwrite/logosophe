import { SupportedLanguageCode } from './languages';

// Translation data cache
const translationCache = new Map<SupportedLanguageCode, any>();

// Load translation file for a specific language
export async function loadTranslation(language: SupportedLanguageCode): Promise<any> {
  // Check cache first
  if (translationCache.has(language)) {
    return translationCache.get(language);
  }

  try {
    // Dynamic import of translation file
    const translationModule = await import(`../locales/${language}/translation.json`);
    const translation = translationModule.default || translationModule;
    
    // Cache the translation
    translationCache.set(language, translation);
    
    return translation;
  } catch (error) {
    console.error(`Failed to load translation for language: ${language}`, error);
    
    // Fallback to English if the requested language fails to load
    if (language !== 'en') {
      console.log(`Falling back to English translation for language: ${language}`);
      return loadTranslation('en');
    }
    
    // If even English fails, return a minimal fallback
    return {
      emails: {
        verification: {
          subject: 'Verify Your Email Address - Logosophe',
          greeting: 'Hello {{name}},',
          body: 'Thank you for subscribing to Logosophe! To complete your subscription, please verify your email address by clicking the link below:',
          verification_link: '{{verificationUrl}}',
          expiration_notice: 'This link will expire in 24 hours for security reasons.',
          ignore_notice: 'If you didn\'t request this subscription, you can safely ignore this email.',
          signature: 'Best regards,\nThe Logosophe Team'
        },
        welcome: {
          subject: 'Welcome to Logosophe! 🎉',
          greeting: 'Hello {{name}},',
          welcome_message: 'Welcome to Logosophe! 🎉',
          verification_success: 'Your email address has been successfully verified, and you\'re now a confirmed subscriber. Here\'s what you can do next:',
          explore_harbor_title: 'Explore Harbor',
          explore_harbor_items: [
            'Access your personalized workspace',
            'Manage your email preferences',
            'Connect with other subscribers'
          ],
          email_preferences_title: 'Email Preferences',
          email_preferences_description: 'You can manage which types of emails you receive by going to your Harbor profile:',
          email_preferences_items: [
            'Newsletters: Regular updates and content',
            'Announcements: Important system updates',
            'Tenant Updates: Updates about your tenant activities'
          ],
          getting_started_title: 'Getting Started',
          getting_started_items: [
            'Visit https://www.logosophe.com/harbor to access your workspace',
            'Customize your email preferences in your profile',
            'Explore the platform and discover new features'
          ],
          support_message: 'If you have any questions or need assistance, feel free to reach out to our support team.',
          welcome_aboard: 'Welcome aboard!',
          signature: 'Best regards,\nThe Logosophe Team'
        }
      }
    };
  }
}

// Clear translation cache (useful for development/testing)
export function clearTranslationCache(): void {
  translationCache.clear();
}

// Get cached translation if available
export function getCachedTranslation(language: SupportedLanguageCode): any | null {
  return translationCache.get(language) || null;
}

// Check if translation is cached
export function isTranslationCached(language: SupportedLanguageCode): boolean {
  return translationCache.has(language);
}
