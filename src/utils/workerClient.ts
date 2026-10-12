import { SheetRow } from '../types';
import { ZipFileInfo } from './zip';

let workerIdCounter = 0;

/**
 * Creates a dedicated Web Worker instance for isolated background parsing.
 */
function createWorker(): Worker {
  return new Worker(new URL('../workers/fileProcessor.worker.ts', import.meta.url), {
    type: 'module',
  });
}

/**
 * Processes a file (ZIP, CSV, or XLSX) completely inside a background Web Worker,
 * keeping the Main UI Thread 100% fluid and responsive at 60/120 FPS.
 */
export async function processFileWithWorker(
  file: File,
  targetType?: 'machines' | 'payments' | 'cash',
  onProgress?: (percent: number, stepText: string) => void
): Promise<SheetRow[]> {
  const worker = createWorker();
  const id = `req_${++workerIdCounter}_${Date.now()}`;

  onProgress?.(2, 'بدء تشغيل مسار المعالجة الخلفي المعزول (Web Worker)...');

  try {
    const fileBuffer = await file.arrayBuffer();

    return await new Promise<SheetRow[]>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        const { type, id: msgId, percent, stepText, rows, error } = e.data;
        if (msgId !== id) return;

        if (type === 'PROGRESS') {
          onProgress?.(percent, stepText);
        } else if (type === 'DONE') {
          worker.terminate();
          resolve(rows || []);
        } else if (type === 'ERROR') {
          worker.terminate();
          reject(new Error(error || 'فشلت معالجة الملف في مسار الخلفية.'));
        }
      };

      worker.onerror = (err) => {
        console.error('Worker runtime error:', err);
        worker.terminate();
        reject(new Error(err.message || 'حدث خطأ في تشغيل مسار المعالجة الخلفي.'));
      };

      worker.postMessage(
        {
          type: 'PARSE_FILE',
          id,
          payload: {
            fileBuffer,
            fileName: file.name,
            targetType,
          },
        },
        [fileBuffer] // Transferable ArrayBuffer for zero-copy memory transfer!
      );
    });
  } catch (err) {
    worker.terminate();
    throw err;
  }
}

/**
 * Inspects a ZIP archive in the background Web Worker to list its sheets without UI delay.
 */
export async function inspectZipWithWorker(file: File): Promise<ZipFileInfo[]> {
  const worker = createWorker();
  const id = `zip_inspect_${++workerIdCounter}`;

  try {
    const fileBuffer = await file.arrayBuffer();

    return await new Promise<ZipFileInfo[]>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        const { type, id: msgId, items, error } = e.data;
        if (msgId !== id) return;

        if (type === 'ZIP_INSPECTED') {
          worker.terminate();
          resolve(
            (items || []).map((item: any) => ({
              ...item,
              date: new Date(item.date),
            }))
          );
        } else if (type === 'ERROR') {
          worker.terminate();
          reject(new Error(error || 'تعذر فحص أرشيف ZIP في مسار الخلفية.'));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      worker.postMessage(
        {
          type: 'INSPECT_ZIP',
          id,
          payload: { fileBuffer },
        },
        [fileBuffer]
      );
    });
  } catch (err) {
    worker.terminate();
    throw err;
  }
}

/**
 * Extracts a specific file from a ZIP archive in the background Web Worker.
 */
export async function extractZipFileWithWorker(file: File, relativePath: string): Promise<File> {
  const worker = createWorker();
  const id = `zip_extract_${++workerIdCounter}`;

  try {
    const fileBuffer = await file.arrayBuffer();

    return await new Promise<File>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        const { type, id: msgId, buffer, fileName, error } = e.data;
        if (msgId !== id) return;

        if (type === 'ZIP_EXTRACTED') {
          worker.terminate();
          const ext = fileName.split('.').pop()?.toLowerCase();
          let mime = 'application/octet-stream';
          if (ext === 'csv') mime = 'text/csv';
          else if (ext === 'xlsx') mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

          const extractedBlob = new Blob([buffer], { type: mime });
          resolve(new File([extractedBlob], fileName, { type: mime }));
        } else if (type === 'ERROR') {
          worker.terminate();
          reject(new Error(error || 'تعذر استخراج الملف من الأرشيف.'));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      worker.postMessage(
        {
          type: 'EXTRACT_ZIP_FILE',
          id,
          payload: { fileBuffer, relativePath },
        },
        [fileBuffer]
      );
    });
  } catch (err) {
    worker.terminate();
    throw err;
  }
}

export interface ApprovedSheetResult {
  totalCount: number;
  previewRows: SheetRow[];
  columns: string[];
  detectedCols: {
    activeM?: string;
    activeAcc?: string;
    activeRep?: string;
    [key: string]: string | undefined;
  };
  autoSheet1: SheetRow[];
  autoSheet1Counts: { total: number; cash: number; payments: number } | null;
  rows: SheetRow[];
}

/**
 * Runs heavy approval, column detection, machines extraction, and 50-row previewing
 * in an isolated Web Worker, keeping the UI at 60/120 FPS without ANY freezing!
 */
export async function approveSheetWithWorker(
  rows: SheetRow[],
  sheetType: 'payments' | 'cash',
  existingSheet1Count: number,
  onProgress?: (percent: number, stepText: string) => void
): Promise<ApprovedSheetResult> {
  const worker = createWorker();
  const id = `approve_${++workerIdCounter}_${Date.now()}`;

  onProgress?.(5, 'بدء تشغيل مسار الاعتماد الخلفي المعزول (Web Worker)...');

  try {
    return await new Promise<ApprovedSheetResult>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        const { type, id: msgId, percent, stepText, error, ...data } = e.data;
        if (msgId !== id) return;

        if (type === 'PROGRESS') {
          onProgress?.(percent, stepText);
        } else if (type === 'SHEET_APPROVED') {
          worker.terminate();
          resolve(data as ApprovedSheetResult);
        } else if (type === 'ERROR') {
          worker.terminate();
          reject(new Error(error || 'تعذر اعتماد الشيت في المسار الخلفي.'));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(err.message || 'حدث خطأ في مسار اعتماد الشيت.'));
      };

      worker.postMessage({
        type: 'APPROVE_SHEET',
        id,
        payload: {
          rows,
          sheetType,
          existingSheet1Count,
        },
      });
    });
  } catch (err) {
    worker.terminate();
    throw err;
  }
}

