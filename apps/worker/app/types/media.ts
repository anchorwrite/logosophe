export type FileType = 'audio' | 'video' | 'image' | 'document' | 'other';
export type AccessLevel = 'public' | 'group' | 'user';
export type AccessType = 'view' | 'download';

export interface MediaCatalog {
    Id: number;
    FileName: string;
    R2Key: string;
    UploadDate: string;  // ISO 8601 format
    UploadedBy: string;
    Description: string | null;
    Owner: string;
    FileType: FileType;
    FileExtension: string;
    AccessLevel: AccessLevel;
    AccessValue: string | null;
    FileSize: number;
    ContentType: string;
    CreatedAt: string;  // ISO 8601 format
    UpdatedAt: string;  // ISO 8601 format
    IsActive: boolean;
}

export interface MediaAccessGroup {
    Id: number;
    GroupName: string;
    Description: string | null;
    CreatedBy: string;
    CreatedAt: string;  // ISO 8601 format
    IsActive: boolean;
}

export interface MediaAccessGroupMember {
    GroupId: number;
    UserEmail: string;
    AddedBy: string;
    AddedAt: string;  // ISO 8601 format
}

// Type for creating a new media catalog entry
export interface CreateMediaCatalogInput {
    FileName: string;
    R2Key: string;
    UploadedBy: string;
    Description?: string;
    Owner: string;
    FileType: FileType;
    FileExtension: string;
    AccessLevel: AccessLevel;
    AccessValue?: string;
    FileSize: number;
    ContentType: string;
}

// Type for updating a media catalog entry
export interface UpdateMediaCatalogInput {
    Description?: string;
    Owner?: string;
    AccessLevel?: AccessLevel;
    AccessValue?: string;
    IsActive?: boolean;
}

// Type for creating a new access group
export interface CreateMediaAccessGroupInput {
    GroupName: string;
    Description?: string;
    CreatedBy: string;
}

// Type for adding a member to an access group
export interface AddGroupMemberInput {
    GroupId: number;
    UserEmail: string;
    AddedBy: string;
}

// Type for media catalog query filters
export interface MediaCatalogFilters {
    FileType?: FileType;
    AccessLevel?: AccessLevel;
    AccessValue?: string;
    UploadedBy?: string;
    Owner?: string;
    IsActive?: boolean;
    SearchTerm?: string;
}

// Type for media catalog query options
export interface MediaCatalogQueryOptions {
    filters?: MediaCatalogFilters;
    sortBy?: keyof MediaCatalog;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}

// Type for media access statistics
export interface MediaAccessStats {
    totalViews: number;
    totalDownloads: number;
    uniqueViewers: number;
    uniqueDownloaders: number;
    lastAccessDate: string | null;
}

// Type for media catalog entry with access stats
export interface MediaCatalogWithStats extends MediaCatalog {
    stats: MediaAccessStats;
}

// Type for access group with member count
export interface MediaAccessGroupWithMemberCount extends MediaAccessGroup {
    memberCount: number;
} 