import React, { useState } from 'react';
import {
  FileArchive,
  FileSpreadsheet,
  FileText,
  X,
  Check,
  HardDrive,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { ZipFileInfo, extractFileFromZip, formatFileSize } from '../utils/zip';

interface ZipFilePickerModalProps {
  isOpen: boolean;
  zipFile: File | null;
  files: ZipFileInfo[];
  onSelectFile: (extractedFile: File) => void;
  onClose: () => void;
  targetSheetLabel?: string; // e.g. "شيت المدفوعات" or "شيت الكاش"
}

export const ZipFilePickerModal: React.FC<ZipFilePickerModalProps> = ({
  isOpen,
  zipFile,
  files,
  onSelectFile,
  onClose,
  targetSheetLabel = 'المنظومة',
}) => {
  const [extractingPath, setExtractingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !zipFile) return null;

  const supportedFiles = files.filter((f) => f.isSupportedSheet);
  const unsupportedFilesCount = files.length - supportedFiles.length;

  const handleSelect = async (fileInfo: ZipFileInfo) => {
    try {
      setExtractingPath(fileInfo.path);
      setError(null);
      const extractedFile = await extractFileFromZip(zipFile, fileInfo.path);
      onSelectFile(extractedFile);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'تعذر فك ضغط واستخراج هذا الملف.');
      setExtractingPath(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                محتويات الأرشيف المضغوط (ZIP)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تم العثور على {supportedFiles.length} ملف جدول بيانات داخل:{' '}
                <span className="font-semibold text-slate-700 font-mono text-[11px]">
                  {zipFile.name}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Note */}
        <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-100/80 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            يرجى اختيار الملف المطلوب قراءته واعتماده في{' '}
            <strong className="font-semibold text-amber-900">{targetSheetLabel}</strong>:
          </span>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Files List */}
        <div className="p-6 overflow-y-auto space-y-2.5 flex-1">
          {supportedFiles.length === 0 ? (
            <div className="text-center py-10 px-4">
              <FileArchive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">
                لم يتم العثور على أي ملفات جداول متوافقة داخل هذا الأرشيف.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                تأكد من أن الأرشيف يحتوي على ملفات بصيغة CSV أو XLSX أو XLS.
              </p>
            </div>
          ) : (
            supportedFiles.map((item) => {
              const isExtracting = extractingPath === item.path;
              const isCsv = item.extension === 'csv';

              return (
                <div
                  key={item.path}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isCsv
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-blue-50 text-blue-600 border border-blue-200'
                      }`}
                    >
                      {isCsv ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate" title={item.name}>
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="font-mono uppercase font-bold text-slate-500">
                          {item.extension}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-mono">
                          <HardDrive className="w-3 h-3 text-slate-400" />
                          {formatFileSize(item.size)}
                        </span>
                        {item.date && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {item.date.toLocaleDateString('ar-EG')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelect(item)}
                    disabled={isExtracting || extractingPath !== null}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري الفك...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>اختيار وقراءة</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}

          {unsupportedFilesCount > 0 && (
            <p className="text-[11px] text-slate-400 text-center pt-2">
              (تم استبعاد {unsupportedFilesCount} ملف/مجلد غير متوافق تلقائياً)
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>يتم فك الملف بالكامل داخل المتصفح بأمان وبأقصى سرعة.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-white text-slate-700 font-medium transition-colors cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
