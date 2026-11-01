// Pintu modul `files` (berkas terlindungi, spec L2f-1 §3.4). Modul lain dan app/ hanya mengimpor dari sini.
export { ALLOWED_MIME, MAX_UPLOAD_BYTES, detectImageMime, isFileId } from './rules/detect';
export { filesUploadedBy, readStoredFile, saveUpload } from './server/files';
