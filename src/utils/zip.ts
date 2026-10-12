import JSZip from 'jszip';
import { inspectZipWithWorker, extractZipFileWithWorker } from './workerClient';

export interface ZipFileInfo {
  path: string;
  name: string;
  size: number;
  date: Date;
  extension: string;
  isSupportedSheet: boolean;
}

export function isZipFile(file: File): boolean {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed' ||
    file.type === 'multipart/x-zip'
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 بايت';
  if (bytes < 1024) return `${bytes} بايت`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} ك.ب`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} م.ب`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} ج.ب`;
}

/**
 * Inspects a zip file in the background worker, falling back to local JSZip if needed.
 */
export async function inspectZipFile(file: File): Promise<ZipFileInfo[]> {
  try {
    return await inspectZipWithWorker(file);
  } catch (err) {
    console.warn('Worker ZIP inspection fallback:', err);
    return inspectZipFileLocal(file);
  }
}

export async function inspectZipFileLocal(file: File): Promise<ZipFileInfo[]> {
  const zip = await JSZip.loadAsync(file);
  const items: ZipFileInfo[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;

    // Ignore mac / hidden / system files
    const parts = relativePath.split('/');
    const fileName = parts[parts.length - 1];
    if (!fileName || fileName.startsWith('.') || relativePath.includes('__MACOSX/')) {
      return;
    }

    const extMatch = fileName.match(/\.([^.]+)$/);
    const extension = extMatch ? extMatch[1].toLowerCase() : '';
    const isSupportedSheet = ['csv', 'xlsx', 'xls'].includes(extension);

    // Uncompressed size if available, fallback to 0
    // @ts-ignore: _data may exist or default to 0
    const size = (zipEntry as any)._data?.uncompressedSize || 0;

    items.push({
      path: relativePath,
      name: fileName,
      size,
      date: zipEntry.date || new Date(),
      extension,
      isSupportedSheet,
    });
  });

  // Sort: supported sheets first, then by size descending
  return items.sort((a, b) => {
    if (a.isSupportedSheet && !b.isSupportedSheet) return -1;
    if (!a.isSupportedSheet && b.isSupportedSheet) return 1;
    return b.size - a.size;
  });
}

/**
 * Extracts a specific file from a zip archive using Web Worker, falling back to local JSZip.
 */
export async function extractFileFromZip(zipFile: File, relativePath: string): Promise<File> {
  try {
    return await extractZipFileWithWorker(zipFile, relativePath);
  } catch (err) {
    console.warn('Worker ZIP extraction fallback:', err);
    return extractFileFromZipLocal(zipFile, relativePath);
  }
}

export async function extractFileFromZipLocal(zipFile: File, relativePath: string): Promise<File> {
  const zip = await JSZip.loadAsync(zipFile);
  const entry = zip.file(relativePath);

  if (!entry) {
    throw new Error(`الملف المطلوب (${relativePath}) غير موجود داخل الأرشيف المضغوط.`);
  }

  const parts = relativePath.split('/');
  const fileName = parts[parts.length - 1] || 'extracted_sheet.csv';
  const extMatch = fileName.match(/\.([^.]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';

  let mimeType = 'application/octet-stream';
  if (ext === 'csv') mimeType = 'text/csv';
  else if (ext === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  else if (ext === 'xls') mimeType = 'application/vnd.ms-excel';

  const blob = await entry.async('blob');
  return new File([blob], fileName, { type: mimeType, lastModified: entry.date ? entry.date.getTime() : Date.now() });
}
