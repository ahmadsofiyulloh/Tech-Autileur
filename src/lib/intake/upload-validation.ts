import sharp from "sharp";

const SUPPORTED_UPLOAD_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/x-jpeg",
  "image/x-jpg",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);

const SUPPORTED_IMAGE_EXTENSION_TO_MIME: Array<[string, string]> = [
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
  [".avif", "image/avif"],
];

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function hasSupportedImageExtension(fileName: string) {
  const normalized = readText(fileName).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSION_TO_MIME.some(([extension]) => normalized.endsWith(extension));
}

function getSupportedImageMimeTypeFromName(fileName: string) {
  const normalized = readText(fileName).toLowerCase();
  const match = SUPPORTED_IMAGE_EXTENSION_TO_MIME.find(([extension]) => normalized.endsWith(extension));
  return match ? match[1] : null;
}

export function getSupportedUploadImageMimeType(file: File) {
  const mimeType = readText(file.type).toLowerCase();

  if (mimeType && SUPPORTED_UPLOAD_IMAGE_MIME_TYPES.has(mimeType)) {
    return mimeType;
  }

  return getSupportedImageMimeTypeFromName(file.name);
}

export function getGeminiCompatibleUploadImageMimeType(file: File) {
  const uploadMimeType = getSupportedUploadImageMimeType(file);

  if (!uploadMimeType) {
    return null;
  }

  if (uploadMimeType === "image/jpg" || uploadMimeType === "image/pjpeg" || uploadMimeType === "image/x-jpeg" || uploadMimeType === "image/x-jpg") {
    return "image/jpeg";
  }

  if (uploadMimeType === "image/avif") {
    return "image/webp";
  }

  return uploadMimeType;
}

export async function prepareGeminiCompatibleUploadImage(file: File, label = "Image") {
  const uploadMimeType = getSupportedUploadImageMimeType(file);

  if (!uploadMimeType) {
    return null;
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (uploadMimeType === "image/avif") {
    try {
      const convertedBuffer = await sharp(buffer, { failOn: "none" }).webp().toBuffer();

      return {
        mimeType: "image/webp",
        buffer: convertedBuffer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${label} AVIF image could not be prepared for Gemini: ${message}`);
    }
  }

  return {
    mimeType: getGeminiCompatibleUploadImageMimeType(file) ?? uploadMimeType,
    buffer,
  };
}

export function isSupportedUploadImage(file: File) {
  return Boolean(getSupportedUploadImageMimeType(file));
}

export function assertUploadedImage(file: File, label: string) {
  if (!(file instanceof File)) {
    throw new Error(`${label} is required.`);
  }

  if (!file.size) {
    throw new Error(`${label} cannot be empty.`);
  }

  const mimeType = getSupportedUploadImageMimeType(file);

  if (mimeType) {
    return;
  }

  throw new Error(`${label} must be JPG, JPEG, PNG, WEBP, HEIC, HEIF, or AVIF.`);
}
