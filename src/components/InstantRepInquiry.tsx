import React, { useState, useMemo } from 'react';
import {
  Search,
  Users,
  Copy,
  Check,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  X,
  Zap,
  Maximize2,
  CreditCard,
  Banknote,
  ArrowUpDown,
  RotateCcw,
  Trash2,
  Filter,
} from 'lucide-react';
import { chunkCache, RepLookupRecord, RepSearchResult } from '../utils/chunkCache';
import { exportRepStatementToExcel } from '../utils/excel';

interface InstantRepInquiryProps {
  sheet2Count: number;
  sheet3Count: number;
  sheet2FileName?: string;
  sheet3FileName?: string;
  colM2?: string;
  colAcc?: string;
  colRep?: string;
  colM3?: string;
  colCashAcc?: string;
  colCashRep?: string;
  onOpenFullLookup?: (initialQuery?: string) => void;
  onClearInquirySheets?: () => void;
  showToast?: (message: string) => void;
  isStandaloneTab?: boolean;
}

export const InstantRepInquiry: React.FC<InstantRepInquiryProps> = ({
  sheet2Count,
  sheet3Count,
  sheet2FileName,
  sheet3FileName,
  colM2,
  colAcc,
  colRep,
  colM3,
  colCashAcc,
  colCashRep,
  onOpenFullLookup,
  onClearInquirySheets,
  showToast = () => {},
  isStandaloneTab = false,
}) => {
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [repQuery, setRepQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'repeated' | 'pay' | 'cash'>('all');
  const [sortOrder, setSortOrder] = useState<'default' | 'machine' | 'repeated'>('default');

  const [isLoading, setIsLoading] = useState(false);

  const effectiveS2Count = sheet2Count > 0 ? sheet2Count : chunkCache.getCount('sheet2');
  const effectiveS3Count = sheet3Count > 0 ? sheet3Count : chunkCache.getCount('sheet3');
  const hasData = effectiveS2Count > 0 || effectiveS3Count > 0;

  // Search exclusively in Sheet 2 & Sheet 3 from chunkCache on demand
  const searchResult: RepSearchResult = useMemo(() => {
    const activeQ = submittedQuery.trim();
    if (!hasData || !activeQ) {
      return {
        query: activeQ,
        records: [],
        totalMatches: 0,
        uniqueMachinesCount: 0,
        repeatedMachinesCount: 0,
        paymentsCount: 0,
        cashCount: 0,
        uniqueRepAccounts: [],
      };
    }

    return chunkCache.searchRep(activeQ, {
      colM2,
      colAcc,
      colRep,
      colM3,
      colCashAcc,
      colCashRep,
      limit: 10000,
    });
  }, [submittedQuery, hasData, colM2, colAcc, colRep, colM3, colCashAcc, colCashRep]);

  // Filter records based on selected filter pill
  const filteredRecords = useMemo(() => {
    let list = [...searchResult.records];

    if (activeFilter === 'repeated') {
      list = list.filter((r) => r.isRepeated);
    } else if (activeFilter === 'pay') {
      list = list.filter((r) => r.sheetType === 'payments');
    } else if (activeFilter === 'cash') {
      list = list.filter((r) => r.sheetType === 'cash');
    }

    if (sortOrder === 'machine') {
      list.sort((a, b) => a.normMachine.localeCompare(b.normMachine, 'ar', { numeric: true }));
    } else if (sortOrder === 'repeated') {
      list.sort((a, b) => {
        if (a.isRepeated !== b.isRepeated) return a.isRepeated ? -1 : 1;
        return b.totalRepetitions - a.totalRepetitions;
      });
    }

    return list;
  }, [searchResult.records, activeFilter, sortOrder]);

  // Reset and clear query data to search again
  const handleResetSearch = () => {
    setRepQuery('');
    setSubmittedQuery('');
    setActiveFilter('all');
    setSortOrder('default');
    setCopiedId(null);
    setCopiedAll(false);
    showToast('🧹 تم مسح بيانات الاستعلام، يمكنك كتابة رقم جديد للبحث');
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Copy single machine ID
  const handleCopyMachine = (machine: string) => {
    navigator.clipboard.writeText(machine);
    setCopiedId(machine);
    showToast(`✓ تم نسخ رقم الماكينة (${machine})`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy all unique machine IDs
  const handleCopyAllMachines = () => {
    if (filteredRecords.length === 0) return;
    const machinesList = Array.from(new Set(filteredRecords.map((r) => r.machine))).join('\n');
    navigator.clipboard.writeText(machinesList);
    setCopiedAll(true);
    showToast(`✓ تم نسخ ${new Set(filteredRecords.map((r) => r.machine)).size} رقم ماكينة بنجاح!`);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Export to Excel without ANY fake data
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return;
    const repInfo = searchResult.records[0]?.account || repQuery;
    const repName = searchResult.records[0]?.repName || 'غير مدون';

    exportRepStatementToExcel(
      filteredRecords.map((r, i) => ({
        idx: i + 1,
        id: r.id,
        machine: r.machine,
        account: r.account,
        repName: r.repName,
        type: r.sheetType === 'cash' ? ('cash' as const) : ('pay' as const),
        typeLabel: r.sheetTypeLabel,
        statusLabel: r.isRepeated ? `مكرر (${r.repeatIndex} من ${r.totalRepetitions})` : 'فردي',
        ownershipStatus: r.repeatReason,
        date: '',
        serial: r.machine,
        model: r.sheetType === 'cash' ? 'كاش' : 'مدفوعات',
        repOrder: r.repeatIndex,
        totalReps: r.totalRepetitions,
        otherReps: r.repeatReason,
      })),
      repInfo,
      repName,
      `كشف_ماكينات_المندوب_${repInfo}.xlsx`
    );
    showToast('📊 تم تصدير كشف استعلام المندوب إلى Excel بنجاح');
  };

  // Export CSV cleanly
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const repInfo = searchResult.records[0]?.account || repQuery;
    let csv = '\uFEFFم,رقم الماكينة,رقم المندوب / الحساب,اسم المندوب,المصدر,رقم السطر,حالة الربط,بيان التكرار\n';
    filteredRecords.forEach((r, idx) => {
      csv += `"${idx + 1}","${r.machine}","${r.account}","${r.repName}","${r.sheetTypeLabel}","${r.rowIdx}","${
        r.isRepeated ? `مكرر (${r.repeatIndex} من ${r.totalRepetitions})` : 'فردي'
      }","${r.repeatReason}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `كشف_استعلام_المندوب_${repInfo}.csv`;
    link.click();
    showToast('✓ تم تنزيل كشف CSV بنجاح');
  };

  // If no sheets uploaded yet
  if (!hasData) {
    return (
      <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-3 font-['Cairo']">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
          <FileSpreadsheet className="w-7 h-7" />
        </div>
        <h4 className="text-base font-bold text-white">نظام الاستعلام المباشر عن ماكينات المندوب</h4>
        <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
          لبدء الاستعلام، يرجى رفع <span className="text-indigo-400 font-bold">شيت المدفوعات</span> أو{' '}
          <span className="text-emerald-400 font-bold">شيت الكاش</span> (أو كلاهما).
          سيقوم النظام بالبحث الحصري فيهما فقط واستخراج كل ماكينة مربوطة بالمندوب بدقة تامة وبدون أي أرقام افتراضية.
        </p>
      </div>
    );
  }

  const activeSearchQuery = (submittedQuery || repQuery).trim();
  const isSearchActive = activeSearchQuery.length > 0;
  const noMatches = isSearchActive && searchResult.totalMatches === 0;
  const hasMatches = isSearchActive && searchResult.totalMatches > 0;

  return (
    <div className={`bg-[#0a0f1d] border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden font-['Cairo'] space-y-5 text-right ${isStandaloneTab ? 'max-w-7xl mx-auto' : ''}`}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-600/30 shrink-0">
            <Zap className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-white">
                قسم الاستعلام المباشر عن ماكينات المندوب (كاش ومدفوعات)
              </h3>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                بيانات حقيقية 100%
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              يبحث حصرياً في شيت الكاش والمدفوعات، ويستخرج كافة الماكينات المربوطة برقم المندوب مع إظهار جميع أسطر التكرار بدقة.
            </p>
          </div>
        </div>

        {/* Source Sheet Stats Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
            <span>المدفوعات: {effectiveS2Count > 0 ? `${effectiveS2Count.toLocaleString('ar-EG')} سطر` : 'غير مرفوع'}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
            <Banknote className="w-3.5 h-3.5 text-emerald-400" />
            <span>الكاش: {effectiveS3Count > 0 ? `${effectiveS3Count.toLocaleString('ar-EG')} سطر` : 'غير مرفوع'}</span>
          </div>

          {onClearInquirySheets && hasData && (
            <button
              onClick={() => {
                if (window.confirm('هل تريد مسح بيانات شيتات الكاش والمدفوعات من الذاكرة بالكامل؟')) {
                  onClearInquirySheets();
                  handleResetSearch();
                }
              }}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 flex items-center gap-1.5 transition-all cursor-pointer"
              title="مسح شيتات الكاش والمدفوعات من الذاكرة"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>مسح الشيتات</span>
            </button>
          )}

          {onOpenFullLookup && !isStandaloneTab && (
            <button
              onClick={() => onOpenFullLookup(activeSearchQuery)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 flex items-center gap-1.5 transition-all cursor-pointer"
              title="فتح في نافذة كاملة"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>شاشة مكبرة</span>
            </button>
          )}
        </div>
      </div>

      {/* Clean Search Bar */}
      <div className="space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsLoading(true);
            setTimeout(() => {
              setSubmittedQuery(repQuery.trim());
              setIsLoading(false);
            }, 60);
          }}
          className="flex flex-col sm:flex-row items-stretch gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={repQuery}
              onChange={(e) => {
                setRepQuery(e.target.value);
              }}
              placeholder="اكتب رقم المندوب المطلوب الاستعلام عنه هنا (مثال: كود الحساب أو رقم المندوب)..."
              className="w-full pr-12 pl-12 py-3 bg-slate-900/90 border-2 border-indigo-500/40 focus:border-indigo-400 rounded-2xl text-sm font-mono font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 shadow-inner"
              autoFocus={isStandaloneTab}
            />
            {repQuery && (
              <button
                type="button"
                onClick={() => {
                  setRepQuery('');
                  setSubmittedQuery('');
                }}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="مسح حقل البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>{isLoading ? 'جاري الاستعلام...' : 'استعلام الآن'}</span>
          </button>

          {/* Button: Clear data & search again */}
          <button
            type="button"
            onClick={handleResetSearch}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-rose-300 hover:text-white border border-rose-500/40 hover:border-rose-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
            title="مسح البيانات والبحث من جديد"
          >
            <RotateCcw className="w-4 h-4 text-rose-400" />
            <span>مسح البيانات والبحث من جديد</span>
          </button>
        </form>

        <p className="text-[11px] text-slate-400 px-1">
          * الاستعلام يبحث مباشرة في ملفات الكاش والمدفوعات المرفوعة فقط، ولا يعرض أي بيانات أو أرقام افتراضية.
        </p>
      </div>

      {/* State A: Idle (No search entered yet) */}
      {!isSearchActive && (
        <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <Users className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
          <h5 className="text-sm font-bold text-slate-300">أدخل رقم المندوب في الحقل أعلاه</h5>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            بمجرد إدخال الرقم والضغط على "استعلام الآن"، سيتم حصر كافة ماكينات المندوب فوراً من الشيتات وتحديد أي ماكينات مكررة وتكراراتها.
          </p>
        </div>
      )}

      {/* State B: No matches found */}
      {noMatches && (
        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-400" />
          <h5 className="text-sm font-bold">لا توجد ماكينات مربوطة برقم المندوب ({activeSearchQuery})</h5>
          <p className="text-xs text-amber-200/80 max-w-lg mx-auto">
            تم فحص كافة سجلات شيت المدفوعات وشيت الكاش المرفوعين ولم يتم العثور على أي ارتباط بهذا الرقم. يرجى مراجعة رقم المندوب وإعادة المحاولة.
          </p>
          <div>
            <button
              type="button"
              onClick={handleResetSearch}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-white border border-rose-500/30 inline-flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>مسح البيانات والبحث من جديد</span>
            </button>
          </div>
        </div>
      )}

      {/* State C: Search Results Display */}
      {hasMatches && (
        <div className="space-y-4 pt-1 animate-in fade-in duration-200">
          {/* Summary Rep Information Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">رقم المندوب المستعلم عنه:</span>
                <span className="text-base font-mono font-black text-white bg-slate-800 px-3 py-0.5 rounded-lg border border-slate-700">
                  {searchResult.records[0]?.account || activeSearchQuery}
                </span>
                {searchResult.records[0]?.repName && searchResult.records[0]?.repName !== 'غير متوفر' && (
                  <span className="text-xs font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-lg border border-indigo-500/30">
                    {searchResult.records[0]?.repName}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                نتائج مطابقة من واقع شيت المدفوعات وشيت الكاش المرفوعين فقط.
              </p>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
              <button
                onClick={handleResetSearch}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-white border border-rose-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="مسح بيانات الاستعلام والبحث عن مندوب آخر"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>مسح البيانات والبحث من جديد</span>
              </button>

              <button
                onClick={handleCopyAllMachines}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                title="نسخ أرقام جميع الماكينات المربوطة بالمندوب"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAll ? 'تم النسخ!' : 'نسخ كافة الماكينات'}</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                title="تصدير كشف استعلام المندوب إلى ملف Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير Excel</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                title="تصدير كشف المندوب كـ CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>تصدير CSV</span>
              </button>
            </div>
          </div>

          {/* Stats Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-right">
              <span className="text-[10px] text-slate-400 block font-bold">إجمالي أسطر الربط</span>
              <span className="text-xl font-mono font-black text-white">
                {searchResult.totalMatches.toLocaleString('ar-EG')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/90 border border-indigo-500/30 text-right">
              <span className="text-[10px] text-indigo-300 block font-bold">ماكينات فريدة</span>
              <span className="text-xl font-mono font-black text-indigo-400">
                {searchResult.uniqueMachinesCount.toLocaleString('ar-EG')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-right">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-amber-300 font-bold block">ماكينات مكررة الربط</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-xl font-mono font-black text-amber-400">
                {searchResult.repeatedMachinesCount.toLocaleString('ar-EG')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-right">
              <span className="text-[10px] text-blue-300 block font-bold">في شيت المدفوعات</span>
              <span className="text-xl font-mono font-black text-blue-400">
                {searchResult.paymentsCount.toLocaleString('ar-EG')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-right col-span-2 sm:col-span-1">
              <span className="text-[10px] text-emerald-300 block font-bold">في شيت الكاش</span>
              <span className="text-xl font-mono font-black text-emerald-400">
                {searchResult.cashCount.toLocaleString('ar-EG')}
              </span>
            </div>
          </div>

          {/* Filter Bar & Sorting */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                الكل ({searchResult.totalMatches})
              </button>

              <button
                onClick={() => setActiveFilter('repeated')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activeFilter === 'repeated'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>المكرر فقط ({searchResult.records.filter((r) => r.isRepeated).length})</span>
              </button>

              <button
                onClick={() => setActiveFilter('pay')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === 'pay'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-blue-400 hover:bg-slate-700'
                }`}
              >
                المدفوعات ({searchResult.paymentsCount})
              </button>

              <button
                onClick={() => setActiveFilter('cash')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === 'cash'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                }`}
              >
                الكاش ({searchResult.cashCount})
              </button>
            </div>

            {/* Sorting Toggle */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs">
              <span className="text-slate-500 font-bold">الترتيب:</span>
              <button
                onClick={() => setSortOrder('default')}
                className={`px-2 py-1 rounded-lg font-bold cursor-pointer ${
                  sortOrder === 'default' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                تلقائي
              </button>
              <button
                onClick={() => setSortOrder('repeated')}
                className={`px-2 py-1 rounded-lg font-bold cursor-pointer ${
                  sortOrder === 'repeated' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                المكرر أولاً
              </button>
              <button
                onClick={() => setSortOrder('machine')}
                className={`px-2 py-1 rounded-lg font-bold cursor-pointer ${
                  sortOrder === 'machine' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                رقم الماكينة
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40">
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900/95 sticky top-0 z-10 text-slate-400 border-b border-slate-800 text-[11px] font-bold">
                  <tr>
                    <th className="p-3 w-12 text-center">م</th>
                    <th className="p-3">رقم الماكينة</th>
                    <th className="p-3">مصدر الربط</th>
                    <th className="p-3">رقم السطر في الشيت</th>
                    <th className="p-3">رقم المندوب المستعلم عنه</th>
                    <th className="p-3">حالة الربط والتكرار</th>
                    <th className="p-3 text-center w-28">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredRecords.map((r, index) => {
                    const isCopied = copiedId === r.machine;
                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors ${
                          r.isRepeated
                            ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.09]'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="p-3 text-center text-slate-500 font-mono text-[11px]">
                          {index + 1}
                        </td>

                        {/* Machine ID */}
                        <td className="p-3 font-mono font-bold text-white text-sm">
                          <span className="px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 inline-block">
                            {r.machine}
                          </span>
                        </td>

                        {/* Sheet Type Badge */}
                        <td className="p-3">
                          {r.sheetType === 'cash' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <Banknote className="w-3 h-3" />
                              <span>شيت الكاش</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              <CreditCard className="w-3 h-3" />
                              <span>شيت المدفوعات</span>
                            </span>
                          )}
                        </td>

                        {/* Row Index */}
                        <td className="p-3 font-mono text-slate-400 text-xs">
                          سطر #{r.rowIdx.toLocaleString('ar-EG')}
                        </td>

                        {/* Rep Account */}
                        <td className="p-3 font-mono text-slate-300 text-xs">
                          <span>{r.account}</span>
                          {r.repName && r.repName !== 'غير متوفر' && (
                            <span className="text-[10px] text-slate-500 mr-2 block">
                              {r.repName}
                            </span>
                          )}
                        </td>

                        {/* Repeat Status */}
                        <td className="p-3">
                          {r.isRepeated ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                <span>مكرر الربط (تكرار {r.repeatIndex} من {r.totalRepetitions})</span>
                              </span>
                              <span className="text-[10px] text-amber-400/80 block">
                                {r.repeatReason}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>ربط فردي فريد</span>
                            </span>
                          )}
                        </td>

                        {/* Copy button */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleCopyMachine(r.machine)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 hover:bg-indigo-600/40 text-slate-300 hover:text-white border border-slate-700'
                            }`}
                            title="نسخ رقم الماكينة"
                          >
                            {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{isCopied ? 'تم!' : 'نسخ'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Summary in Table */}
            <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>عرض {filteredRecords.length.toLocaleString('ar-EG')} سجل من أصل {searchResult.totalMatches.toLocaleString('ar-EG')} ارتباط</span>
              <span className="font-mono font-bold text-slate-300">
                {new Set(filteredRecords.map((r) => r.machine)).size} ماكينة فريدة
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
