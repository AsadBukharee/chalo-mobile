import { Platform } from 'react-native';

/**
 * Direct-to-Cloudinary image upload.
 *
 * The image goes straight from the device to Cloudinary — no backend hop — via
 * an *unsigned* upload preset. That is the whole reason no API secret appears
 * anywhere in this file: unsigned uploads are authorised by the preset itself,
 * and the preset's own settings (allowed formats, folder, moderation) are what
 * limit what can be pushed into the account. Never put an API secret in the
 * app; anything shipped in a bundle is public.
 *
 * Configuration lives here and nowhere else, read from Expo's public env vars:
 *
 *   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET
 *
 * `EXPO_PUBLIC_*` values are inlined at bundle time, so a change needs a Metro
 * restart with a cleared cache (`npx expo start -c`).
 */

export const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
export const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

/** False when the env vars are missing, so the UI can say so instead of 400ing. */
export const CLOUDINARY_CONFIGURED =
  CLOUDINARY_CLOUD_NAME.length > 0 && CLOUDINARY_UPLOAD_PRESET.length > 0;

export function cloudinaryUploadUrl(resourceType: 'image' | 'video' | 'raw' = 'image') {
  return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
}

/** The fields of Cloudinary's response this app actually cares about. */
export type CloudinaryAsset = {
  secureUrl: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
};

export type UploadProgress = {
  loaded: number;
  total: number;
  /** 0..1, or null while the total length is still unknown. */
  fraction: number | null;
};

export type UploadImageOptions = {
  /** Filename sent to Cloudinary. Defaults to the last path segment of the URI. */
  fileName?: string;
  /** Overrides the type guessed from the file extension. */
  mimeType?: string;
  /** Cloudinary folder, if the preset allows callers to set one. */
  folder?: string;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

/** Carries Cloudinary's own message and HTTP status so callers can show both. */
export class CloudinaryUploadError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CloudinaryUploadError';
    this.status = status;
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
};

function guessFromUri(uri: string) {
  // Strip the query and fragment first — an Android content:// URI happily
  // carries both, and "photo.jpg?width=800" is not an extension.
  const path = uri.split(/[?#]/)[0] ?? uri;
  const segment = path.split('/').pop() || 'upload';
  const extension = segment.includes('.') ? segment.split('.').pop()!.toLowerCase() : '';
  const mimeType = MIME_BY_EXTENSION[extension] ?? 'image/jpeg';
  const fileName = segment.includes('.') ? segment : `${segment}.jpg`;
  return { fileName, mimeType };
}

function readError(status: number, body: string): CloudinaryUploadError {
  // Cloudinary answers failures with { "error": { "message": "..." } }.
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    const message = parsed?.error?.message;
    if (message) return new CloudinaryUploadError(message, status);
  } catch {
    // Not JSON — fall through to the generic message below.
  }
  if (status === 400) {
    return new CloudinaryUploadError(
      'Cloudinary rejected the upload (400). Check that the preset is unsigned and the file type is allowed.',
      status,
    );
  }
  if (status === 401 || status === 403) {
    return new CloudinaryUploadError(
      `Cloudinary refused the request (${status}). The upload preset is probably signed rather than unsigned.`,
      status,
    );
  }
  return new CloudinaryUploadError(`Upload failed (HTTP ${status}).`, status);
}

/**
 * Builds the multipart body.
 *
 * Native React Native accepts a `{ uri, name, type }` object as a form part and
 * streams the file itself. The browser has no such shortcut — an ImagePicker
 * result there is a blob:/data: URL — so the web path reads the blob first.
 */
async function buildForm(uri: string, options: UploadImageOptions) {
  const guessed = guessFromUri(uri);
  const fileName = options.fileName ?? guessed.fileName;
  const mimeType = options.mimeType ?? guessed.mimeType;

  const form = new FormData();

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    // The browser's FormData takes a third filename argument; React Native's
    // type declaration only knows about two, hence the narrow cast.
    (form as unknown as { append: (name: string, value: Blob, fileName?: string) => void }).append(
      'file',
      blob,
      fileName,
    );
  } else {
    form.append('file', { uri, name: fileName, type: mimeType } as unknown as Blob);
  }

  form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  if (options.folder) form.append('folder', options.folder);

  return form;
}

/**
 * Uploads one local image and resolves with the stored asset.
 *
 * XMLHttpRequest rather than fetch: fetch has no upload-progress event on any
 * platform, and a progress bar is the difference between "is this working?" and
 * a visibly moving upload on a slow connection.
 */
export function uploadImageToCloudinary(
  uri: string,
  options: UploadImageOptions = {},
): Promise<CloudinaryAsset> {
  if (!CLOUDINARY_CONFIGURED) {
    return Promise.reject(
      new CloudinaryUploadError(
        'Cloudinary is not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env, then restart Metro with `npx expo start -c`.',
      ),
    );
  }

  return buildForm(uri, options).then(
    (form) =>
      new Promise<CloudinaryAsset>((resolve, reject) => {
        const request = new XMLHttpRequest();

        const abort = () => request.abort();
        options.signal?.addEventListener?.('abort', abort);
        const cleanup = () => options.signal?.removeEventListener?.('abort', abort);

        request.open('POST', cloudinaryUploadUrl('image'));

        request.upload.onprogress = (event) => {
          options.onProgress?.({
            loaded: event.loaded,
            total: event.total,
            fraction: event.lengthComputable && event.total > 0 ? event.loaded / event.total : null,
          });
        };

        request.onload = () => {
          cleanup();
          if (request.status < 200 || request.status >= 300) {
            reject(readError(request.status, request.responseText));
            return;
          }
          try {
            const body = JSON.parse(request.responseText);
            resolve({
              secureUrl: body.secure_url,
              publicId: body.public_id,
              format: body.format ?? '',
              width: body.width ?? 0,
              height: body.height ?? 0,
              bytes: body.bytes ?? 0,
              createdAt: body.created_at ?? '',
            });
          } catch {
            reject(new CloudinaryUploadError('Cloudinary returned a response we could not read.'));
          }
        };

        request.onerror = () => {
          cleanup();
          reject(
            new CloudinaryUploadError('Could not reach Cloudinary. Check your internet connection.'),
          );
        };

        request.ontimeout = () => {
          cleanup();
          reject(new CloudinaryUploadError('The upload timed out. Try again on a better connection.'));
        };

        request.onabort = () => {
          cleanup();
          reject(new CloudinaryUploadError('Upload cancelled.'));
        };

        request.send(form);
      }),
  );
}
