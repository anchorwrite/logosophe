export interface AudioFile {
    Id: number;
    FileName: string;
    FileSize: number;
    ContentType: string;
    R2Key: string;
    UploadDate: string;
    UploadedBy: string;
    Description: string | null;
    Duration: number | null;
    SampleRate: number | null;
    Channels: number | null;
  }