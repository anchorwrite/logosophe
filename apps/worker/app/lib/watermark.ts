/**
 * Basic watermarking utilities for images and PDFs
 */

export interface WatermarkOptions {
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity: number;
  fontSize: number;
  color: string;
}

export const defaultWatermarkOptions: WatermarkOptions = {
  text: 'Logosophe',
  position: 'bottom-right',
  opacity: 0.3,
  fontSize: 16,
  color: '#000000'
};

/**
 * Add watermark to an image using Canvas API
 */
export async function addImageWatermark(
  imageUrl: string, 
  options: WatermarkOptions = defaultWatermarkOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the original image
      ctx.drawImage(img, 0, 0);
      
      // Configure text style
      ctx.font = `${options.fontSize}px Arial`;
      ctx.fillStyle = options.color;
      ctx.globalAlpha = options.opacity;
      
      // Calculate text position based on option
      const textMetrics = ctx.measureText(options.text);
      const textWidth = textMetrics.width;
      const textHeight = options.fontSize;
      
      let x: number, y: number;
      
      switch (options.position) {
        case 'top-left':
          x = 10;
          y = textHeight + 10;
          break;
        case 'top-right':
          x = canvas.width - textWidth - 10;
          y = textHeight + 10;
          break;
        case 'bottom-left':
          x = 10;
          y = canvas.height - 10;
          break;
        case 'bottom-right':
          x = canvas.width - textWidth - 10;
          y = canvas.height - 10;
          break;
        case 'center':
          x = (canvas.width - textWidth) // 2;
          y = (canvas.height + textHeight) // 2;
          break;
        default:
          x = canvas.width - textWidth - 10;
          y = canvas.height - 10;
      }
      
      // Draw the watermark text
      ctx.fillText(options.text, x, y);
      
      // Convert to data URL
      const watermarkedImageUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(watermarkedImageUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Check if a file type supports watermarking
 */
export function supportsWatermarking(mediaType: string, contentType: string): boolean {
  return mediaType === 'image' || contentType === 'application/pdf';
}

/**
 * Generate watermark text based on user and timestamp
 */
export function generateWatermarkText(userEmail: string, timestamp: string): string {
  const date = new Date(timestamp).toLocaleDateString();
  return `Logosophe - ${userEmail} - ${date}`;
} 