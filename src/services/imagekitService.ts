import { ImageKitFolderType, ImageKitMediaMetadata, UserRole } from '../types';
import { auth } from '../lib/firebase';
import { getStoredSuperAdminToken } from './clinicService';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'image/gif'
];

export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface ImageKitConfig {
  isConfigured: boolean;
  publicKey: string;
  urlEndpoint: string;
  allowedMimeTypes: string[];
  maxFileSizeBytes: number;
}

export interface ImageKitAuthResponse {
  token: string;
  expire: number;
  signature: string;
  publicKey?: string;
  urlEndpoint?: string;
  folder?: string;
  isConfigured?: boolean;
}

export interface ImageKitUploadResult extends ImageKitMediaMetadata {
  isConfigured?: boolean;
  notice?: string;
}

/**
 * Validates file format and size before uploading to ImageKit
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No image file selected.' };
  }

  const fileType = file.type?.toLowerCase() || '';
  const isAllowed = ALLOWED_IMAGE_MIME_TYPES.includes(fileType) ||
    /\.(png|jpe?g|webp|svg|gif)$/i.test(file.name);

  if (!isAllowed) {
    return {
      valid: false,
      error: 'Invalid file format. Please upload a PNG, JPG, JPEG, WEBP, SVG, or GIF image.'
    };
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeMB}MB). Maximum permitted size is 5MB.`
    };
  }

  return { valid: true };
}

/**
 * Helper to convert a File to Base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Builds authorization headers for ImageKit server endpoints
 */
async function buildAuthHeaders(customRole?: UserRole, customClinicId?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // 1. Super Admin Session Token check
  const superAdminToken = getStoredSuperAdminToken();
  if (superAdminToken) {
    headers['Authorization'] = `Bearer ${superAdminToken}`;
    headers['x-user-role'] = 'SUPER_ADMIN';
    return headers;
  }

  // 2. Firebase Auth Current User context
  const currentUser = auth.currentUser;
  if (currentUser) {
    headers['x-user-uid'] = currentUser.uid;
    if (currentUser.email) {
      headers['x-user-email'] = currentUser.email;
    }
  }

  if (customRole) {
    headers['x-user-role'] = customRole;
  }

  if (customClinicId) {
    headers['x-user-clinic-id'] = customClinicId;
  }

  return headers;
}

/**
 * Fetch ImageKit server configuration status (Public parameters only)
 * Never returns private key
 */
export async function getImageKitConfig(): Promise<ImageKitConfig> {
  try {
    const res = await fetch('/api/imagekit/config');
    if (!res.ok) {
      throw new Error(`Failed to fetch ImageKit configuration: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('ImageKit config fetch error:', err);
    return {
      isConfigured: false,
      publicKey: '',
      urlEndpoint: '',
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
      maxFileSizeBytes: MAX_IMAGE_FILE_SIZE_BYTES
    };
  }
}

/**
 * Generate client-side authentication parameters from secure backend
 */
export async function getImageKitAuthParams(
  clinicId: string,
  folderType: ImageKitFolderType = 'media',
  userRole?: UserRole
): Promise<ImageKitAuthResponse> {
  const headers = await buildAuthHeaders(userRole, clinicId);
  const query = new URLSearchParams({
    clinicId,
    folderType
  });

  const res = await fetch(`/api/imagekit/auth?${query.toString()}`, {
    method: 'GET',
    headers
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `ImageKit auth failed with status ${res.status}`);
  }

  return await res.json();
}

/**
 * Upload file to ImageKit via secure server-side proxy
 * Enforces folder structure: /clinics/{clinicId}/{folderType}/
 */
export async function uploadMediaToImageKit(options: {
  file: File | string;
  clinicId: string;
  folderType: ImageKitFolderType;
  fileName?: string;
  userRole?: UserRole;
  customMetadata?: Record<string, any>;
  onProgress?: (percent: number) => void;
}): Promise<ImageKitUploadResult> {
  const { file, clinicId, folderType, fileName, userRole, customMetadata, onProgress } = options;

  if (!clinicId || !clinicId.trim()) {
    throw new Error('Clinic ID is required for media upload.');
  }

  let base64Data: string;
  let computedFileName = fileName;

  if (file instanceof File) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid file.');
    }
    if (onProgress) onProgress(15);
    base64Data = await fileToBase64(file);
    if (!computedFileName) {
      computedFileName = file.name;
    }
    if (onProgress) onProgress(40);
  } else {
    base64Data = file;
    if (!computedFileName) {
      computedFileName = `${folderType}_${Date.now()}.png`;
    }
    if (onProgress) onProgress(30);
  }

  const headers = await buildAuthHeaders(userRole, clinicId);

  if (onProgress) onProgress(60);

  const res = await fetch('/api/imagekit/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      file: base64Data,
      fileName: computedFileName,
      clinicId: clinicId.trim(),
      folderType,
      customMetadata
    })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status code ${res.status}`);
  }

  const result = await res.json();
  if (onProgress) onProgress(100);

  const expectedFolder = `/clinics/${clinicId.trim()}/${folderType}/`;
  const cleanMetadata: ImageKitUploadResult = {
    fileId: result.fileId || `ik_${Date.now()}`,
    url: result.url || '',
    name: result.name || computedFileName || 'file',
    fileName: result.name || computedFileName || 'file',
    folder: result.folder || expectedFolder,
    uploadedAt: result.uploadedAt || new Date().toISOString(),
    isConfigured: Boolean(result.isConfigured)
  };

  if (typeof result.size === 'number') {
    cleanMetadata.size = result.size;
  }
  if (result.thumbnailUrl) {
    cleanMetadata.thumbnailUrl = result.thumbnailUrl;
  }
  if (result.notice) {
    cleanMetadata.notice = result.notice;
  }

  return cleanMetadata;
}

/**
 * Securely deletes a media file from ImageKit via backend
 */
export async function deleteMediaFromImageKit(options: {
  fileId: string;
  clinicId: string;
  folderType?: ImageKitFolderType;
  userRole?: UserRole;
}): Promise<boolean> {
  const { fileId, clinicId, folderType = 'media', userRole } = options;

  if (!fileId || !fileId.trim()) return true;

  try {
    const headers = await buildAuthHeaders(userRole, clinicId);
    const res = await fetch('/api/imagekit/delete', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileId: fileId.trim(),
        clinicId: clinicId.trim(),
        folderType
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.warn('ImageKit delete response warning:', errorData.error || res.statusText);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('ImageKit delete exception:', err);
    return false;
  }
}
