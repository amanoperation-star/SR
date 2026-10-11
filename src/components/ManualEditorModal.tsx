import React, { useState, useEffect } from 'react';
import {
  TableCellsMerge,
  Plus,
  Wand2,
  Trash2,
  Download,
  CheckCircle2,
  X,
  Keyboard,
  AlertCircle,
  Zap,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SheetRow } from '../types';

interface ManualEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 1 | 2;
  currentSheet1: SheetRow[];
  currentSheet2: SheetRow[];
  onApplySheet1: (data: SheetRow[]) => void;
  onApplySheet2: (data: SheetRow[]) => void;
}

interface EditorRowItem {
  c1: string;
  c2: string;
  c3?: string;
}

export const ManualEditorModal: React.FC<ManualEditorModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  currentSheet1,
  currentSheet2,
  onApplySheet1,
  onApplySheet2,
}) => {
  const [activeMode, setActiveMode] = useState<1 | 2>(initialMode);
  const [sheet1SubTab, setSheet1SubTab] = useState<'cash' | 'payments'>('cash');

  // State arrays
  const [cashEditorData, setCashEditorData] = useState<EditorRowItem[]>([]);
  const [paymentsEditorData, setPaymentsEditorData] = useState<EditorRowItem[]>([]);
  const [sheet2EditorData, setSheet2EditorData] = useState<EditorRowItem[]>([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    setActiveMode(initialMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowClearConfirm(false);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (activeMode === 1) {
      if (currentSheet1.length > 0) {
        const cash: EditorRowItem[] = [];
        const pay: EditorRowItem[] = [];
        currentSheet1.forEach((r) => {
          const val = String(r['رقم الماكينة'] ?? Object.values(r)[0] ?? '');
          const area = String(r['الفرع / المنطقة'] ?? Object.values(r)[1] ?? '');
          if (val.startsWith('7-') || val.startsWith('٧-')) {
            cash.push({ c1: val, c2: area });
          } else {
            pay.push({ c1: val, c2: area });
          }
        });
        setCashEditorData(cash.length ? cash : [{ c1: '1234', c2: 'فرع القاهرة' }]);
        setPaymentsEditorData(pay.length ? pay : [{ c1: 'POS-1001', c2: 'فرع المعادي' }]);
      } else {
        setCashEditorData([
          { c1: '1234', c2: 'فرع القاهرة (تحول لـ 7-1234)' },
          { c1: '7-POS-1002', c2: 'فرع الجيزة' },
        ]);
        setPaymentsEditorData([
          { c1: 'POS-1001', c2: 'فرع القاهرة - المعادي' },
          { c1: 'POS-1003', c2: 'فرع الإسكندرية - سموحة' },
        ]);
      }
    } else {
      if (currentSheet2.length > 0) {
        setSheet2EditorData(
          currentSheet2.map((r) => ({
            c1: String(r['رقم الماكينة'] ?? Object.values(r)[0] ?? ''),
            c2: String(r['رقم حساب المندوب'] ?? Object.values(r)[1] ?? ''),
            c3: String(r['اسم المندوب'] ?? Object.values(r)[2] ?? ''),
          }))
        );
      } else {
        setSheet2EditorData([
          { c1: 'POS-1001', c2: '1234', c3: 'أحمد محمود سالم' },
          { c1: 'POS-1001', c2: '456', c3: 'محمود حسن رضوان' },
          { c1: 'POS-1002', c2: '555', c3: 'خالد عبد الرحمن' },
        ]);
      }
    }
  }, [activeMode, isOpen, currentSheet1, currentSheet2]);

  if (!isOpen) return null;

  // Active dataset getter/setter
  const currentDataset =
    activeMode === 2
      ? sheet2EditorData
      : sheet1SubTab === 'cash'
      ? cashEditorData
      : paymentsEditorData;

  const setCurrentDataset = (updater: (prev: EditorRowItem[]) => EditorRowItem[]) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (activeMode === 2) {
      setSheet2EditorData(updater);
    } else if (sheet1SubTab === 'cash') {
      setCashEditorData(updater);
    } else {
      setPaymentsEditorData(updater);
    }
  };

  const handleCellChange = (idx: number, field: 'c1' | 'c2' | 'c3', val: string) => {
    setCurrentDataset((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const addRow = () => {
    setCurrentDataset((prev) => [...prev, { c1: '', c2: '', c3: '' }]);
  };

  const removeRow = (idx: number) => {
    setCurrentDataset((prev) => prev.filter((_, i) => i !== idx));
  };

  const confirmClearAll = () => {
    setCurrentDataset(() => []);
    setShowClearConfirm(false);
  };

  const convertCashMachinesTo7 = () => {
    let count = 0;
    setCashEditorData((prev) =>
      prev.map((row) => {
        if (row.c1 && row.c1.trim() !== '') {
          const str = row.c1.trim();
          if (!str.startsWith('7-') && !str.startsWith('٧-')) {
            count++;
            return { ...row, c1: `7-${str}` };
          }
        }
        return row;
      })
    );
    if (count > 0) {
      setSuccessMessage(`⚡ تم تحويل ${count} ماكينات كاش إلى البادئة 7- بنجاح!`);
    } else {
      setSuccessMessage('كافة ماكينات الكاش تحتوي بالفعل على البادئة 7-');
    }
  };

  const loadDefaults = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowClearConfirm(false);
    if (activeMode === 1) {
      if (sheet1SubTab === 'cash') {
        setCashEditorData([
          { c1: '1234', c2: 'فرع المعادي (اضغط تحويل لـ 7-1234)' },
          { c1: '7-1002', c2: 'فرع المهندسين' },
          { c1: '5588', c2: 'فرع مدينة نصر' },
        ]);
      } else {
        setPaymentsEditorData([
          { c1: 'POS-1001', c2: 'فرع القاهرة - المعادي' },
          { c1: 'POS-1002', c2: 'فرع الجيزة - الدقي' },
          { c1: 'POS-1003', c2: 'فرع الإسكندرية - سموحة' },
        ]);
      }
    } else {
      setSheet2EditorData([
        { c1: 'POS-1001', c2: '1234', c3: 'أحمد محمود سالم' },
        { c1: 'POS-1001', c2: '456', c3: 'محمود حسن رضوان' },
        { c1: 'POS-1002', c2: '555', c3: 'خالد عبد الرحمن' },
      ]);
    }
  };

  const downloadAsExcel = () => {
    const wb = XLSX.utils.book_new();

    if (activeMode === 1) {
      const cashRows = cashEditorData
        .filter((r) => r.c1 && r.c1.trim() !== '')
        .map((r) => {
          const str = r.c1.trim();
          const cleanStr = !str.startsWith('7-') && !str.startsWith('٧-') ? `7-${str}` : str;
          return [cleanStr, r.c2 || ''];
        });

      const payRows = paymentsEditorData
        .filter((r) => r.c1 && r.c1.trim() !== '')
        .map((r) => [r.c1.trim(), r.c2 || '']);

      if (!cashRows.length && !payRows.length) {
        setErrorMessage('الجدول فارغ حالياً! أضف أسطر أو اضغط على إعادة تعبئة أمثلة تجريبية.');
        return;
      }

      const wsCash = XLSX.utils.aoa_to_sheet([['رقم الماكينة', 'الفرع / المنطقة'], ...cashRows]);
      wsCash['!cols'] = [{ wch: 22 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsCash, 'ماكينات الكاش');

      const wsPay = XLSX.utils.aoa_to_sheet([['رقم الماكينة', 'الفرع / المنطقة'], ...payRows]);
      wsPay['!cols'] = [{ wch: 22 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsPay, 'ماكينات المدفوعات');

      XLSX.writeFile(wb, 'قالب_الماكينات_المعدل_يدوياً.xlsx');
    } else {
      const valid = sheet2EditorData.filter((r) => r.c1 && r.c1.trim() !== '');
      if (!valid.length) {
        setErrorMessage('الجدول فارغ حالياً!');
        return;
      }
      const aoa: (string | number)[][] = [['رقم الماكينة', 'رقم حساب المندوب', 'اسم المندوب']];
      valid.forEach((r) => aoa.push([r.c1.trim(), r.c2 || '', r.c3 || '']));
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 32 }];
      XLSX.utils.book_append_sheet(wb, ws, 'شيت_المناديب');
      XLSX.writeFile(wb, 'قالب_المناديب_المعدل_يدوياً.xlsx');
    }
  };

  const applyToSystem = () => {
    if (activeMode === 1) {
      // Convert cash machines missing 7- prefix
      const validCash = cashEditorData
        .filter((r) => r.c1 && r.c1.trim() !== '')
        .map((r) => {
          const str = r.c1.trim();
          const cleanStr = !str.startsWith('7-') && !str.startsWith('٧-') ? `7-${str}` : str;
          return {
            'رقم الماكينة': cleanStr,
            'الفرع / المنطقة': r.c2?.trim() || '',
            _tabType: 'cash',
          };
        });

      const validPay = paymentsEditorData
        .filter((r) => r.c1 && r.c1.trim() !== '')
        .map((r) => ({
          'رقم الماكينة': r.c1.trim(),
          'الفرع / المنطقة': r.c2?.trim() || '',
          _tabType: 'payments',
        }));

      const combined = [...validCash, ...validPay];
      if (!combined.length) {
        setErrorMessage('يرجى التأكد من كتابة رقم الماكينة في سطر واحد على الأقل قبل الاعتماد.');
        return;
      }

      onApplySheet1(combined);
    } else {
      const valid = sheet2EditorData.filter((r) => r.c1 && r.c1.trim() !== '');
      if (!valid.length) {
        setErrorMessage('يرجى التأكد من كتابة رقم الماكينة في سطر واحد على الأقل قبل الاعتماد.');
        return;
      }
      const converted: SheetRow[] = valid.map((r) => ({
        'رقم الماكينة': r.c1.trim(),
        'رقم حساب المندوب': r.c2?.trim() || '',
        'اسم المندوب': r.c3?.trim() || '',
      }));
      onApplySheet2(converted);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5 transition-all">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-500/25">
              <TableCellsMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  محرر القوالب التفاعلي (Online Sheet Editor)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  {activeMode === 1 ? 'قالب الماكينات (كاش ومدفوعات)' : 'قالب المناديب (Sheet 2)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                أدخل أو عدّل البيانات مباشرة في الجدول مع تحويل تلقائي لماكينات الكاش إلى 7-
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Mode Switcher */}
        <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveMode(1);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMode === 1
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              قالب شيت الماكينات (Sheet 1)
            </button>
            <button
              onClick={() => {
                setActiveMode(2);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMode === 2
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              قالب شيت المناديب والحسابات (Sheet 2)
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeMode === 1 && sheet1SubTab === 'cash' && (
              <button
                onClick={convertCashMachinesTo7}
                className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                title="اضغط لتحويل كافة ماكينات الكاش في التبويب إلى 7-"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>⚡ تحويل ماكينات الكاش لـ 7-</span>
              </button>
            )}

            <button
              onClick={addRow}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              <span>إضافة سطر جديد</span>
            </button>
            <button
              onClick={loadDefaults}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>إعادة تعبئة أمثلة تجريبية</span>
            </button>

            {showClearConfirm ? (
              <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 p-1 rounded-xl border border-rose-200 dark:border-rose-900/60">
                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 px-1">
                  تأكيد المسح؟
                </span>
                <button
                  onClick={confirmClearAll}
                  className="px-2 py-0.5 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  نعم
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تفريغ الجدول</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-tabs for Sheet 1 (Machines) */}
        {activeMode === 1 && (
          <div className="px-6 py-2.5 bg-slate-100/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">تبويب الماكينات:</span>
              <button
                onClick={() => {
                  setSheet1SubTab('cash');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sheet1SubTab === 'cash'
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>💵 1. ماكينات الكاش</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-900/40 text-emerald-200 rounded-full font-mono">
                  {cashEditorData.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setSheet1SubTab('payments');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sheet1SubTab === 'payments'
                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>💳 2. ماكينات المدفوعات</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-indigo-900/40 text-indigo-200 rounded-full font-mono">
                  {paymentsEditorData.length}
                </span>
              </button>
            </div>

            {sheet1SubTab === 'cash' ? (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                💡 اكتب الرقم العادي (مثلاً 123) ثم اضغط "⚡ تحويل ماكينات الكاش لـ 7-" لتحويله فوراً إلى 7-123
              </span>
            ) : (
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                💡 ماكينات المدفوعات تبقى بالتنسيق العادي بدون بادئة
              </span>
            )}
          </div>
        )}

        {/* Success/Error Banner */}
        {successMessage && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 font-bold cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Table Body Area */}
        <div className="flex-1 overflow-auto p-6 space-y-3 bg-slate-50/50 dark:bg-[#070b13]">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-right border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                {activeMode === 1 ? (
                  <tr>
                    <th className="p-3 w-12 text-center">م</th>
                    <th className="p-3 w-1/2">
                      {sheet1SubTab === 'cash'
                        ? 'رقم ماكينة الكاش (مثل 1234 أو 7-1234) *'
                        : 'رقم ماكينة المدفوعات (مثل POS-1001) *'}
                    </th>
                    <th className="p-3 w-1/2">الفرع / المنطقة (اختياري)</th>
                    <th className="p-3 w-20 text-center">إجراء</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="p-3 w-12 text-center">م</th>
                    <th className="p-3 w-1/3">رقم الماكينة *</th>
                    <th className="p-3 w-1/4">رقم حساب المندوب *</th>
                    <th className="p-3 w-1/3">اسم المندوب المسند</th>
                    <th className="p-3 w-20 text-center">إجراء</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentDataset.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      الجدول فارغ حالياً. اضغط على "إضافة سطر جديد" أو "إعادة تعبئة أمثلة تجريبية".
                    </td>
                  </tr>
                ) : (
                  currentDataset.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                          value={row.c1}
                          onChange={(e) => handleCellChange(idx, 'c1', e.target.value)}
                          placeholder={
                            activeMode === 1 && sheet1SubTab === 'cash'
                              ? 'اكتب رقم الماكينة (مثال 1234)'
                              : 'مثال: POS-1001'
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 focus:outline-none focus:border-amber-500"
                          value={row.c2}
                          onChange={(e) => handleCellChange(idx, 'c2', e.target.value)}
                          placeholder={activeMode === 1 ? 'مثال: فرع القاهرة' : 'مثال: 1234'}
                        />
                      </td>
                      {activeMode === 2 && (
                        <td className="p-2">
                          <input
                            type="text"
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                            value={row.c3 || ''}
                            onChange={(e) => handleCellChange(idx, 'c3', e.target.value)}
                            placeholder="اسم المندوب أو اتركه فارغاً"
                          />
                        </td>
                      )}
                      <td className="p-2 text-center">
                        <button
                          onClick={() => removeRow(idx)}
                          className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center justify-center transition-colors cursor-pointer"
                          title="حذف هذا السطر"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 px-1">
            <span>إجمالي الأسطر: {currentDataset.length}</span>
            <span className="text-indigo-500 dark:text-indigo-400 font-semibold flex items-center gap-1">
              <Keyboard className="w-3.5 h-3.5" />
              <span>يمكنك الكتابة مباشرة داخل الحقول أو لصق أرقام الماكينات والبيانات.</span>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            إلغاء وإغلاق
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadAsExcel}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-500" />
              <span>تنزيل ملف الإكسل تبويبين (.xlsx)</span>
            </button>
            <button
              onClick={applyToSystem}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>اعتماد واستخدام البيانات فوراً في المطابقة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
