import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Split,
  Download,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SheetRow } from '../types';
import { parseExcelFile } from '../utils/excel';

interface BigFileSplitterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToSheet: (rows: SheetRow[], fileName: string, sheetType: 'payments' | 'cash') => void;
  defaultSheetType?: 'payments' | 'cash';
}

export const BigFileSplitterModal: React.FC<BigFileSplitterModalProps> = ({
  isOpen,
  onClose,
  onApplyToSheet,
  defaultSheetType = 'cash',
}) => {
  const [sheetType, setSheetType] = useState<'payments' | 'cash'>(defaultSheetType);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [parsedRows, setParsedRows] = useState<SheetRow[] | null>(null);
  const [chunkSize, setChunkSize] = useState<number>(850000); // 850k per sheet safe below Excel's 1,048,576
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync default when opening
  React.useEffect(() => {
    if (isOpen) {
      setSheetType(defaultSheetType);
      setSelectedFile(null);
      setParsedRows(null);
      setErrorMessage(null);
      setStatusText('');
    }
  }, [isOpen, defaultSheetType]);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setStatusText('جاري تحميل ومعالجة الملف بسرعة فائقة...');
    setErrorMessage(null);

    try {
      const rows = await parseExcelFile(file, sheetType);
      if (!rows || rows.length === 0) {
        setErrorMessage('الملف فارغ أو تعذر استخراج أي سجلات صالحة منه.');
        setIsProcessing(false);
        return;
      }
      setParsedRows(rows);
      setIsProcessing(false);
      setStatusText(`تم قراءة ${rows.length.toLocaleString('ar-EG')} سجل بنجاح!`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'حدث خطأ أثناء معالجة الملف الضخم.');
      setIsProcessing(false);
    }
  };

  const totalRows = parsedRows ? parsedRows.length : 0;
  const numChunks = Math.ceil(totalRows / chunkSize);

  // 1. Export as Multi-Sheet Excel Workbook (Each sheet <= chunkSize rows)
  const exportMultiSheetExcel = () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setIsProcessing(true);
    setStatusText('جاري إنشاء ملف الإكسل متعدد الشيتات وتوزيع الصفوف...');

    setTimeout(() => {
      try {
        const wb = XLSX.utils.book_new();
        const headers = Object.keys(parsedRows[0]).filter((k) => !k.startsWith('_'));
        const labelPrefix = sheetType === 'payments' ? 'مدفوعات' : 'كاش';

        for (let i = 0; i < numChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, totalRows);
          const chunk = parsedRows.slice(start, end);

          const aoa: any[][] = [headers];
          for (let r = 0; r < chunk.length; r++) {
            const rowObj = chunk[r];
            aoa.push(headers.map((h) => rowObj[h] ?? ''));
          }

          const ws = XLSX.utils.aoa_to_sheet(aoa);
          XLSX.utils.book_append_sheet(wb, ws, `${labelPrefix}_جزء_${i + 1}_من_${numChunks}`);
        }

        const baseName = selectedFile?.name.replace(/\.[^/.]+$/, '') || `ملف_${labelPrefix}_المقسم`;
        XLSX.writeFile(wb, `${baseName}_مقسم_شيتات_Excel.xlsx`);
        setStatusText('✅ تم تصدير ملف الإكسل متعدد الشيتات بنجاح!');
      } catch (err: any) {
        setErrorMessage('تعذر تصدير الملف: ' + err.message);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // 2. Export as Full CSV (No row limits)
  const exportFullCsv = () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setIsProcessing(true);
    setStatusText('جاري إنشاء ملف CSV شامل بدون سقف لعدد الصفوف...');

    setTimeout(() => {
      try {
        const headers = Object.keys(parsedRows[0]).filter((k) => !k.startsWith('_'));
        const lines: string[] = [];

        // Header
        lines.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

        // Rows
        for (let r = 0; r < parsedRows.length; r++) {
          const rowObj = parsedRows[r];
          lines.push(
            headers
              .map((h) => {
                const val = String(rowObj[h] ?? '').replace(/"/g, '""');
                return `"${val}"`;
              })
              .join(',')
          );
        }

        const csvContent = '\uFEFF' + lines.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const baseName = selectedFile?.name.replace(/\.[^/.]+$/, '') || 'ملف_شامل';
        link.download = `${baseName}_كامل_CSV.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        setStatusText('✅ تم تصدير ملف CSV الشامل بنجاح!');
      } catch (err: any) {
        setErrorMessage('تعذر تصدير CSV: ' + err.message);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // 3. Directly load all rows into App sheet
  const handleApplyDirectly = () => {
    if (!parsedRows || parsedRows.length === 0) return;
    onApplyToSheet(parsedRows, selectedFile?.name || 'ملف_المليوني.xlsx', sheetType);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/85 backdrop-blur-md p-3 sm:p-5 transition-all font-['Cairo']">
      <div className="bg-[#0b1329] border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#080e1e] border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  معالج وتقسيم الملفات المليونية والعملاقة (+1.66M صف)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Big Data Splitter
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                حل مشكلة سقف الإكسل (1,048,576 صف) وتجزئة ملفات الكاش والمدفوعات الضخمة لضمان قراءة وعرض كافة السجلات 100%.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Target Sheet Switcher */}
          <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <span className="text-xs font-bold text-slate-300">تحديد الشيت المستهدف للمعالجة:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSheetType('payments');
                  setParsedRows(null);
                  setSelectedFile(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  sheetType === 'payments'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                💳 شيت المدفوعات
              </button>
              <button
                onClick={() => {
                  setSheetType('cash');
                  setParsedRows(null);
                  setSelectedFile(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  sheetType === 'cash'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                💵 شيت الكاش
              </button>
            </div>
          </div>

          {/* Technical Explanation Alert */}
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-slate-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-blue-400 text-sm">
              <Info className="w-4 h-4" />
              <span>لماذا لا يعرض برنامج Microsoft Excel الملف كاملاً؟</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px] sm:text-xs">
              برنامج مايكروسوفت إكسل لديه حد تقني صلب وهو <strong>1,048,576 صف فقط</strong> في ورقة العمل الواحدة (Sheet). عند فتح ملف ضخم يحتوي على أكثر من مليون صف، يقوم الإكسل بقص البيانات بعد الصف مليون و48 ألف، فتسقط باقي السجلات!
            </p>
          </div>

          {/* Upload Area if no file selected */}
          {!parsedRows && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-3xl p-8 sm:p-10 text-center cursor-pointer bg-slate-900/40 block transition-all">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv, .txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <Database className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-white mb-1">
                  اختر ملف {sheetType === 'payments' ? 'المدفوعات' : 'الكاش'} الضخم (Excel أو CSV أو TXT)
                </h4>
                <p className="text-xs text-slate-400">
                  يدعم الملفات الكبيرة جداً مع معالجة سريعة وآمنة في الذاكرة
                </p>
              </label>

              {isProcessing && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold text-center flex items-center justify-center gap-2 animate-pulse">
                  <Sparkles className="w-4 h-4" />
                  <span>{statusText || 'جاري قراءة ومعالجة الملف...'}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* Analysis & Actions after file parsed */}
          {parsedRows && (
            <div className="space-y-5">
              {/* File Stats Summary */}
              <div className="p-4 rounded-2xl bg-[#080f22] border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-[#050914] rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">إجمالي السجلات</span>
                  <span className="text-lg font-mono font-black text-amber-400">
                    {totalRows.toLocaleString('ar-EG')}
                  </span>
                </div>
                <div className="p-3 bg-[#050914] rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">عدد الأجزاء المقترحة</span>
                  <span className="text-lg font-mono font-black text-emerald-400">
                    {numChunks} أجزاء
                  </span>
                </div>
                <div className="p-3 bg-[#050914] rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">سقف كل شيت إكسل</span>
                  <span className="text-lg font-mono font-black text-blue-400">
                    {chunkSize.toLocaleString('ar-EG')}
                  </span>
                </div>
                <div className="p-3 bg-[#050914] rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">النوع المحدد</span>
                  <span className="text-xs font-bold text-slate-200 truncate block mt-1">
                    {sheetType === 'payments' ? '💳 مدفوعات' : '💵 كاش'}
                  </span>
                </div>
              </div>

              {/* Chunk Distribution Preview */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>خطة التوزيع والتجزئة لفتح كافة البيانات بالإكسل 100%:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Array.from({ length: numChunks }).map((_, idx) => {
                    const start = idx * chunkSize + 1;
                    const end = Math.min((idx + 1) * chunkSize, totalRows);
                    const count = end - start + 1;
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#060c1c] border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-200">
                            ورقة عمل {idx + 1}: من الصف {start.toLocaleString('ar-EG')} إلى {end.toLocaleString('ar-EG')}
                          </span>
                        </div>
                        <span className="font-mono text-emerald-400 font-black text-[11px]">
                          ({count.toLocaleString('ar-EG')} صف)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {/* 1. Multi-Sheet Excel */}
                <button
                  onClick={exportMultiSheetExcel}
                  disabled={isProcessing}
                  className="p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
                  <span>تحميل كملف إكسل واحد مقسم لشيتات (.xlsx)</span>
                  <span className="text-[10px] text-emerald-200 font-normal">
                    يفتح في الإكسل بالكامل بدون فقدان أي صف
                  </span>
                </button>

                {/* 2. Full CSV */}
                <button
                  onClick={exportFullCsv}
                  disabled={isProcessing}
                  className="p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-5 h-5 text-blue-200" />
                  <span>تصدير كملف CSV شامل بدون أي سقف (.csv)</span>
                  <span className="text-[10px] text-blue-200 font-normal">
                    يحتوي كافة الـ {totalRows.toLocaleString('ar-EG')} صف في ملف واحد
                  </span>
                </button>

                {/* 3. Load directly to App */}
                <button
                  onClick={handleApplyDirectly}
                  disabled={isProcessing}
                  className="p-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-2 transition-all shadow-lg shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                >
                  <Database className="w-5 h-5 text-amber-200" />
                  <span>اعتماد وقراءة في الشيت بالمنظومة فوراً</span>
                  <span className="text-[10px] text-amber-200 font-normal">
                    تطبيق مباشر للمطابقة السريعة داخل البرنامج
                  </span>
                </button>
              </div>

              {statusText && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold text-center">
                  {statusText}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#080e1e] border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              setSelectedFile(null);
              setParsedRows(null);
              setStatusText('');
              setErrorMessage(null);
            }}
            className="text-xs text-slate-400 hover:text-white transition font-bold"
          >
            اختيار ملف آخر
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
