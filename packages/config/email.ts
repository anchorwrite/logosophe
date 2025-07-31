export const emailConfig = {
  // Email configuration settings
  provider: 'resend',
  from: 'noreply@logosophe.com',
  templates: {
    welcome: 'welcome-template',
    resetPassword: 'reset-password-template',
    notification: 'notification-template'
  }
} 