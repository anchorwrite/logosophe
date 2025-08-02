'use client';

import { useEffect, useState } from 'react';
import { Box, Text } from '@radix-ui/themes';
import { useParams } from 'next/navigation';

export const runtime = 'edge';

interface MediaFile {
  Id: string;
  FileName: string;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
}

interface ApiResponse {
  Id: string;
  FileName: string;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
}

export default function MediaPlayer() {
  const params = useParams();
  const [media, setMedia] = useState<MediaFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        // In Next.js 15, params.id is a string
        const mediaId = params.id as string;
        if (!mediaId) {
          throw new Error('No media ID provided');
        }
        const response = await fetch(`/api/media/${mediaId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch media details');
        }
        const data = await response.json() as ApiResponse;
        
        // Type check the response data
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid media data received');
        }

        const mediaData: MediaFile = {
          Id: data.Id,
          FileName: data.FileName,
          ContentType: data.ContentType,
          MediaType: data.MediaType,
        };

        setMedia(mediaData);
      } catch (err) {
        console.error('Error fetching media:', err);
        setError('Failed to load media');
      }
    };

    fetchMedia();
  }, [params.id]);

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  if (!media) {
    return <Text>Loading...</Text>;
  }

  if (media.MediaType !== 'video') {
    return <Text>This media type is not supported for playback</Text>;
  }

  return (
    <Box className="w-full h-screen flex items-center justify-center bg-gray-100">
      <Box className="w-full max-w-4xl aspect-video bg-black">
        <video
          controls
          playsInline
          webkit-playsinline="true"
          className="w-full h-full"
          src={`/api/media/${media.Id}/preview`}
          title={media.FileName}
          onError={(e) => {
            const video = e.target as HTMLVideoElement;
            setError(`Video playback error: ${video.error?.message || 'Unknown error'}`);
          }}
        >
          Your browser does not support the video tag.
        </video>
      </Box>
    </Box>
  );
} 