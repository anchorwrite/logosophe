const isDev = process.env.NODE_ENV === 'development';
const devUrl = 'https:/local-dev.logosophe.com/';

export const config = {
  r2: {
    publicUrl: isDev ? devUrl : 'https:/video.logosophe.com',
    audioUrl: isDev ? devUrl : 'https:/audio.logosophe.com',
    videoUrl: isDev ? devUrl : 'https:/video.logosophe.com',
  },
} as const; 