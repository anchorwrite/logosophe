/**
 * Standardized metadata structures for media operations logging
 * This ensures consistent analytics data across all media endpoints
 */

export interface BaseMediaMetadata {
  /** The action being performed */
  action: string;
  /** Media file ID */
  mediaId: string;
  /** Timestamp of the operation */
  timestamp: string;
  /** User's role in the operation */
  userRole?: 'admin' | 'tenant' | 'author' | 'agent' | 'publisher' | 'subscriber' | 'user';
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
}

export interface MediaUploadMetadata extends BaseMediaMetadata {
  action: 'upload';
  /** File information */
  fileName: string;
  fileSize: number;
  contentType: string;
  mediaType: 'audio' | 'video' | 'image' | 'document';
  /** Upload context */
  selectedTenants: string[];
  isAdmin: boolean;
  /** R2 storage information */
  r2Key: string;
  /** Language setting */
  language?: string;
}

export interface MediaAccessMetadata extends BaseMediaMetadata {
  action: 'view' | 'download' | 'view_access_settings' | 'update_access_settings';
  /** Access context */
  contentType?: string;
  fileSize?: number;
  mediaType?: 'audio' | 'video' | 'image' | 'document';
  /** Request context */
  isRangeRequest?: boolean;
  isDownload?: boolean;
  /** Share token context */
  shareToken?: string;
  /** Tenant access information */
  currentTenants?: string[];
  newTenants?: string[];
  previousTenants?: string[];
  /** Language setting */
  language?: string;
}

export interface MediaShareMetadata extends BaseMediaMetadata {
  action: 'create_share_link';
  /** Share link information */
  shareToken: string;
  expiresAt?: string;
  maxAccesses?: number;
  hasPassword: boolean;
  shareUrl: string;
  /** Access context */
  tenantId?: string;
}

export interface MediaPublishMetadata extends BaseMediaMetadata {
  action: 'publish' | 'unpublish';
  /** Publishing context */
  publishedContentId?: string;
  publishingSettings?: {
    watermark?: boolean;
    disableCopy?: boolean;
    disableDownload?: boolean;
    addWatermark?: boolean;
  };
  /** Tenant context */
  addedToContentTenant?: boolean;
  removedFromContentTenant?: boolean;
  /** Language setting */
  language?: string;
}

export interface MediaProtectionMetadata extends BaseMediaMetadata {
  action: 'update_protection_settings';
  /** Protection settings */
  publishingSettings: {
    watermark?: boolean;
    disableCopy?: boolean;
    disableDownload?: boolean;
    addWatermark?: boolean;
  };
  /** Publishing context */
  publishedContentId: string;
  /** Language setting */
  language?: string;
}

export interface MediaDeleteMetadata extends BaseMediaMetadata {
  action: 'soft_delete' | 'remove_tenant';
  /** Deletion context */
  fileName: string;
  r2Key?: string;
  canBeRestored?: boolean;
  harborDelete?: boolean;
  lastTenant?: boolean;
  otherTenants?: string[];
  /** Language setting */
  language?: string;
}

export interface MediaRestoreMetadata extends BaseMediaMetadata {
  action: 'restore';
  /** Restoration context */
  fileName: string;
  r2Key: string;
  restoredFromDeletedAt?: string;
  restoredBy: string;
  /** Language setting */
  language?: string;
}

export interface MediaPermanentDeleteMetadata extends BaseMediaMetadata {
  action: 'permanent_delete';
  /** Permanent deletion context */
  fileName: string;
  r2Key: string;
  wasSoftDeleted: boolean;
  softDeletedAt?: string;
  /** Language setting */
  language?: string;
}

export interface MediaLinkMetadata extends BaseMediaMetadata {
  action: 'link' | 'unlink';
  /** Link context */
  linkType: 'tenant' | 'share' | 'content';
  targetTenantId?: string;
  linkDescription?: string;
}

export type MediaMetadata = 
  | MediaUploadMetadata
  | MediaAccessMetadata
  | MediaShareMetadata
  | MediaPublishMetadata
  | MediaProtectionMetadata
  | MediaDeleteMetadata
  | MediaRestoreMetadata
  | MediaPermanentDeleteMetadata
  | MediaLinkMetadata;

/**
 * Helper function to create standardized metadata for media operations
 */
export function createMediaMetadata<T extends BaseMediaMetadata>(
  baseData: Omit<T, 'action' | 'mediaId' | 'timestamp' | 'success'>,
  action: T['action'],
  mediaId: string,
  success: boolean = true,
  error?: string
): T {
  return {
    ...baseData,
    action,
    mediaId,
    timestamp: new Date().toISOString(),
    success,
    ...(error && { error })
  } as T;
}

/**
 * Helper function to extract common media file properties for metadata
 */
export function extractMediaFileProperties(mediaFile: {
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
  R2Key?: string;
  Language?: string;
}) {
  return {
    fileName: mediaFile.FileName,
    fileSize: mediaFile.FileSize,
    contentType: mediaFile.ContentType,
    mediaType: mediaFile.MediaType,
    r2Key: mediaFile.R2Key,
    language: mediaFile.Language
  };
}
