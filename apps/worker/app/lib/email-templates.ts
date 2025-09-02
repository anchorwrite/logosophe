import { SUPPORTED_LANGUAGES, SupportedLanguageCode, DEFAULT_LANGUAGE } from './languages';

// Email template interface
export interface EmailTemplate {
  subject: string;
  greeting: string;
  body: string;
  signature: string;
}

export interface VerificationEmailTemplate extends EmailTemplate {
  verification_link: string;
  expiration_notice: string;
  ignore_notice: string;
}

export interface WelcomeEmailTemplate extends EmailTemplate {
  welcome_message: string;
  verification_success: string;
  explore_harbor_title: string;
  explore_harbor_items: string[];
  email_preferences_title: string;
  email_preferences_description: string;
  email_preferences_items: string[];
  getting_started_title: string;
  getting_started_items: string[];
  support_message: string;
  welcome_aboard: string;
}

// Language detection from Accept-Language header
export function detectLanguageFromHeaders(acceptLanguage: string | null): SupportedLanguageCode {
  if (!acceptLanguage) {
    return DEFAULT_LANGUAGE;
  }

  // Parse Accept-Language header (e.g., "en-US,en;q=0.9,es;q=0.8,fr;q=0.7")
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, quality = '1'] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(), // Extract primary language code
        quality: parseFloat(quality)
      };
    })
    .sort((a, b) => b.quality - a.quality); // Sort by quality

  // Find the first supported language
  for (const lang of languages) {
    if (isValidLanguageCode(lang.code)) {
      return lang.code as SupportedLanguageCode;
    }
  }

  return DEFAULT_LANGUAGE;
}

// Validate language code
function isValidLanguageCode(code: string): code is SupportedLanguageCode {
  return code in SUPPORTED_LANGUAGES;
}

// Get email template for a specific language
export function getEmailTemplate<T extends 'verification' | 'welcome'>(
  templateType: T,
  language: SupportedLanguageCode,
  translations: any
): T extends 'verification' ? VerificationEmailTemplate : WelcomeEmailTemplate {
  const emailTranslations = translations.emails?.[templateType];
  
  if (!emailTranslations) {
    // Fallback to English if translations not found, but prevent infinite recursion
    if (language === 'en') {
      // If we're already trying English and it's not found, return a minimal fallback
      console.warn(`Email template for ${templateType} not found in English translations`);
      return getFallbackTemplate(templateType);
    }
    
    // Try to load English translations separately
    try {
      const englishTranslations = require(`../locales/en/translation.json`);
      const englishEmailTranslations = englishTranslations.emails?.[templateType];
      
      if (englishEmailTranslations) {
        return buildTemplate(templateType, englishEmailTranslations);
      }
    } catch (error) {
      console.error('Failed to load English fallback translations:', error);
    }
    
    // Final fallback to hardcoded template
    return getFallbackTemplate(templateType);
  }

  return buildTemplate(templateType, emailTranslations);
}

// Helper function to build the template object
function buildTemplate<T extends 'verification' | 'welcome'>(
  templateType: T,
  emailTranslations: any
): T extends 'verification' ? VerificationEmailTemplate : WelcomeEmailTemplate {
  if (templateType === 'verification') {
    return {
      subject: emailTranslations.subject,
      greeting: emailTranslations.greeting,
      body: emailTranslations.body,
      verification_link: emailTranslations.verification_link,
      expiration_notice: emailTranslations.expiration_notice,
      ignore_notice: emailTranslations.ignore_notice,
      signature: emailTranslations.signature
    } as any;
  } else {
    return {
      subject: emailTranslations.subject,
      greeting: emailTranslations.greeting,
      body: emailTranslations.body,
      signature: emailTranslations.signature,
      welcome_message: emailTranslations.welcome_message,
      verification_success: emailTranslations.verification_success,
      explore_harbor_title: emailTranslations.explore_harbor_title,
      explore_harbor_items: emailTranslations.explore_harbor_items,
      email_preferences_title: emailTranslations.email_preferences_title,
      email_preferences_description: emailTranslations.email_preferences_description,
      email_preferences_items: emailTranslations.email_preferences_items,
      getting_started_title: emailTranslations.getting_started_title,
      getting_started_items: emailTranslations.getting_started_items,
      support_message: emailTranslations.support_message,
      welcome_aboard: emailTranslations.welcome_aboard
    } as any;
  }
}

// Fallback template function
function getFallbackTemplate<T extends 'verification' | 'welcome'>(
  templateType: T
): T extends 'verification' ? VerificationEmailTemplate : WelcomeEmailTemplate {
  if (templateType === 'verification') {
    return {
      subject: 'Verify Your Email Address - Logosophe',
      greeting: 'Hello {{name}},',
      body: 'Thank you for subscribing to Logosophe! To complete your subscription, please verify your email address by clicking the link below:',
      verification_link: '{{verificationUrl}}',
      expiration_notice: 'This link will expire in 24 hours for security reasons.',
      ignore_notice: 'If you didn\'t request this subscription, you can safely ignore this email.',
      signature: 'Best regards,\nThe Logosophe Team'
    } as any;
  } else {
    return {
      subject: 'Welcome to Logosophe! 🎉',
      greeting: 'Hello {{name}},',
      body: 'Welcome to Logosophe!',
      signature: 'Best regards,\nThe Logosophe Team',
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
      welcome_aboard: 'Welcome aboard!'
    } as any;
  }
}

// Render verification email content
export function renderVerificationEmail(
  template: VerificationEmailTemplate,
  name: string,
  verificationUrl: string
): { subject: string; html: string; text: string } {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p>${template.greeting.replace('{{name}}', name)}</p>
      <p>${template.body}</p>
      <p><a href="${verificationUrl}" style="color: #007bff; text-decoration: none;">${verificationUrl}</a></p>
      <p>${template.expiration_notice}</p>
      <p>${template.ignore_notice}</p>
      <p>${template.signature.replace(/\n/g, '<br>')}</p>
    </div>
  `;

  const text = `
${template.greeting.replace('{{name}}', name)}

${template.body}

${verificationUrl}

${template.expiration_notice}

${template.ignore_notice}

${template.signature}
  `.trim();

  return {
    subject: template.subject,
    html,
    text
  };
}

// Render welcome email content
export function renderWelcomeEmail(
  template: WelcomeEmailTemplate,
  name: string
): { subject: string; html: string; text: string } {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p>${template.greeting.replace('{{name}}', name)}</p>
      <p><strong>${template.welcome_message}</strong></p>
      <p>${template.verification_success}</p>
      
      <h3>${template.explore_harbor_title}</h3>
      <ul>
        ${template.explore_harbor_items.map(item => `<li>${item}</li>`).join('')}
      </ul>
      
      <h3>${template.email_preferences_title}</h3>
      <p>${template.email_preferences_description}</p>
      <ul>
        ${template.email_preferences_items.map(item => `<li>${item}</li>`).join('')}
      </ul>
      
      <h3>${template.getting_started_title}</h3>
      <ul>
        ${template.getting_started_items.map(item => `<li>${item}</li>`).join('')}
      </ul>
      
      <p>${template.support_message}</p>
      <p><strong>${template.welcome_aboard}</strong></p>
      <p>${template.signature.replace(/\n/g, '<br>')}</p>
    </div>
  `;

  const text = `
${template.greeting.replace('{{name}}', name)}

${template.welcome_message}

${template.verification_success}

${template.explore_harbor_title}:
${template.explore_harbor_items.map(item => `- ${item}`).join('\n')}

${template.email_preferences_title}
${template.email_preferences_description}
${template.email_preferences_items.map(item => `- ${item}`).join('\n')}

${template.getting_started_title}:
${template.getting_started_items.map(item => `- ${item}`).join('\n')}

${template.support_message}

${template.welcome_aboard}

${template.signature}
  `.trim();

  return {
    subject: template.subject,
    html,
    text
  };
}
