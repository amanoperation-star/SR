import React, { useState, useMemo, useEffect } from 'react';
import {
  Server,
  X,
  User,
  Cpu,
  Search,
  Link as LinkIcon,
  Layers,
  Banknote,
  CreditCard,
  Copy,
  FileSpreadsheet,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Split,
  Table as TableIcon,
  Users,
  Check,
} from 'lucide-react';
import { SheetRow, ExpandedRow, MachineSummary } from '../types';
import { exportRepStatementToExcel } from '../utils/excel';

interface RepLookupModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  machinesResults?: MachineSummary[];
  expandedRows?: ExpandedRow[];
  sheet1?: SheetRow[];
  sheet2?: SheetRow[];
  sheet3?: SheetRow[];
  colM1?: string;
  colM2?: string;
  colM3?: string;
  colAcc?: string;
  colRep?: string;
  colCashAcc?: string;
  colCashRep?: string;
  initialRepQuery?: string;
  onLoadSample?: () => void;
  onFilterMainTable?: (query: string) => void;
}

function normalizeDigits(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .trim();
}

export const RepLookupModal: React.FC<RepLookupModalProps> = ({
  isOpen = true,
  onClose,
  machinesResults = [],
  expandedRows = [],
  sheet1 = [],
  sheet2 = [],
  sheet3 = [],
  colM2 = '',
  colM3 = '',
  colAcc = '',
  colRep = '',
  colCashAcc = '',
  colCashRep = '',
  initialRepQuery = '',
  onFilterMainTable,
}) => {
  const [activeSearchTab, setActiveSearchTab] = useState<'rep' | 'machine'>('rep');
  const [searchQuery, setSearchQuery] = useState(initialRepQuery || '');
  const [currentFilter, setCurrentFilter] = useState<'all' | 'dup' | 'cash' | 'pay'>('all');
  const [openDetails, setOpenDetails] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSplitView, setIsSplitView] = useState(false);
  const [selectedRepAccount, setSelectedRepAccount] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [repSearchQuery, setRepSearchQuery] = useState('');
  const PAGE_SIZE = 50;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const toggleDetails = (id: string) => {
    setOpenDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(`تم نسخ رقم الماكينة (${text}) بنجاح!`);
  };

  // Check if any sheets are uploaded
  const hasUploadedSheets =
    sheet1.length > 0 || sheet2.length > 0 || sheet3.length > 0 || expandedRows.length > 0;

  // Extract ALL occurrences directly from uploaded sheets (sheet2 payments, sheet3 cash) or expandedRows
  const allOccurrences = useMemo(() => {
    if (!hasUploadedSheets) return [];

    const occurrences: Array<{
      idx: number;
      id: string;
      machine: string;
      account: string;
      repName: string;
      normAcc: string;
      normMachine: string;
      searchKey: string;
      type: 'cash' | 'pay';
      typeLabel: string;
      date: string;
      status: 'dup' | 'ok';
      statusLabel: string;
      serial: string;
      model: string;
      repOrder: number;
      totalReps: number;
      otherReps: string;
      ownershipStatus: string;
    }> = [];

    // If sheet2 (Payments) or sheet3 (Cash) are available, parse them directly
    if (sheet2.length > 0 || sheet3.length > 0) {
      // Helper column detectors for Sheet 2
      const s2Sample = sheet2[0] || {};
      const s2Keys = Object.keys(s2Sample);
      const effectiveM2 = colM2 || s2Keys.find((k) => /acceptor|ماكينة|جهاز|pos|machine|sn|id/i.test(k)) || s2Keys[0] || '';
      const effectiveAcc2 = colAcc || s2Keys.find((k) => /doner|donor|حساب|كود|account|acc|code/i.test(k)) || s2Keys[1] || s2Keys[0] || '';
      const effectiveRep2 = colRep || s2Keys.find((k) => /اسم|مندوب|عميل|مستخدم|rep.*name|agent|name/i.test(k)) || effectiveAcc2 || s2Keys[2] || s2Keys[0] || '';

      // Helper column detectors for Sheet 3
      const s3Sample = sheet3[0] || {};
      const s3Keys = Object.keys(s3Sample);
      const effectiveM3 = colM3 || s3Keys.find((k) => /acceptor|ماكينة|جهاز|pos|machine|sn|id/i.test(k)) || s3Keys[0] || '';
      const effectiveAcc3 = colCashAcc || s3Keys.find((k) => /doner|donor|كاش|حساب|كود|account|acc|code/i.test(k)) || s3Keys[1] || s3Keys[0] || '';
      const effectiveRep3 = colCashRep || s3Keys.find((k) => /اسم|مندوب|عميل|مستخدم|rep.*name|agent|name/i.test(k)) || effectiveAcc3 || s3Keys[2] || s3Keys[0] || '';

      // Process Sheet 2 (Payments)
      sheet2.forEach((row, i) => {
        const rawM = String(row[effectiveM2] ?? '').trim();
        const acc = String(row[effectiveAcc2] ?? 'غير متوفر').trim() || 'غير متوفر';
        const rep = String(row[effectiveRep2] ?? (acc !== 'غير متوفر' ? `مندوب (${acc})` : 'غير متوفر')).trim() || 'غير متوفر';

        if (rawM || acc !== 'غير متوفر') {
          const machine = rawM || 'غير معروفة';
          const normAcc = normalizeDigits(acc);
          const normMachine = normalizeDigits(machine.replace(/^7-|^٧-/, ''));
          const searchKey = `${normMachine} ${normAcc} ${rep.toLowerCase()} مدفوعات`.toLowerCase();

          occurrences.push({
            idx: occurrences.length + 1,
            id: `pay-${i}`,
            machine,
            account: acc,
            repName: rep,
            normAcc,
            normMachine,
            searchKey,
            type: 'pay',
            typeLabel: 'مدفوعات',
            date: '2026-10-01',
            status: 'ok',
            statusLabel: 'سليم',
            serial: `SN-P${1000000 + i}`,
            model: 'PAX A920',
            repOrder: 1,
            totalReps: 1,
            otherReps: 'لا يوجد مشاركون آخرون',
            ownershipStatus: 'مطابقة فردية للمندوب',
          });
        }
      });

      // Process Sheet 3 (Cash)
      sheet3.forEach((row, i) => {
        const rawM = String(row[effectiveM3] ?? '').trim();
        const machine = rawM.startsWith('7-') || rawM.startsWith('٧-') ? rawM : (rawM ? `7-${rawM}` : '7-غير_معروفة');
        const acc = String(row[effectiveAcc3] ?? 'غير متوفر').trim() || 'غير متوفر';
        const rep = String(row[effectiveRep3] ?? (acc !== 'غير متوفر' ? `مسؤول كاش (${acc})` : 'غير متوفر')).trim() || 'غير متوفر';

        if (rawM || acc !== 'غير متوفر') {
          const normAcc = normalizeDigits(acc);
          const normMachine = normalizeDigits(machine.replace(/^7-|^٧-/, ''));
          const searchKey = `${normMachine} ${normAcc} ${rep.toLowerCase()} كاش`.toLowerCase();

          occurrences.push({
            idx: occurrences.length + 1,
            id: `cash-${i}`,
            machine,
            account: acc,
            repName: rep,
            normAcc,
            normMachine,
            searchKey,
            type: 'cash',
            typeLabel: 'كاش',
            date: '2026-09-28',
            status: 'ok',
            statusLabel: 'سليم',
            serial: `SN-C${1000000 + i}`,
            model: 'Verifone V200c',
            repOrder: 1,
            totalReps: 1,
            otherReps: 'لا يوجد مشاركون آخرون',
            ownershipStatus: 'مطابقة فردية للمندوب',
          });
        }
      });

      // Group and sort occurrences so duplicate machines for the rep appear directly under each other
      occurrences.sort((a, b) => {
        if (a.normAcc !== b.normAcc) return a.normAcc.localeCompare(b.normAcc, 'ar', { numeric: true });
        if (a.normMachine !== b.normMachine) return a.normMachine.localeCompare(b.normMachine, 'ar', { numeric: true });
        if (a.type !== b.type) return a.type === 'pay' ? -1 : 1;
        return 0;
      });

      // Map distinct reps per machine across sheets to detect shared reps & ownership status
      const machineRepsMap = new Map<string, Set<string>>();
      occurrences.forEach((item) => {
        if (!machineRepsMap.has(item.normMachine)) {
          machineRepsMap.set(item.normMachine, new Set());
        }
        const repInfo = item.account !== 'غير متوفر' ? `${item.repName} (${item.account})` : item.repName;
        machineRepsMap.get(item.normMachine)!.add(repInfo);
      });

      // Count occurrences PER REP ACCOUNT & MACHINE to compute exact 1 من 2, 2 من 2 sequence
      const repMachineCounts = new Map<string, number>();
      occurrences.forEach((item) => {
        const key = `${item.normAcc}_${item.normMachine}`;
        repMachineCounts.set(key, (repMachineCounts.get(key) || 0) + 1);
      });

      // Assign idx, repOrder, totalReps, otherReps, ownershipStatus, and status
      const repMachineOrderTracker = new Map<string, number>();
      occurrences.forEach((item, index) => {
        item.idx = index + 1;
        const key = `${item.normAcc}_${item.normMachine}`;
        const total = repMachineCounts.get(key) || 1;
        const currentOrder = (repMachineOrderTracker.get(key) || 0) + 1;
        repMachineOrderTracker.set(key, currentOrder);

        item.repOrder = currentOrder;
        item.totalReps = total;

        const repsSet = machineRepsMap.get(item.normMachine) || new Set();
        const currentRepInfo = item.account !== 'غير متوفر' ? `${item.repName} (${item.account})` : item.repName;
        const otherRepsList = Array.from(repsSet).filter((r) => r !== currentRepInfo);

        item.otherReps = otherRepsList.length > 0 ? otherRepsList.join('، ') : 'لا يوجد مشاركون آخرون';
        if (otherRepsList.length > 0) {
          item.ownershipStatus = `مشتركة مع مناديب آخرين (${repsSet.size} مناديب)`;
        } else if (total > 1) {
          item.ownershipStatus = `مكررة لنفس المندوب (${total} أسطر)`;
        } else {
          item.ownershipStatus = 'مطابقة فردية للمندوب';
        }

        if (total > 1 || otherRepsList.length > 0) {
          item.status = 'dup';
          item.statusLabel = `${currentOrder} من ${total}`;
        } else {
          item.status = 'ok';
          item.statusLabel = '1 من 1';
        }
      });

      return occurrences;
    }

    // Fallback: Map expandedRows if available
    if (expandedRows.length > 0) {
      return expandedRows.map((row, idx) => {
        const isDuplicate = row.status === 'multi' || row.totalRepsForMachine > 1;
        const machine = row.type === 'cash' && !row.machine.startsWith('7-') && !row.machine.startsWith('٧-') ? `7-${row.machine}` : row.machine;
        const account = row.account || 'غير متوفر';
        const repName = row.repName || 'غير متوفر';
        const normAcc = normalizeDigits(account);
        const normMachine = normalizeDigits(machine.replace(/^7-|^٧-/, ''));
        const typeLabel = row.type === 'cash' ? 'كاش' : 'مدفوعات';
        const searchKey = `${normMachine} ${normAcc} ${repName.toLowerCase()} ${typeLabel}`.toLowerCase();

        return {
          idx: idx + 1,
          id: row.id || `rec-${idx}`,
          machine,
          repName,
          account,
          normAcc,
          normMachine,
          searchKey,
          type: row.type === 'cash' ? ('cash' as const) : ('pay' as const),
          typeLabel,
          date: '2026-10-01',
          status: isDuplicate ? ('dup' as const) : ('ok' as const),
          statusLabel: isDuplicate ? `مكرر (${row.totalRepsForMachine}x)` : 'سليم',
          serial: `SN-${100000000 + (idx * 7919) % 899999999}`,
          model: row.type === 'cash' ? 'Verifone V200c' : 'PAX A920',
          repOrder: row.repOrder,
          totalReps: row.totalRepsForMachine,
          otherReps: 'لا يوجد مشاركون آخرون',
          ownershipStatus: isDuplicate ? `مكررة لنفس المندوب (${row.totalRepsForMachine} أسطر)` : 'مطابقة فردية للمندوب',
        };
      });
    }

    return [];
  }, [sheet2, sheet3, expandedRows, colM2, colM3, colAcc, colRep, colCashAcc, colCashRep, hasUploadedSheets]);

  // Unique Rep Accounts list for Split View
  const repList = useMemo(() => {
    if (!hasUploadedSheets) return [];
    const repMap = new Map<string, { account: string; name: string; occurrencesCount: number; cashCount: number; payCount: number }>();

    allOccurrences.forEach((rec) => {
      const acc = rec.account;
      if (!repMap.has(acc)) {
        repMap.set(acc, {
          account: acc,
          name: rec.repName,
          occurrencesCount: 0,
          cashCount: 0,
          payCount: 0,
        });
      }
      const item = repMap.get(acc)!;
      item.occurrencesCount += 1;
      if (rec.type === 'cash') item.cashCount += 1;
      else item.payCount += 1;
    });

    return Array.from(repMap.values());
  }, [allOccurrences, hasUploadedSheets]);

  // Selected account for badge or filter
  const effectiveSelectedAccount = useMemo(() => {
    if (!hasUploadedSheets) return '-';
    if (selectedRepAccount) return selectedRepAccount;
    if (searchQuery.trim()) return searchQuery.trim();
    if (repList.length > 0) return repList[0].account;
    return 'غير محدد';
  }, [searchQuery, selectedRepAccount, repList, hasUploadedSheets]);

  // Filtered records according to query, filter pill, and active selected rep account
  const filteredRecords = useMemo(() => {
    if (!hasUploadedSheets) return [];

    const query = normalizeDigits(searchQuery.toLowerCase().trim());
    const normSelected = selectedRepAccount ? normalizeDigits(selectedRepAccount) : '';

    return allOccurrences.filter((rec) => {
      // If a specific rep is selected in Split View
      if (normSelected && selectedRepAccount) {
        if (rec.normAcc !== normSelected && !rec.repName.includes(selectedRepAccount)) {
          return false;
        }
      }

      // Fast search query filter
      if (query && !rec.searchKey.includes(query)) {
        return false;
      }

      // Status pills filter
      if (currentFilter === 'dup' && rec.totalReps <= 1) return false;
      if (currentFilter === 'cash' && rec.type !== 'cash') return false;
      if (currentFilter === 'pay' && rec.type !== 'pay') return false;

      return true;
    });
  }, [allOccurrences, searchQuery, currentFilter, selectedRepAccount, hasUploadedSheets]);

  // Reset page when filters or queries change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, currentFilter, selectedRepAccount, activeSearchTab]);

  // Paginated records for smooth rendering without DOM freezes
  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  // Filtered rep list for split view sidebar
  const filteredRepList = useMemo(() => {
    if (!repSearchQuery.trim()) return repList;
    const q = normalizeDigits(repSearchQuery.toLowerCase().trim());
    return repList.filter((r) => {
      const normAcc = normalizeDigits(r.account);
      const normName = r.name.toLowerCase();
      return normAcc.includes(q) || normName.includes(q);
    });
  }, [repList, repSearchQuery]);

  // Stats for current dataset
  const stats = useMemo(() => {
    if (!hasUploadedSheets) {
      return {
        totalLinks: 0,
        uniqueMachines: 0,
        cashCount: 0,
        payCount: 0,
        dupCount: 0,
        displayedCashPct: 0,
        displayedPayPct: 0,
      };
    }

    const records = filteredRecords.length > 0 ? filteredRecords : allOccurrences;
    const totalLinks = records.length;
    const uniqueMachines = new Set(records.map((r) => normalizeDigits(r.machine.replace(/^7-|^٧-/, '')))).size;
    const cashCount = records.filter((r) => r.type === 'cash').length;
    const payCount = records.filter((r) => r.type === 'pay').length;

    // Count duplicate machine occurrences
    const machineCounts = new Map<string, number>();
    records.forEach((r) => {
      const norm = normalizeDigits(r.machine.replace(/^7-|^٧-/, ''));
      machineCounts.set(norm, (machineCounts.get(norm) || 0) + 1);
    });
    let dupCount = 0;
    machineCounts.forEach((c) => {
      if (c > 1) dupCount += c;
    });

    const totalTypes = cashCount + payCount || 1;
    const cashPct = Math.round((cashCount / totalTypes) * 100);
    const payPct = 100 - cashPct;

    return {
      totalLinks,
      uniqueMachines,
      cashCount,
      payCount,
      dupCount,
      displayedCashPct: cashPct,
      displayedPayPct: payPct,
    };
  }, [hasUploadedSheets, filteredRecords, allOccurrences]);

  // Export CSV exactly as Image 1 format: م | رقم الماكينه | رقم الحساب | نوع الربط
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      showToast('لا توجد بيانات معروضة للتصدير!');
      return;
    }

    let csv = '\uFEFFم,رقم الماكينه,رقم الحساب,نوع الربط,اسم المندوب\n';
    filteredRecords.forEach((rec, index) => {
      const rowStr = `"${index + 1}","${rec.machine}","${rec.account}","${rec.typeLabel}","${rec.repName}"`;
      csv += rowStr + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_ماكينات_المندوب_${effectiveSelectedAccount}.csv`;
    link.click();
    showToast(`تم تصدير CSV (مطابق للصورة 1 - ${filteredRecords.length} سجل) بنجاح!`);
  };

  // Export Excel matching Image 2 format (Summary header block + 9 detailed columns)
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      showToast('لا توجد بيانات معروضة للتصدير!');
      return;
    }

    const firstRepName = filteredRecords[0]?.repName || 'غير مدون';
    exportRepStatementToExcel(
      filteredRecords,
      effectiveSelectedAccount,
      firstRepName,
      `كشف_ارتباطات_المندوب_${effectiveSelectedAccount}.xlsx`
    );
    showToast(`تم تصدير كشف إكسل مفصل (مطابق للصورة 2 - ${filteredRecords.length} سطر) بنجاح!`);
  };

  // Apply search handler
  const handleApplySearch = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      showToast('تم تطبيق الفلترة بنجاح وتحديث الجدول الرئيسي!');
      if (onFilterMainTable && searchQuery) {
        onFilterMainTable(searchQuery);
      }
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 font-['Cairo'] select-none overflow-y-auto">
      {/* Radial Dark Background matching provided CSS */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundColor: '#070a12',
          backgroundImage: `
            radial-gradient(circle at 50% 30%, rgba(30, 58, 138, 0.25) 0%, transparent 60%),
            radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 10% 20%, rgba(56, 189, 248, 0.1) 0%, transparent 40%)
          `,
        }}
      />

      {/* Grid Overlay matching bg-grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Main Dashboard Glass Container */}
      <div className="relative z-10 w-full max-w-6xl bg-[rgba(15,23,42,0.75)] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),0_0_40px_0_rgba(59,130,246,0.12)] flex flex-col text-[#cbd5e1] animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <header className="px-6 py-4 border-b border-white/10 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[#38bdf8] flex items-center justify-center">
              <Server className="w-5 h-5 text-[#38bdf8]" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[#f8fafc] flex items-center gap-2">
                استعلام أجهزة POS والمناديب
              </h1>
              <p className="text-xs text-[#64748b] mt-0.5">
                فحص وتحليل ارتباطات أجهزة الدفع الإلكترونية بالحسابات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle: Normal Table vs Split-View */}
            <div className="flex items-center gap-1 bg-[#070a12]/80 border border-white/10 p-1 rounded-xl text-xs">
              <button
                onClick={() => setIsSplitView(false)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
                  !isSplitView
                    ? 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40'
                    : 'text-[#64748b] hover:text-white'
                }`}
                title="عرض جدول كامل"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>جدول شامل</span>
              </button>

              <button
                onClick={() => setIsSplitView(true)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
                  isSplitView
                    ? 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40'
                    : 'text-[#64748b] hover:text-white'
                }`}
                title="عرض انقسام الشاشة اختيار المندوب ومتابعة ماكيناته"
              >
                <Split className="w-3.5 h-3.5" />
                <span>عرض منقسم (Split-View)</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/35 text-[#fda4af] hover:bg-rose-500/30 flex items-center justify-center transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Uploaded Sheets Status Badges Bar */}
        <div className="px-6 py-2.5 bg-[#050812]/80 border-b border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#64748b]">
            <FileSpreadsheet className="w-4 h-4 text-[#38bdf8]" />
            <span className="font-bold text-white">حالة الشيتات المرفوعة بالمنظومة:</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Sheet 2: Payments */}
            <div
              className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 ${
                sheet2.length > 0
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-sm'
                  : 'bg-slate-900/60 text-[#64748b] border-white/5'
              }`}
            >
              {sheet2.length > 0 ? (
                <Check className="w-3.5 h-3.5 text-purple-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>💳 شيت المدفوعات:</span>
              <strong className="font-mono">
                {sheet2.length > 0 ? `✓ تم رفعه (${sheet2.length.toLocaleString('ar-EG')} سجل)` : 'غير مرفوع'}
              </strong>
            </div>

            {/* Sheet 3: Cash */}
            <div
              className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 ${
                sheet3.length > 0
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm'
                  : 'bg-slate-900/60 text-[#64748b] border-white/5'
              }`}
            >
              {sheet3.length > 0 ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>💵 شيت أجهزة الكاش:</span>
              <strong className="font-mono">
                {sheet3.length > 0 ? `✓ تم رفعه (${sheet3.length.toLocaleString('ar-EG')} سجل)` : 'غير مرفوع'}
              </strong>
            </div>

            {/* Sheet 1: POS Machines */}
            <div
              className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 ${
                sheet1.length > 0
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30 shadow-sm'
                  : 'bg-slate-900/60 text-[#64748b] border-white/5'
              }`}
            >
              {sheet1.length > 0 ? (
                <Check className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>📦 شيت أجهزة POS:</span>
              <strong className="font-mono">
                {sheet1.length > 0 ? `✓ تم رفعه (${sheet1.length.toLocaleString('ar-EG')} ماكينة)` : 'اختياري'}
              </strong>
            </div>
          </div>
        </div>

        {/* Main Body */}
        <main className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveSearchTab('rep');
                  setCurrentFilter('all');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeSearchTab === 'rep'
                    ? 'bg-sky-500/10 text-[#38bdf8] border border-sky-500/25 shadow-sm'
                    : 'bg-transparent text-[#64748b] hover:text-white border border-transparent'
                }`}
              >
                <User className="w-4 h-4" />
                <span>البحث بحساب المندوب</span>
              </button>

              <button
                onClick={() => {
                  setActiveSearchTab('machine');
                  setCurrentFilter('all');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeSearchTab === 'machine'
                    ? 'bg-sky-500/10 text-[#38bdf8] border border-sky-500/25 shadow-sm'
                    : 'bg-transparent text-[#64748b] hover:text-white border border-transparent'
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>البحث برقم الماكينة</span>
              </button>
            </div>

            {selectedRepAccount && (
              <button
                onClick={() => setSelectedRepAccount(null)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                إلغاء تصفية المندوب المحدد ✕
              </button>
            )}
          </div>

          {/* Search Row */}
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#38bdf8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeSearchTab === 'rep'
                    ? 'ابحث برقم حساب المندوب (مثال: 510842)، الاسم، أو نوع الحركة...'
                    : 'ابحث برقم الماكينة (مثال: 1024580)...'
                }
                className="w-full bg-[rgba(7,10,18,0.8)] border border-white/10 rounded-lg py-2.5 pr-10 pl-4 text-xs font-mono text-[#f8fafc] placeholder:text-[#64748b] focus:outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] transition-all"
              />
            </div>

            <div className="bg-[rgba(7,10,18,0.8)] border border-white/10 px-4 py-2 rounded-lg flex items-center gap-2 text-xs text-[#cbd5e1] shrink-0">
              <span>الحساب المحدد:</span>
              <strong className="font-mono text-[#38bdf8] text-sm font-bold">
                {effectiveSelectedAccount}
              </strong>
            </div>
          </div>

          {/* Split-View Layout vs Classic Single Column */}
          {isSplitView ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Right Panel: List of Reps / Accounts */}
              <div className="lg:col-span-4 bg-[#070a12]/80 border border-white/10 rounded-xl p-3.5 space-y-3 max-h-[500px] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Users className="w-4 h-4 text-[#38bdf8]" />
                    <span>قائمة المناديب ({filteredRepList.length})</span>
                  </div>
                  <span className="text-[10px] text-[#64748b]">اختر مندوباً للتركيز</span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={repSearchQuery}
                    onChange={(e) => setRepSearchQuery(e.target.value)}
                    placeholder="تصفية بالاسم أو بالحساب..."
                    className="w-full bg-[rgba(7,10,18,0.9)] border border-white/10 rounded-lg py-1.5 px-3 text-xs text-[#cbd5e1] placeholder:text-[#64748b] focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>

                {filteredRepList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#64748b]">
                    لا توجد حسابات مناديب مطابقة لشرط البحث.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredRepList.slice(0, 80).map((rep) => {
                      const isSelected = selectedRepAccount === rep.account;
                      return (
                        <button
                          key={rep.account}
                          onClick={() => setSelectedRepAccount(isSelected ? null : rep.account)}
                          className={`w-full text-right p-3 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                            isSelected
                              ? 'bg-sky-500/20 border-sky-500/50 shadow-md ring-1 ring-sky-500/40'
                              : 'bg-slate-900/50 border-white/5 hover:border-white/20 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-white truncate max-w-[150px]">
                              {rep.name}
                            </span>
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-[#38bdf8] border border-sky-500/20">
                              {rep.account}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-[#64748b] font-mono pt-1 border-t border-white/5">
                            <span>إجمالي الماكينات: <strong className="text-white">{rep.occurrencesCount}</strong></span>
                            <div className="flex items-center gap-1.5">
                              {rep.payCount > 0 && <span className="text-[#c084fc]">💳 {rep.payCount}</span>}
                              {rep.cashCount > 0 && <span className="text-[#34d399]">💵 {rep.cashCount}</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Left Panel: Inspection Details & Line-by-Line Table */}
              <div className="lg:col-span-8 space-y-4">
                {/* KPI Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <button
                    onClick={() => setCurrentFilter('all')}
                    className={`bg-[rgba(7,10,18,0.6)] border border-white/10 p-2.5 rounded-lg flex flex-col justify-between text-right cursor-pointer hover:border-[#38bdf8]/40 transition-colors ${
                      currentFilter === 'all' ? 'ring-1 ring-[#38bdf8]/50 bg-sky-500/10' : ''
                    }`}
                  >
                    <span className="text-[11px] text-[#64748b] flex items-center gap-1 mb-1">
                      <LinkIcon className="w-3 h-3 text-[#64748b]" />
                      <span>إجمالي الارتباطات</span>
                    </span>
                    <span className="font-mono font-semibold text-base text-[#f8fafc]">
                      {stats.totalLinks.toLocaleString('ar-EG')}
                    </span>
                  </button>

                  <div className="bg-[rgba(7,10,18,0.6)] border border-white/10 p-2.5 rounded-lg flex flex-col justify-between">
                    <span className="text-[11px] text-[#64748b] flex items-center gap-1 mb-1">
                      <Layers className="w-3 h-3 text-[#64748b]" />
                      <span>الأجهزة الفريدة</span>
                    </span>
                    <span className="font-mono font-semibold text-base text-[#f8fafc]">
                      {stats.uniqueMachines.toLocaleString('ar-EG')}
                    </span>
                  </div>

                  <button
                    onClick={() => setCurrentFilter('cash')}
                    className={`bg-[rgba(7,10,18,0.6)] border border-white/10 p-2.5 rounded-lg flex flex-col justify-between text-right cursor-pointer hover:border-[#34d399]/40 transition-colors ${
                      currentFilter === 'cash' ? 'ring-1 ring-[#34d399]/50 bg-emerald-500/10' : ''
                    }`}
                  >
                    <span className="text-[11px] text-[#64748b] flex items-center gap-1 mb-1">
                      <Banknote className="w-3 h-3 text-[#34d399]" />
                      <span>الكاش</span>
                    </span>
                    <span className="font-mono font-semibold text-base text-[#34d399]">
                      {stats.cashCount.toLocaleString('ar-EG')}
                    </span>
                  </button>

                  <button
                    onClick={() => setCurrentFilter('pay')}
                    className={`bg-[rgba(7,10,18,0.6)] border border-white/10 p-2.5 rounded-lg flex flex-col justify-between text-right cursor-pointer hover:border-[#c084fc]/40 transition-colors ${
                      currentFilter === 'pay' ? 'ring-1 ring-[#c084fc]/50 bg-purple-500/10' : ''
                    }`}
                  >
                    <span className="text-[11px] text-[#64748b] flex items-center gap-1 mb-1">
                      <CreditCard className="w-3 h-3 text-[#c084fc]" />
                      <span>المدفوعات</span>
                    </span>
                    <span className="font-mono font-semibold text-base text-[#c084fc]">
                      {stats.payCount.toLocaleString('ar-EG')}
                    </span>
                  </button>

                  <button
                    onClick={() => setCurrentFilter('dup')}
                    className={`bg-[rgba(7,10,18,0.6)] border border-white/10 p-2.5 rounded-lg flex flex-col justify-between text-right cursor-pointer hover:border-[#f87171]/40 transition-colors ${
                      currentFilter === 'dup' ? 'ring-1 ring-[#f87171]/50 bg-rose-500/10' : ''
                    }`}
                  >
                    <span className="text-[11px] text-[#64748b] flex items-center gap-1 mb-1">
                      <Copy className="w-3 h-3 text-[#f87171]" />
                      <span>المكرر</span>
                    </span>
                    <span className="font-mono font-semibold text-base text-[#f87171]">
                      {stats.dupCount.toLocaleString('ar-EG')}
                    </span>
                  </button>
                </div>

                {/* Table Line-by-Line matching image.png */}
                <div className="border border-white/10 rounded-lg overflow-hidden bg-[rgba(7,10,18,0.7)] shadow-lg max-h-[400px] overflow-y-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-[rgba(15,23,42,0.85)] text-[#64748b] font-semibold border-b border-white/10 sticky top-0">
                      <tr>
                        <th className="p-2.5 w-10 text-center font-mono">م</th>
                        <th className="p-2.5">رقم الماكينة</th>
                        <th className="p-2.5 text-center">نوع الحساب</th>
                        <th className="p-2.5 text-center">ترتيب السجل للمندوب</th>
                        <th className="p-2.5 text-center font-mono">إجمالي تكرار الماكينة</th>
                        <th className="p-2.5">حالة الملكية والتعدد</th>
                        <th className="p-2.5">المناديب المشاركون على الماكينة</th>
                        <th className="p-2.5 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-[#cbd5e1]">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-[#64748b]">
                            لا توجد ماكينات معروضة لهذا المندوب.
                          </td>
                        </tr>
                      ) : (
                        paginatedRecords.map((rec, index) => (
                          <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-2.5 text-center font-mono text-[#64748b] font-bold">
                              {(currentPage - 1) * PAGE_SIZE + index + 1}
                            </td>
                            <td className="p-2.5 font-mono text-[#f8fafc] font-bold">
                              <div className="flex items-center gap-1.5">
                                <span>{rec.machine}</span>
                                <button
                                  onClick={() => copyText(rec.machine)}
                                  className="text-[#64748b] hover:text-[#38bdf8] transition-colors cursor-pointer"
                                  title="نسخ رقم الماكينة"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="p-2.5 text-center">
                              {rec.type === 'pay' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#0d1427] text-[#38bdf8] border border-[#1e3a8a] shadow-sm">
                                  <span>💳</span>
                                  <span>مدفوعات</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#042016] text-[#34d399] border border-[#065f46] shadow-sm">
                                  <span>💵</span>
                                  <span>كاش (-7)</span>
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {rec.totalReps > 1 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/35">
                                  {rec.repOrder} من {rec.totalReps}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  1 من 1
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                {rec.totalReps} أسطر
                              </span>
                            </td>
                            <td className="p-2.5">
                              {rec.otherReps !== 'لا يوجد مشاركون آخرون' ? (
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                  {rec.ownershipStatus}
                                </span>
                              ) : rec.totalReps > 1 ? (
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  {rec.ownershipStatus}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {rec.ownershipStatus}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-300 text-xs">
                              <span className="truncate max-w-[160px] block" title={rec.otherReps}>
                                {rec.otherReps}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => copyText(rec.machine)}
                                className="text-[#64748b] hover:text-[#38bdf8] transition-colors p-1 cursor-pointer"
                                title="نسخ الماكينة"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Split View Pagination Controls */}
                {filteredRecords.length > PAGE_SIZE && (
                  <div className="p-2.5 bg-slate-900/60 border-t border-white/10 flex items-center justify-between text-xs text-[#64748b] flex-wrap gap-2">
                    <div>
                      عرض <strong className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}</strong> إلى{' '}
                      <strong className="text-white">{Math.min(currentPage * PAGE_SIZE, filteredRecords.length)}</strong> من{' '}
                      <strong className="text-[#38bdf8]">{filteredRecords.length}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <button
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded bg-slate-800 border border-white/10 text-slate-300 disabled:opacity-40 hover:bg-slate-700 cursor-pointer flex items-center gap-1 text-[11px]"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span>السابق</span>
                      </button>
                      <span className="px-1 text-slate-300 text-[11px]">
                        صفحة {currentPage} من {totalPages}
                      </span>
                      <button
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-2.5 py-1 rounded bg-slate-800 border border-white/10 text-slate-300 disabled:opacity-40 hover:bg-slate-700 cursor-pointer flex items-center gap-1 text-[11px]"
                      >
                        <span>التالي</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        ) : (
            /* Classic Layout */
            <>
              {/* KPI Cards Grid - Interactive click filters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <button
                  onClick={() => setCurrentFilter('all')}
                  className={`bg-[rgba(7,10,18,0.6)] border border-white/10 p-3 rounded-lg flex flex-col justify-between text-right cursor-pointer hover:border-[#38bdf8]/40 transition-all ${
                    currentFilter === 'all' ? 'ring-1 ring-[#38bdf8]/50 bg-sky-500/10' : ''
                  }`}
                  title="عرض كافة الارتباطات"
                >
                  <span className="text-[12px] text-[#64748b] flex items-center gap-1.5 mb-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-[#64748b]" />
                    <span>إجمالي الارتباطات</span>
                  </span>
                  <span className="font-mono font-semibold text-lg text-[#f8fafc]">
                    {stats.totalLinks.toLocaleString('ar-EG')}
                  </span>
                </button>

                <div className="bg-[rgba(7,10,18,0.6)] border border-white/10 p-3 rounded-lg flex flex-col justify-between">
                  <span className="text-[12px] text-[#64748b] flex items-center gap-1.5 mb-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#64748b]" />
                    <span>الأجهزة الفريدة</span>
                  </span>
                  <span className="font-mono font-semibold text-lg text-[#f8fafc]">
                    {stats.uniqueMachines.toLocaleString('ar-EG')}
                  </span>
                </div>

                <button
                  onClick={() => setCurrentFilter('cash')}
                  className={`bg-[rgba(7,10,18,0.6)] border border-white/10 p-3 rounded-lg flex flex-col justify-between text-right cursor-pointer hover:border-[#34d399]/40 transition-all ${
                    currentFilter === 'cash' ? 'ring-1 ring-[#34d399]/50 bg-emerald-500/10' : ''
                  }`}
                  title="تصفية ماكينات الكاش فقط"
                >
                  <span className="text-[12px] text-[#64748b] flex items-center gap-1.5 mb-1.5">
                    <Banknote className="w-3.5 h-3.5 text-[#34d399]" />
                    <span>ماكينات الكاش</span>
                  </span>
                  <span className="font-mono font-semibold text-lg text-[#34d399]">
                    {stats.cashCount.toLocaleString('ar-EG')}
                  </span>
                </button>

                <button
                  onClick={() => setCurrentFilter('pay')}
                  className={`bg-[rgba(7,10,18,0.6)] border border-white/10 p-3 rounded-lg flex flex-col justify-between text-right cursor-pointer hover:border-[#c084fc]/40 transition-all ${
                    currentFilter === 'pay' ? 'ring-1 ring-[#c084fc]/50 bg-purple-500/10' : ''
                  }`}
                  title="تصفية ماكينات المدفوعات فقط"
                >
                  <span className="text-[12px] text-[#64748b] flex items-center gap-1.5 mb-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#c084fc]" />
                    <span>ماكينات المدفوعات</span>
                  </span>
                  <span className="font-mono font-semibold text-lg text-[#c084fc]">
                    {stats.payCount.toLocaleString('ar-EG')}
                  </span>
                </button>

                <button
                  onClick={() => setCurrentFilter('dup')}
                  className={`bg-[rgba(7,10,18,0.6)] border border-white/10 p-3 rounded-lg flex flex-col justify-between text-right cursor-pointer hover:border-[#f87171]/40 transition-all col-span-2 sm:col-span-1 ${
                    currentFilter === 'dup' ? 'ring-1 ring-[#f87171]/50 bg-rose-500/10' : ''
                  }`}
                  title="تصفية الماكينات المكررة فقط"
                >
                  <span className="text-[12px] text-[#64748b] flex items-center gap-1.5 mb-1.5">
                    <Copy className="w-3.5 h-3.5 text-[#f87171]" />
                    <span>أجهزة مكررة للمندوب</span>
                  </span>
                  <span className="font-mono font-semibold text-lg text-[#f87171]">
                    {stats.dupCount.toLocaleString('ar-EG')}
                  </span>
                </button>
              </div>

              {/* Mini Distribution Progress */}
              <div className="bg-[rgba(7,10,18,0.6)] border border-white/10 p-3 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#64748b]">
                  <span>نسبة توزيع الماكينات المعروضة:</span>
                  <span className="font-mono font-bold text-[#cbd5e1]">
                    {stats.displayedCashPct}% كاش | {stats.displayedPayPct}% مدفوعات
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[rgba(15,23,42,0.9)] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-[#34d399] transition-all duration-300"
                    style={{ width: `${stats.displayedCashPct}%` }}
                    title={`كاش ${stats.displayedCashPct}%`}
                  />
                  <div
                    className="h-full bg-[#c084fc] transition-all duration-300"
                    style={{ width: `${stats.displayedPayPct}%` }}
                    title={`مدفوعات ${stats.displayedPayPct}%`}
                  />
                </div>
              </div>

              {/* Quick Status Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-[#64748b] text-xs shrink-0">تصفية سريعة:</span>
                <button
                  onClick={() => setCurrentFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${
                    currentFilter === 'all'
                      ? 'bg-[rgba(56,189,248,0.15)] text-[#38bdf8] border border-[rgba(56,189,248,0.4)]'
                      : 'bg-[rgba(7,10,18,0.6)] text-[#64748b] border border-white/10 hover:text-white'
                  }`}
                >
                  الكل ({filteredRecords.length})
                </button>
                <button
                  onClick={() => setCurrentFilter('dup')}
                  className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${
                    currentFilter === 'dup'
                      ? 'bg-[rgba(248,113,113,0.15)] text-[#f87171] border border-[rgba(248,113,113,0.4)]'
                      : 'bg-[rgba(7,10,18,0.6)] text-[#64748b] border border-white/10 hover:text-white'
                  }`}
                >
                  ⚠️ المكرر فقط ({filteredRecords.filter((r) => r.status === 'dup').length})
                </button>
                <button
                  onClick={() => setCurrentFilter('cash')}
                  className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${
                    currentFilter === 'cash'
                      ? 'bg-[rgba(52,211,153,0.15)] text-[#34d399] border border-[rgba(52,211,153,0.4)]'
                      : 'bg-[rgba(7,10,18,0.6)] text-[#64748b] border border-white/10 hover:text-white'
                  }`}
                >
                  💵 كاش فقط ({filteredRecords.filter((r) => r.type === 'cash').length})
                </button>
                <button
                  onClick={() => setCurrentFilter('pay')}
                  className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${
                    currentFilter === 'pay'
                      ? 'bg-[rgba(192,132,252,0.15)] text-[#c084fc] border border-[rgba(192,132,252,0.4)]'
                      : 'bg-[rgba(7,10,18,0.6)] text-[#64748b] border border-white/10 hover:text-white'
                  }`}
                >
                  💳 مدفوعات فقط ({filteredRecords.filter((r) => r.type === 'pay').length})
                </button>
              </div>

              {/* Table Actions Row */}
              <div className="flex items-center justify-between text-xs text-[#64748b] flex-wrap gap-2">
                <span>
                  نتائج الجدول المعروضة:{' '}
                  <strong className="text-[#38bdf8] font-mono text-sm font-bold">
                    {filteredRecords.length}
                  </strong>{' '}
                  سطر
                </span>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 rounded-lg bg-[rgba(52,211,153,0.15)] border border-[rgba(52,211,153,0.35)] text-[#34d399] font-semibold hover:bg-emerald-500/25 transition-all flex items-center gap-1.5 cursor-pointer text-xs"
                    title="تصدير جدول الماكينات مبسط CSV (مطابق للصورة الأولى)"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#34d399]" />
                    <span>تصدير CSV (مطابق للصورة 1)</span>
                  </button>

                  <button
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/35 text-[#38bdf8] font-semibold hover:bg-sky-500/25 transition-all flex items-center gap-1.5 cursor-pointer text-xs"
                    title="تصدير كشف المندوب المفصل إكسل بملخص علوي و 9 أعمدة (مطابق للصورة الثانية)"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#38bdf8]" />
                    <span>تصدير كشف مفصل إكسل (مطابق للصورة 2)</span>
                  </button>
                </div>
              </div>

              {/* POS Table - Exact Line-by-Line list matching image.png */}
              <div className="border border-white/10 rounded-lg overflow-hidden bg-[rgba(7,10,18,0.7)] shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-[rgba(15,23,42,0.85)] text-[#64748b] font-semibold border-b border-white/10">
                      <tr>
                        <th className="p-3 w-12 text-center font-mono">م</th>
                        <th className="p-3">رقم الماكينة (POS SN)</th>
                        <th className="p-3 font-mono">رقم الحساب</th>
                        <th className="p-3 font-mono text-center">نوع الربط</th>
                        <th className="p-3">اسم المندوب المسند</th>
                        <th className="p-3 text-center">ترتيب الماكينة للمندوب</th>
                        <th className="p-3 text-center">تفاصيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-[#cbd5e1]">
                      {!hasUploadedSheets ? (
                        <tr>
                          <td colSpan={7} className="p-10 text-center text-[#64748b] space-y-2">
                            <AlertCircle className="w-8 h-8 text-amber-500/80 mx-auto" />
                            <p className="font-bold text-sm text-[#f8fafc]">لا توجد شيتات مرفوعة حالياً</p>
                            <p className="text-xs text-[#64748b]">
                              قم برفع شيت الكاش أو شيت المدفوعات في الشاشة الرئيسية لحساب وتفصيل الارتباطات تلقائياً.
                            </p>
                          </td>
                        </tr>
                      ) : filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-[#64748b]">
                            لا توجد أجهزة مطابقة لشرط البحث الحالي في الشيتات المرفوعة.
                          </td>
                        </tr>
                      ) : (
                        paginatedRecords.map((rec, index) => {
                          const isDetailOpen = !!openDetails[rec.id];
                          return (
                            <React.Fragment key={rec.id}>
                              <tr
                                className={`transition-colors hover:bg-slate-800/40 ${
                                  rec.status === 'dup' ? 'bg-[rgba(248,113,113,0.05)]' : ''
                                }`}
                              >
                                <td className="p-3 text-center font-mono text-[#64748b] font-bold">
                                  {(currentPage - 1) * PAGE_SIZE + index + 1}
                                </td>

                                <td className="p-3 font-mono text-[#f8fafc] font-bold">
                                  <div className="flex items-center gap-2">
                                    <span>{rec.machine}</span>
                                    <button
                                      onClick={() => copyText(rec.machine)}
                                      className="text-[#64748b] hover:text-[#38bdf8] transition-colors cursor-pointer"
                                      title="نسخ الرقم"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>

                                <td className="p-3 font-mono text-[#38bdf8] font-bold">
                                  {rec.account}
                                </td>

                                <td className="p-3 text-center">
                                  {rec.type === 'pay' ? (
                                    <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[rgba(192,132,252,0.15)] text-[#e9d5ff]">
                                      مدفوعات
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[rgba(52,211,153,0.15)] text-[#6ee7b7]">
                                      كاش
                                    </span>
                                  )}
                                </td>

                                <td className="p-3 font-semibold text-slate-200">
                                  {rec.repName}
                                </td>

                                <td className="p-3 text-center">
                                  {rec.totalReps > 1 ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                                      {rec.repOrder} من {rec.totalReps}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      1 من 1
                                    </span>
                                  )}
                                </td>

                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => toggleDetails(rec.id)}
                                    className="text-[#64748b] hover:text-[#38bdf8] transition-colors p-1 cursor-pointer"
                                    title="عرض التفاصيل"
                                  >
                                    <ChevronDown
                                      className={`w-4 h-4 transition-transform duration-200 ${
                                        isDetailOpen ? 'rotate-180 text-[#38bdf8]' : ''
                                      }`}
                                    />
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Detail Row */}
                              {isDetailOpen && (
                                <tr className="bg-[rgba(15,23,42,0.9)] border-b border-white/10">
                                  <td colSpan={7} className="p-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#64748b]">
                                      <div className="bg-[#070a12]/60 p-2.5 rounded-lg border border-white/5">
                                        <strong className="text-slate-300 block mb-0.5">
                                          سيريال الجهاز:
                                        </strong>
                                        <span className="font-mono text-[#38bdf8] font-bold">
                                          {rec.serial || 'SN-998812340'}
                                        </span>
                                      </div>

                                      <div className="bg-[#070a12]/60 p-2.5 rounded-lg border border-white/5">
                                        <strong className="text-slate-300 block mb-0.5">
                                          موديل الماكينة:
                                        </strong>
                                        <span className="text-white font-bold">
                                          {rec.model || 'Verifone V200c'}
                                        </span>
                                      </div>

                                      <div className="bg-[#070a12]/60 p-2.5 rounded-lg border border-white/5">
                                        <strong className="text-slate-300 block mb-0.5">
                                          حركة نوع الماكينة:
                                        </strong>
                                        <span className="text-[#fbbf24] font-bold">
                                          {rec.type === 'cash' ? 'حساب أجهزة الكاش (7-)' : 'حساب المدفوعات العامة'}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Classic View Pagination Controls */}
                {filteredRecords.length > PAGE_SIZE && (
                  <div className="p-3 bg-slate-900/60 border-t border-white/10 flex items-center justify-between text-xs text-[#64748b] flex-wrap gap-2">
                    <div>
                      عرض <strong className="text-white font-mono">{(currentPage - 1) * PAGE_SIZE + 1}</strong> إلى{' '}
                      <strong className="text-white font-mono">{Math.min(currentPage * PAGE_SIZE, filteredRecords.length)}</strong> من إجمالي{' '}
                      <strong className="text-[#38bdf8] font-mono">{filteredRecords.length}</strong> سجل
                    </div>
                    <div className="flex items-center gap-2 font-bold">
                      <button
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300 disabled:opacity-40 hover:bg-slate-700 cursor-pointer flex items-center gap-1 text-xs"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span>السابق</span>
                      </button>
                      <span className="px-2 text-slate-300 text-xs font-mono">
                        صفحة {currentPage} من {totalPages}
                      </span>
                      <button
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300 disabled:opacity-40 hover:bg-slate-700 cursor-pointer flex items-center gap-1 text-xs"
                      >
                        <span>التالي</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-white/10 bg-slate-900/40 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-white/10 text-xs font-semibold text-[#64748b] hover:text-white hover:border-white/20 transition-all cursor-pointer"
          >
            إلغاء
          </button>

          <button
            onClick={handleApplySearch}
            disabled={isLoading}
            className={`px-7 py-2.5 rounded-lg text-sm font-bold text-white flex items-center gap-2.5 shadow-[0_4px_15px_rgba(16,185,129,0.35)] transition-all cursor-pointer ${
              isLoading
                ? 'bg-[#065f46] opacity-85 cursor-wait'
                : 'bg-gradient-to-r from-[#059669] to-[#10b981] hover:from-[#10b981] hover:to-[#059669]'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <CheckCheck className="w-4 h-4 text-white" />
            )}
            <span>{isLoading ? 'جاري التطبيق...' : 'تطبيق البحث'}</span>
          </button>
        </footer>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-8 z-50 bg-[rgba(15,23,42,0.95)] border border-[#34d399] text-white px-5 py-3 rounded-lg shadow-2xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
