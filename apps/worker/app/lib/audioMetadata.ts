export interface AudioMetadata {
    duration?: number;
    sampleRate?: number;
    channels?: number;
  }
  
  export async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
    return {
      duration: undefined,
      sampleRate: undefined,
      channels: undefined
    };
  }