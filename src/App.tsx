import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  FileCheck,
  FileSpreadsheet,
  Download,
  Sliders,
  CheckCheck,
  ArrowRight,
  Search,
  Users,
  UserCheck,
  CircleAlert,
  TableProperties,
  ArrowDown,
  UserX,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Zap,
  CheckCircle2,
  X,
  User,
  FileCode,
  Calculator,
  Eye,
  Split,
  Info,
  Upload,
} from 'lucide-react';
import { SheetRow, ExpandedRow, MachineSummary, DuplicateAuditItem, IrregularAccountItem } from './types';
import { parseExcelFile, downloadTemplateFile, exportReconciliationToExcel, exportReconciliationToCsv } from './utils/excel';
import { chunkCache } from './utils/chunkCache';
import { approveSheetWithWorker, processFileWithWorker } from './utils/workerClient';
import { DesktopHeader } from './components/DesktopHeader';
import { DesktopAppCenterModal } from './components/DesktopAppCenterModal';
import { ManualEditorModal } from './components/ManualEditorModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { RepLookupModal } from './components/RepLookupModal';
import { BigFileSplitterModal } from './components/BigFileSplitterModal';
import { AuditConflictsTab } from './components/AuditConflictsTab';
import { BulkActionBar } from './components/BulkActionBar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DesktopAppTab } from './components/DesktopAppTab';
import { ProgressModal } from './components/ProgressModal';
import { isZipFile, inspectZipFile, extractFileFromZip, ZipFileInfo } from './utils/zip';
import { ZipFilePickerModal } from './components/ZipFilePickerModal';
import { CompressionTipsModal } from './components/CompressionTipsModal';
import { InstantRepInquiry } from './components/InstantRepInquiry';

function normalizeMachineId(id: string | number | undefined | null): string {
  if (id === undefined || id === null) return '';
  if (typeof id === 'number') return Number.isInteger(id) ? String(id) : String(id).replace(/\.0$/, '');
  let clean = String(id).trim();
  if (clean.length === 0) return '';

  // Ultra-fast path: if purely ASCII digits (0-9), return instantly without regex!
  let isPureAsciiDigits = true;
  for (let i = 0; i < clean.length; i++) {
    const c = clean.charCodeAt(i);
    if (c < 48 || c > 57) {
      isPureAsciiDigits = false;
      break;
    }
  }
  if (isPureAsciiDigits) return clean;

  // Hidden unicode zero-width characters check
  if (clean.charCodeAt(0) === 8203 || clean.includes('\u200B') || clean.includes('\uFEFF') || clean.includes('\u00A0')) {
    clean = clean.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
  }

  // Remove "7-" or "٧-" prefixes
  if (clean.startsWith('7-') || clean.startsWith('٧-')) {
    clean = clean.substring(2).trim();
  }

  // Convert Eastern Arabic digits (٠-٩) only if present
  if (/[٠-٩]/.test(clean)) {
    clean = clean.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  }

  // Remove trailing .0 from float string representation (e.g. 1001.0 -> 1001)
  if (clean.endsWith('.0')) {
    clean = clean.substring(0, clean.length - 2);
  }
  return clean;
}

export default function App() {
  // Theme state with localStorage persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
    } catch (e) {}
    return true; // Default dark
  });

  // Tab state (1 to 5)
  const [currentTab, setCurrentTab] = useState<number>(1);

  // Modals state
  const [isDesktopCenterOpen, setIsDesktopCenterOpen] = useState(false);
  const [isManualEditorOpen, setIsManualEditorOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isRepLookupOpen, setIsRepLookupOpen] = useState(false);
  const [isSplitterOpen, setIsSplitterOpen] = useState(false);
  const [splitterDefaultType, setSplitterDefaultType] = useState<'payments' | 'cash'>('payments');
  const [repLookupQuery, setRepLookupQuery] = useState('');
  const [editorInitialMode, setEditorInitialMode] = useState<1 | 2>(1);

  // Floating Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Sheets data (1: Machines, 2: Payments, 3: Cash)
  const [sheet1, setSheet1] = useState<SheetRow[]>([]);
  const [sheet2, setSheet2] = useState<SheetRow[]>([]);
  const [sheet3, setSheet3] = useState<SheetRow[]>([]);
  const [sheet1FileName, setSheet1FileName] = useState<string>('');
  const [sheet2FileName, setSheet2FileName] = useState<string>('');
  const [sheet3FileName, setSheet3FileName] = useState<string>('');
  const [sheet2TotalCount, setSheet2TotalCount] = useState<number>(0);
  const [sheet3TotalCount, setSheet3TotalCount] = useState<number>(0);

  const effectiveSheet2Count = sheet2TotalCount > 0 ? sheet2TotalCount : sheet2.length;
  const effectiveSheet3Count = sheet3TotalCount > 0 ? sheet3TotalCount : sheet3.length;

  // Upload card interactive states & refs
  const [isSheet1Loading, setIsSheet1Loading] = useState<boolean>(false);
  const [isSheet2Loading, setIsSheet2Loading] = useState<boolean>(false);
  const [isSheet3Loading, setIsSheet3Loading] = useState<boolean>(false);
  const [isDragging1, setIsDragging1] = useState<boolean>(false);
  const [isDragging2, setIsDragging2] = useState<boolean>(false);
  const [isDragging3, setIsDragging3] = useState<boolean>(false);
  const sheet1InputRef = useRef<HTMLInputElement>(null);
  const sheet2InputRef = useRef<HTMLInputElement>(null);
  const sheet3InputRef = useRef<HTMLInputElement>(null);
  const isReconcilingRef = useRef<boolean>(false);

  // Column mapping (Machines, Payments, Cash)
  const [colM1, setColM1] = useState<string>('');
  const [colM2, setColM2] = useState<string>('');
  const [colAcc, setColAcc] = useState<string>('');
  const [colRep, setColRep] = useState<string>('');
  const [colM3, setColM3] = useState<string>('');
  const [colCashAcc, setColCashAcc] = useState<string>('');
  const [colCashRep, setColCashRep] = useState<string>('');
  const [emptyRepFallback, setEmptyRepFallback] = useState<string>('لا يوجد مسؤول');

  // Reconciliation results
  const [machinesResults, setMachinesResults] = useState<MachineSummary[]>([]);
  const [expandedRows, setExpandedRows] = useState<ExpandedRow[]>([]);

  // Filtering & Pagination
  const [currentFilter, setCurrentFilter] = useState<'all' | 'single' | 'multi' | 'none'>('all');
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'cash' | 'payments'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'split'>('cards'); // Default to vibrant Cards & Boxes view
  const [splitSelectedMachine, setSplitSelectedMachine] = useState<string>('');
  const pageSize = 50;
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Bulk actions selection
  const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set());
  const [sheet1PreviewFilter, setSheet1PreviewFilter] = useState<'all' | 'cash' | 'payments'>('all');
  const [sheet1Counts, setSheet1Counts] = useState({ total: 0, cash: 0, payments: 0 });
  const [reconciliationCounts, setReconciliationCounts] = useState({
    singleCount: 0,
    multiCount: 0,
    multiRowsCount: 0,
    noneCount: 0,
    cashRowsCount: 0,
    paymentsRowsCount: 0,
  });

  // Audits
  const [duplicates, setDuplicates] = useState<DuplicateAuditItem[]>([]);
  const [irregulars, setIrregulars] = useState<IrregularAccountItem[]>([]);

  // Progress modal state matching screenshot
  const [progressState, setProgressState] = useState<{
    isOpen: boolean;
    title: string;
    fileName: string;
    subtitle: string;
    percent: number;
    statusText: string;
    uploadedSheetType?: 'sheet1' | 'sheet2' | 'sheet3';
  }>({
    isOpen: false,
    title: 'قراءة',
    fileName: '',
    subtitle: 'جاري تحليل خلايا وسجلات ملف الإكسل...',
    percent: 0,
    statusText: '',
  });

  // ZIP Picker Modal & Compression Tips states
  const [appZipPicker, setAppZipPicker] = useState<{
    isOpen: boolean;
    zipFile: File | null;
    files: ZipFileInfo[];
    target: 'sheet1' | 'sheet2' | 'sheet3';
  }>({
    isOpen: false,
    zipFile: null,
    files: [],
    target: 'sheet2',
  });
  const [isCompressionTipsOpen, setIsCompressionTipsOpen] = useState(false);

  // Sync theme with HTML class
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light');
      } catch (e) {}
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      showToast(next ? '🌙 تم تفعيل الوضع الليلي' : '☀️ تم تفعيل الوضع النهاري');
      return next;
    });
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsDesktopCenterOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setEditorInitialMode(1);
        setIsManualEditorOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (expandedRows.length > 0) {
          handleExportExcel();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setCurrentTab(4);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setIsDesktopCenterOpen(false);
        setIsManualEditorOpen(false);
        setIsResetConfirmOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedRows]);

  // Auto-detect columns whenever sheets change
  useEffect(() => {
    if (sheet1.length > 0) {
      const cols1 = Object.keys(sheet1[0]);
      const foundM1 = cols1.find((c) => /ماكينة|جهاز|pos|machine|sn|id/i.test(c)) || cols1[0];
      setColM1(foundM1);
    }

    if (sheet2.length > 0) {
      const cols2 = Object.keys(sheet2[0]);
      const foundM2 =
        cols2.find((c) => /^(acceptor1|acceptor_1|acceptor 1|acceptor|ماكينة المدفوعات|ماكينه المدفوعات)$/i.test(c)) ||
        cols2.find((c) => /(acceptor.*1|^acceptor$|ماكين.*مدفوعات)/i.test(c)) ||
        cols2.find((c) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(c)) ||
        cols2[0];

      let foundAcc =
        cols2.find((c) => c !== foundM2 && /^(doner1|donor1|doner_1|donor_1|doner 1|donor 1|doner|donor|رقم حساب المدفوعات|حساب المدفوعات)$/i.test(c)) ||
        cols2.find((c) => c !== foundM2 && /(doner.*1|donor.*1|^doner$|^donor$|حساب.*مدفوعات|رقم.*المدفوعات)/i.test(c)) ||
        cols2.find((c) => c !== foundM2 && /حساب|كود|رقم.*مندوب|account|acc|code|doner|donor/i.test(c)) ||
        cols2.find((c) => c !== foundM2) ||
        '';

      let foundRep = cols2.find((c) => /اسم.*مندوب|اسم.*العميل|اسم.*المستخدم|اسم|rep.*name|agent.*name|name/i.test(c));
      if (!foundRep) {
        foundRep = cols2.find((c) => /(مندوب|agent|rep)/i.test(c) && !/(رقم|حساب|كود|acc|code|id)/i.test(c));
      }
      if (!foundRep) {
        foundRep =
          cols2.find((c) => /(doner.*1|donor.*1|doner1|donor1|^doner$|^donor$)/i.test(c)) ||
          cols2.find((c) => /(مندوب|agent|rep|doner|donor)/i.test(c)) ||
          foundAcc;
      }

      setColM2(foundM2);
      setColAcc(foundAcc);
      setColRep(foundRep);
    }

    if (sheet3.length > 0) {
      const cols3 = Object.keys(sheet3[0]);
      // Specifically prioritize acceptor2 (رقم ماكينه الكاش)
      const foundM3 =
        cols3.find((c) => /^(acceptor2|acceptor_2|acceptor 2|رقم ماكينه الكاش|ماكينه الكاش|ماكينة الكاش)$/i.test(c)) ||
        cols3.find((c) => /(acceptor.*2|ماكين.*كاش|ماكينة.*الكاش)/i.test(c)) ||
        cols3.find((c) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(c)) ||
        cols3[0];

      // Specifically prioritize doner2 (رقم الكاش المدفوعات / رقم حساب الكاش)
      let foundCashAcc =
        cols3.find((c) => c !== foundM3 && /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2|رقم الكاش المدفوعات|رقم الكاش|حساب الكاش|رقم المندوب الكاش)$/i.test(c)) ||
        cols3.find((c) => c !== foundM3 && /(doner.*2|donor.*2|كاش.*مدفوعات|رقم.*الكاش|حساب.*الكاش)/i.test(c)) ||
        cols3.find((c) => c !== foundM3 && /حساب|كود|رقم.*مندوب|account|acc|code|doner|donor/i.test(c)) ||
        cols3.find((c) => c !== foundM3) ||
        '';

      let foundCashRep = cols3.find((c) => /اسم.*مندوب|اسم.*العميل|اسم.*المستخدم|اسم|rep.*name|agent.*name|name/i.test(c));
      if (!foundCashRep) {
        foundCashRep = cols3.find((c) => /(مندوب|agent|rep)/i.test(c) && !/(رقم|حساب|كود|acc|code|id)/i.test(c));
      }
      if (!foundCashRep) {
        foundCashRep =
          cols3.find((c) => /(doner.*2|donor.*2|doner2|donor2)/i.test(c)) ||
          cols3.find((c) => /(مندوب|agent|rep|doner|donor)/i.test(c)) ||
          foundCashAcc;
      }

      setColM3(foundM3);
      setColCashAcc(foundCashAcc);
      setColCashRep(foundCashRep);
    }
  }, [sheet1, sheet2, sheet3]);

  // Core Reconciliation Engine (Supports Sheet 1: Machines, Sheet 2: Payments, Sheet 3: Cash)
  const executeReconciliation = async (
    s1: SheetRow[],
    s2: SheetRow[],
    s3: SheetRow[],
    m1Name: string,
    m2Name: string,
    accName: string,
    repNameCol: string,
    m3Name: string,
    cashAccName: string,
    cashRepNameCol: string,
    fallbackVal = emptyRepFallback
  ) => {
    const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));
    const repMap = new Map<string, Array<{ account: string; name: string; isMissingRepName: boolean; type: 'payment' | 'cash' }>>();
    const irregularsList: IrregularAccountItem[] = [];

    // Resolve effective column names for Sheet 1, Sheet 2, Sheet 3
    const s1Sample = s1[0] || {};
    const effectiveM1 = m1Name && s1Sample[m1Name] !== undefined
      ? m1Name
      : Object.keys(s1Sample).find((k) => /ماكينة|جهاز|pos|machine|sn|id/i.test(k)) || Object.keys(s1Sample)[0] || '';

    const s2Sample = s2[0] || {};
    const s2Keys = Object.keys(s2Sample);
    const effectiveM2 = m2Name && s2Sample[m2Name] !== undefined
      ? m2Name
      : s2Keys.find((k) => /^(acceptor1|acceptor_1|acceptor 1|acceptor|ماكينة المدفوعات|ماكينه المدفوعات)$/i.test(k))
        || s2Keys.find((k) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(k))
        || s2Keys.find((k) => /^(doner1|donor1)$/i.test(k))
        || s2Keys[0] || '';

    const effectiveAcc = accName && s2Sample[accName] !== undefined
      ? accName
      : s2Keys.find((k) => /^(acceptor1|acceptor_1|acceptor 1)$/i.test(k))
        || s2Keys.find((k) => /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2)$/i.test(k))
        || s2Keys.find((k) => /^(doner1|donor1|doner_1|donor_1|doner 1|donor 1|doner|donor|رقم حساب المدفوعات|حساب المدفوعات)$/i.test(k))
        || s2Keys.find((k) => /حساب|كود|رقم.*مندوب|account|acc|code|doner|donor/i.test(k))
        || s2Keys[0] || '';

    const effectiveRep = repNameCol && s2Sample[repNameCol] !== undefined
      ? repNameCol
      : s2Keys.find((k) => /^(doner1|donor1|doner_1|donor_1|doner 1|donor 1)$/i.test(k))
        || s2Keys.find((k) => /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2)$/i.test(k))
        || s2Keys.find((k) => /اسم.*مندوب|اسم.*العميل|اسم.*المستخدم|اسم|rep.*name|agent.*name|name/i.test(k))
        || effectiveAcc
        || s2Keys[1] || s2Keys[0] || '';

    const s3Sample = s3[0] || {};
    const s3Keys = Object.keys(s3Sample);
    const effectiveM3 = m3Name && s3Sample[m3Name] !== undefined
      ? m3Name
      : s3Keys.find((k) => /^(acceptor2|acceptor_2|acceptor 2|رقم ماكينه الكاش|ماكينه الكاش|ماكينة الكاش)$/i.test(k))
        || s3Keys.find((k) => /^(acceptor1|acceptor_1|acceptor 1)$/i.test(k))
        || s3Keys.find((k) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(k))
        || s3Keys[0] || '';

    const effectiveCashAcc = cashAccName && s3Sample[cashAccName] !== undefined
      ? cashAccName
      : s3Keys.find((k) => /^(رقم الكاش المدفوعات|رقم الكاش|حساب الكاش)$/i.test(k))
        || s3Keys.find((k) => /^(acceptor2|acceptor_2|acceptor 2)$/i.test(k))
        || s3Keys.find((k) => /حساب|كود|account|acc|code/i.test(k))
        || s3Keys[1] || s3Keys[0] || '';

    const effectiveCashRep = cashRepNameCol && s3Sample[cashRepNameCol] !== undefined
      ? cashRepNameCol
      : s3Keys.find((k) => /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2)$/i.test(k))
        || s3Keys.find((k) => /اسم.*مندوب|اسم.*العميل|اسم.*المستخدم|اسم|rep.*name|agent.*name|name/i.test(k))
        || effectiveCashAcc
        || s3Keys[1] || s3Keys[0] || '';

    // Process Sheet 2 (Payments)
    const paymentsRepMap = new Map<string, Array<{ account: string; name: string; isMissingRepName: boolean; type: 'payment' }>>();

    for (let i = 0; i < s2.length; i++) {
      if (i > 0 && i % 20000 === 0) {
        setProgressState((p) => ({
          ...p,
          percent: Math.min(50, 15 + Math.round((i / (s2.length || 1)) * 35)),
          statusText: `فهرسة سجلات المدفوعات (${i.toLocaleString('ar-EG')} من ${s2.length.toLocaleString('ar-EG')})...`,
        }));
        await yieldToMain();
      }
      const row = s2[i];
      const rawM = row[effectiveM2];
      if (rawM !== undefined && rawM !== null && rawM !== '') {
        const rawMStr = String(rawM).trim();
        const key = normalizeMachineId(rawMStr);
        const rawRepName = row[effectiveRep];
        const isRepNameEmpty =
          rawRepName === undefined ||
          rawRepName === null ||
          String(rawRepName).trim() === '' ||
          String(rawRepName).trim() === '-' ||
          String(rawRepName).trim() === 'null';

        const repAcc =
          effectiveAcc && row[effectiveAcc] !== undefined && row[effectiveAcc] !== ''
            ? String(row[effectiveAcc]).trim()
            : 'غير متوفر';

        const repName = isRepNameEmpty
          ? (repAcc !== 'غير متوفر' ? `مندوب (${repAcc})` : fallbackVal)
          : String(rawRepName).trim();

        if (irregularsList.length < 500 && repAcc !== 'غير متوفر') {
          let isPure = true;
          for (let c = 0; c < repAcc.length; c++) {
            const code = repAcc.charCodeAt(c);
            if (code < 48 || code > 57) { isPure = false; break; }
          }
          if (!isPure || repAcc.length < 2) {
            const hasSpaces = repAcc.includes(' ');
            const hasSpecialChars = /[^0-9\-_]/i.test(repAcc);
            const isUnusuallyShort = repAcc.length < 2;
            if (hasSpecialChars || hasSpaces || isUnusuallyShort) {
              irregularsList.push({
                machine: rawMStr,
                account: repAcc,
                repName,
                reason: hasSpaces ? 'يحتوي على مسافات (مدفوعات)' : hasSpecialChars ? 'يحتوي على رموز/حروف (مدفوعات)' : 'قصير جداً',
              });
            }
          }
        }

        let list = paymentsRepMap.get(key);
        if (!list) {
          list = [];
          paymentsRepMap.set(key, list);
        }
        list.push({
          account: repAcc,
          name: repName,
          isMissingRepName: isRepNameEmpty && repAcc === 'غير متوفر',
          type: 'payment',
        });
      }
    }

    // Process Sheet 3 (Cash)
    const cashRepMap = new Map<string, Array<{ account: string; name: string; isMissingRepName: boolean; type: 'cash' }>>();

    for (let i = 0; i < s3.length; i++) {
      if (i > 0 && i % 20000 === 0) {
        setProgressState((p) => ({
          ...p,
          percent: Math.min(75, 50 + Math.round((i / (s3.length || 1)) * 25)),
          statusText: `فهرسة سجلات الكاش (${i.toLocaleString('ar-EG')} من ${s3.length.toLocaleString('ar-EG')})...`,
        }));
        await yieldToMain();
      }
      const row = s3[i];
      const rawM = row[effectiveM3];
      if (rawM !== undefined && rawM !== null && rawM !== '') {
        const rawMStr = String(rawM).trim();
        const key = normalizeMachineId(rawMStr);
        const rawRepName = row[effectiveCashRep];
        const isRepNameEmpty =
          rawRepName === undefined ||
          rawRepName === null ||
          String(rawRepName).trim() === '' ||
          String(rawRepName).trim() === '-' ||
          String(rawRepName).trim() === 'null';

        const repAcc =
          effectiveCashAcc && row[effectiveCashAcc] !== undefined && row[effectiveCashAcc] !== ''
            ? String(row[effectiveCashAcc]).trim()
            : 'غير متوفر';

        const repName = isRepNameEmpty
          ? (repAcc !== 'غير متوفر' ? `مسؤول كاش (${repAcc})` : fallbackVal)
          : String(rawRepName).trim();

        if (irregularsList.length < 500 && repAcc !== 'غير متوفر') {
          let isPure = true;
          for (let c = 0; c < repAcc.length; c++) {
            const code = repAcc.charCodeAt(c);
            if (code < 48 || code > 57) { isPure = false; break; }
          }
          if (!isPure || repAcc.length < 2) {
            const hasSpaces = repAcc.includes(' ');
            const hasSpecialChars = /[^0-9\-_]/i.test(repAcc);
            const isUnusuallyShort = repAcc.length < 2;
            if (hasSpecialChars || hasSpaces || isUnusuallyShort) {
              irregularsList.push({
                machine: rawMStr,
                account: repAcc,
                repName,
                reason: hasSpaces ? 'يحتوي على مسافات (كاش)' : hasSpecialChars ? 'يحتوي على رموز/حروف (كاش)' : 'قصير جداً',
              });
            }
          }
        }

        let list = cashRepMap.get(key);
        if (!list) {
          list = [];
          cashRepMap.set(key, list);
        }
        list.push({
          account: repAcc,
          name: repName,
          isMissingRepName: isRepNameEmpty && repAcc === 'غير متوفر',
          type: 'cash',
        });
      }
    }

    // Fast Single-Pass Audit duplicates in Sheet 1
    const seenMachines = new Set<string>();
    const dupSet = new Set<string>();
    const duplicateList: DuplicateAuditItem[] = [];
    const maxScanDup = Math.min(s1.length, 50000);
    for (let i = 0; i < maxScanDup; i++) {
      const row = s1[i];
      const m = row[effectiveM1];
      if (m !== undefined && m !== null && m !== '') {
        const key = String(m).trim();
        if (seenMachines.has(key)) {
          if (!dupSet.has(key)) {
            dupSet.add(key);
            duplicateList.push({ machine: key, occurrences: 2 });
            if (duplicateList.length >= 1000) break;
          }
        } else {
          seenMachines.add(key);
        }
      }
    }

    // Generate sequential independent rows
    const summaries: MachineSummary[] = [];
    const flatRows: ExpandedRow[] = [];
    let rowCounter = 0;

    let sCount = 0;
    let mCount = 0;
    let mRowsCount = 0;
    let nCount = 0;
    let cRowsCount = 0;
    let pRowsCount = 0;

    // Build unified list of machines from s1 (keeping payments machines and cash machines distinct!)
    const processedKeys = new Set<string>();
    const reconciliationItems: Array<{ originalMachineId: string; machineType: 'payment' | 'cash'; row?: SheetRow; isSynthetic?: boolean }> = [];

    const hasExplicitCashInS1 = s1.some((r) => {
      const val = String(r[effectiveM1] || '').trim();
      return r._tabType === 'cash' || val.startsWith('7-') || val.startsWith('٧-');
    });

    for (let i = 0; i < s1.length; i++) {
      const row = s1[i];
      const mVal = row[effectiveM1];
      if (mVal !== undefined && mVal !== null && mVal !== '') {
        const rawMStr = String(mVal).trim();
        const normKey = normalizeMachineId(rawMStr);
        if (!normKey) continue;

        const isCash = row._tabType === 'cash' || rawMStr.startsWith('7-') || rawMStr.startsWith('٧-');

        if (isCash) {
          const itemKey = `cash:${normKey}`;
          if (!processedKeys.has(itemKey)) {
            processedKeys.add(itemKey);
            const displayId = rawMStr.startsWith('7-') || rawMStr.startsWith('٧-') ? rawMStr : `7-${normKey}`;
            reconciliationItems.push({ originalMachineId: displayId, machineType: 'cash', row });
          }
        } else {
          const payKey = `pay:${normKey}`;
          if (!processedKeys.has(payKey)) {
            processedKeys.add(payKey);
            reconciliationItems.push({ originalMachineId: normKey, machineType: 'payment', row });
          }

          if (!hasExplicitCashInS1 && s3.length > 0) {
            const cashKey = `cash:${normKey}`;
            if (!processedKeys.has(cashKey)) {
              processedKeys.add(cashKey);
              reconciliationItems.push({ originalMachineId: `7-${normKey}`, machineType: 'cash', row, isSynthetic: true });
            }
          }
        }
      }
    }

    if (s1.length === 0) {
      paymentsRepMap.forEach((_reps, lookupKey) => {
        const payKey = `pay:${lookupKey}`;
        if (!processedKeys.has(payKey)) {
          processedKeys.add(payKey);
          reconciliationItems.push({ originalMachineId: lookupKey, machineType: 'payment', isSynthetic: true });
        }
      });
      cashRepMap.forEach((_reps, lookupKey) => {
        const cashKey = `cash:${lookupKey}`;
        if (!processedKeys.has(cashKey)) {
          processedKeys.add(cashKey);
          reconciliationItems.push({ originalMachineId: `7-${lookupKey}`, machineType: 'cash', isSynthetic: true });
        }
      });
    }

    for (let itemIdx = 0; itemIdx < reconciliationItems.length; itemIdx++) {
      if (itemIdx > 0 && itemIdx % 20000 === 0) {
        setProgressState((p) => ({
          ...p,
          percent: Math.min(96, 75 + Math.round((itemIdx / (reconciliationItems.length || 1)) * 21)),
          statusText: `ربط ومطابقة الماكينات (${itemIdx.toLocaleString('ar-EG')} من ${reconciliationItems.length.toLocaleString('ar-EG')})...`,
        }));
        await yieldToMain();
      }
      const item = reconciliationItems[itemIdx];
      const originalMachineId = item.originalMachineId;
      const lookupKey = normalizeMachineId(originalMachineId);

      const reps = item.machineType === 'payment'
        ? (paymentsRepMap.get(lookupKey) || [])
        : (cashRepMap.get(lookupKey) || []);

      const count = reps.length;

      let status: 'single' | 'multi' | 'none' = 'none';
      if (count === 1) {
        status = 'single';
        sCount++;
      } else if (count > 1) {
        status = 'multi';
        mCount++;
      } else {
        nCount++;
      }

      if (summaries.length < 5000) {
        summaries.push({
          index: itemIdx + 1,
          machine: originalMachineId,
          repCount: count,
          reps,
          status,
        });
      }

      if (count === 0) {
        rowCounter++;
        if (item.machineType === 'cash') {
          cRowsCount++;
        } else {
          pRowsCount++;
        }

        flatRows.push({
          id: `r-${rowCounter}`,
          machine: originalMachineId,
          account: 'غير متوفر',
          repName: fallbackVal,
          repOrder: 0,
          totalRepsForMachine: 0,
          status: 'none',
          machineGroupIndex: itemIdx + 1,
          isFirstOfGroup: true,
          isLastOfGroup: true,
          isMissingRepName: true,
          type: item.machineType,
        });
      } else {
        for (let rIdx = 0; rIdx < count; rIdx++) {
          rowCounter++;
          const r = reps[rIdx];

          if (item.machineType === 'cash') {
            cRowsCount++;
          } else {
            pRowsCount++;
          }
          if (status === 'multi') {
            mRowsCount++;
          }

          flatRows.push({
            id: `r-${rowCounter}`,
            machine: originalMachineId,
            account: r.account,
            repName: r.name,
            repOrder: rIdx + 1,
            totalRepsForMachine: count,
            status,
            machineGroupIndex: itemIdx + 1,
            isFirstOfGroup: rIdx === 0,
            isLastOfGroup: rIdx === count - 1,
            isMissingRepName: r.isMissingRepName,
            type: item.machineType,
          });
        }
      }
    }

    setMachinesResults(summaries);
    setExpandedRows(flatRows);
    setDuplicates(duplicateList);
    setIrregulars(irregularsList);
    setReconciliationCounts({
      singleCount: sCount,
      multiCount: mCount,
      multiRowsCount: mRowsCount,
      noneCount: nCount,
      cashRowsCount: cRowsCount,
      paymentsRowsCount: pRowsCount,
    });
    setSelectedMachines(new Set());
    setCurrentPage(1);
  };

  // Start reconciliation from user action with progress modal
  const runReconciliation = async (
    overrideSheet1?: any,
    overrideSheet2?: any,
    overrideSheet3?: any,
    autoSwitchTab = true
  ) => {
    if (isReconcilingRef.current) return;
    const s1 = (Array.isArray(overrideSheet1) ? overrideSheet1 : null) || sheet1;
    const s2 = (Array.isArray(overrideSheet2) ? overrideSheet2 : null) || sheet2;
    const s3 = (Array.isArray(overrideSheet3) ? overrideSheet3 : null) || sheet3;

    if (!s1.length) {
      showToast('⚠️ يرجى رفع شيت الماكينات أولاً، أو اضغط على «عينة فورية».');
      return;
    }

    if (!s2.length && !s3.length) {
      showToast('⚠️ يرجى رفع شيت المدفوعات أو شيت الكاش للمطابقة مع شيت الماكينات.');
      return;
    }

    isReconcilingRef.current = true;
    setProgressState({
      isOpen: true,
      title: 'مطابقة وتوزيع السجلات',
      fileName: 'مقارنة الشيتات وربط الماكينات',
      subtitle: 'جاري مطابقة أرقام الماكينات بحسابات المناديب والكاش...',
      percent: 30,
      statusText: 'تحليل وفهرسة السجلات...',
    });

    try {
      await new Promise((r) => setTimeout(r, 20));
      setProgressState((p) => ({ ...p, percent: 60, statusText: 'بناء جدول النتائج والارتباطات...' }));
      await new Promise((r) => setTimeout(r, 20));

      const effectiveM1 = colM1 || (s1[0] ? (Object.keys(s1[0]).find((c) => /ماكينة|جهاز|pos|machine|sn|id/i.test(c)) || Object.keys(s1[0])[0]) : '');
      if (!colM1 && effectiveM1) setColM1(effectiveM1);

      const effectiveM2 = colM2 || (s2[0] ? (Object.keys(s2[0]).find((c) => /^(acceptor1|acceptor_1|acceptor 1|acceptor|ماكينة المدفوعات|ماكينه المدفوعات)$/i.test(c)) || Object.keys(s2[0])[0]) : '');
      const effectiveAcc = colAcc || (s2[0] ? (Object.keys(s2[0]).find((c) => /^(doner1|donor1|doner_1|donor_1|doner 1|donor 1|doner|donor|رقم حساب المدفوعات|حساب المدفوعات)$/i.test(c)) || Object.keys(s2[0])[1]) : '');
      const effectiveRep = colRep || effectiveAcc || (s2[0] ? Object.keys(s2[0])[0] : '');

      const effectiveM3 = colM3 || (s3[0] ? (Object.keys(s3[0]).find((c) => /^(acceptor2|acceptor_2|acceptor 2|رقم ماكينه الكاش|ماكينه الكاش|ماكينة الكاش)$/i.test(c)) || Object.keys(s3[0])[0]) : '');
      const effectiveCashAcc = colCashAcc || (s3[0] ? (Object.keys(s3[0]).find((c) => /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2|رقم الكاش المدفوعات|رقم الكاش|حساب الكاش)$/i.test(c)) || Object.keys(s3[0])[1]) : '');
      const effectiveCashRep = colCashRep || effectiveCashAcc || (s3[0] ? Object.keys(s3[0])[0] : '');

      await executeReconciliation(s1, s2, s3, effectiveM1, effectiveM2, effectiveAcc, effectiveRep, effectiveM3, effectiveCashAcc, effectiveCashRep, emptyRepFallback);

      setProgressState((p) => ({ ...p, percent: 100, statusText: 'اكتملت المطابقة والتوزيع بنجاح!' }));
      await new Promise((r) => setTimeout(r, 200));
      setProgressState((p) => ({ ...p, isOpen: false }));

      if (autoSwitchTab) {
        showToast('⚡ تم تحديث ومطابقة البيانات بنجاح!');
        setCurrentTab(5);
      }
    } catch (err: any) {
      setProgressState((p) => ({ ...p, isOpen: false }));
      showToast(`❌ حدث خطأ أثناء المطابقة: ${err?.message || 'يرجى المحاولة مرة أخرى.'}`);
    } finally {
      isReconcilingRef.current = false;
    }
  };

  // Confirm and take action when clicking "موافق (إتمام)" - Simply closes the modal immediately with zero freeze
  const handleProgressModalConfirm = () => {
    setProgressState((p) => ({ ...p, isOpen: false }));
  };

  // Helper to get Sheet 1 (strictly does not auto-populate Sheet 1 from Payments or Cash)
  const ensureSheet1Exists = (_currentData: SheetRow[], _mCol: string) => {
    return sheet1;
  };

  // Handle Sheet 1 upload
  const handleSheet1Upload = async (file: File) => {
    // 1. Check if uploaded file is a ZIP archive
    if (isZipFile(file)) {
      try {
        const items = await inspectZipFile(file);
        const supported = items.filter((f) => f.isSupportedSheet);
        if (supported.length === 0) {
          showToast('⚠️ لم يتم العثور على أي ملفات جداول CSV أو Excel متوافقة داخل أرشيف ZIP.');
          return;
        }
        if (supported.length > 1) {
          setAppZipPicker({
            isOpen: true,
            zipFile: file,
            files: items,
            target: 'sheet1',
          });
          return;
        }
        if (supported[0]?.path !== '__DIRECT_XLSX__') {
          const extracted = await extractFileFromZip(file, supported[0].path);
          file = extracted;
        }
      } catch (err: any) {
        showToast('❌ تعذر فحص أو فك ضغط ملف ZIP: ' + (err?.message || ''));
        return;
      }
    }

    setIsSheet1Loading(true);
    setProgressState({
      isOpen: true,
      title: 'شيت الماكينات',
      fileName: file.name,
      subtitle: 'جاري تحميل ومعالجة بيانات شيت الماكينات بأقصى سرعة...',
      percent: 0,
      statusText: 'فتح وتحميل وقراءة الملف مباشرة...',
      uploadedSheetType: 'sheet1',
    });

    try {
      const data = await processFileWithWorker(file, 'machines', (pct, text) => {
        setProgressState({
          isOpen: true,
          title: 'شيت الماكينات',
          fileName: file.name,
          subtitle: 'جاري تحميل ومعالجة بيانات شيت الماكينات بأقصى سرعة...',
          percent: pct,
          statusText: text || 'تحميل ومعالجة البيانات بسرعة فائقة في المسار الخلفي...',
          uploadedSheetType: 'sheet1',
        });
      });
      if (!data || data.length === 0) {
        setIsSheet1Loading(false);
        setProgressState((p) => ({ ...p, isOpen: false }));
        showToast('⚠️ لم يتم العثور على أسطر بيانات صالحة في «' + file.name + '». يرجى التأكد من محتوى الملف.');
        return;
      }

      setIsSheet1Loading(false);
      const cols1 = Object.keys(data[0] || {});
      const activeM1 = cols1.find((c) => /ماكينة|جهاز|pos|machine|sn|id/i.test(c)) || cols1[0] || '';
      if (activeM1) setColM1(activeM1);

      let cash = 0;
      let payments = 0;
      const mCol = activeM1 || colM1 || (data[0] ? Object.keys(data[0])[0] : '');
      if (mCol && data) {
        const len = data.length;
        for (let i = 0; i < len; i++) {
          const r = data[i];
          if (r) {
            const rawVal = r[mCol];
            const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
            const c = strVal.charCodeAt(0);
            const isCash =
              r._tabType === 'cash' ||
              c === 55 ||
              c === 1639 ||
              strVal.startsWith('7-') ||
              strVal.startsWith('٧-') ||
              strVal.startsWith('7') ||
              strVal.startsWith('٧') ||
              Object.values(r).some((v) => /كاش|cash/i.test(String(v)));

            if (isCash) {
              cash++;
              r._tabType = 'cash';
            } else {
              payments++;
              if (!r._tabType || r._tabType === 'machines') {
                r._tabType = 'payments';
              }
            }
          }
        }
      }
      setSheet1Counts({
        total: data.length,
        cash,
        payments: data.length - cash,
      });

      setSheet1(data);
      setSheet1FileName(file.name);
      setProgressState((p) => ({
        ...p,
        percent: 100,
        statusText: `اكتمل استخراج ${data.length.toLocaleString('ar-EG')} ماكينة بنجاح!`,
      }));
      showToast(`✅ تم رفع شيت الماكينات بنجاح: ${data.length.toLocaleString('ar-EG')} ماكينة (${file.name})`);
    } catch (err: any) {
      console.error(err);
      setIsSheet1Loading(false);
      setProgressState((p) => ({ ...p, isOpen: false }));
      showToast(`❌ تعذر قراءة الملف: ${err?.message || 'يرجى التأكد من صيغة Excel أو CSV.'}`);
    }
  };

  // Handle Sheet 2 upload (Payments Sheet)
  const handleSheet2Upload = async (file: File) => {
    // 1. Check if uploaded file is a ZIP archive
    if (isZipFile(file)) {
      try {
        const items = await inspectZipFile(file);
        const supported = items.filter((f) => f.isSupportedSheet);
        if (supported.length === 0) {
          showToast('⚠️ لم يتم العثور على أي ملفات جداول CSV أو Excel متوافقة داخل أرشيف ZIP.');
          return;
        }
        if (supported.length > 1) {
          setAppZipPicker({
            isOpen: true,
            zipFile: file,
            files: items,
            target: 'sheet2',
          });
          return;
        }
        if (supported[0]?.path !== '__DIRECT_XLSX__') {
          const extracted = await extractFileFromZip(file, supported[0].path);
          file = extracted;
        }
      } catch (err: any) {
        showToast('❌ تعذر فحص أو فك ضغط ملف ZIP: ' + (err?.message || ''));
        return;
      }
    }

    setIsSheet2Loading(true);
    setProgressState({
      isOpen: true,
      title: 'شيت المدفوعات',
      fileName: file.name,
      subtitle: 'جاري تحميل ومعالجة بيانات شيت المدفوعات بأقصى سرعة...',
      percent: 0,
      statusText: 'فتح وتحميل وقراءة الملف مباشرة...',
      uploadedSheetType: 'sheet2',
    });

    try {
      const data = await processFileWithWorker(file, 'payments', (pct, text) => {
        setProgressState({
          isOpen: true,
          title: 'شيت المدفوعات',
          fileName: file.name,
          subtitle: 'جاري تحميل وقراءة بيانات شيت المدفوعات في المسار الخلفي...',
          percent: Math.min(80, pct),
          statusText: text || 'تحميل ومعالجة البيانات بسرعة فائقة في المسار الخلفي...',
          uploadedSheetType: 'sheet2',
        });
      });

      if (!data || data.length === 0) {
        setIsSheet2Loading(false);
        setProgressState((p) => ({ ...p, isOpen: false }));
        showToast(`⚠️ لم يتم العثور على أسطر بيانات صالحة في «${file.name}». يرجى التأكد من محتوى الملف.`);
        return;
      }

      // Perform background approval, column detection, auto-machine indexing in Worker
      const res = await approveSheetWithWorker(
        data,
        'payments',
        sheet1.length,
        (pct, text) => {
          setProgressState((prev) => ({
            ...prev,
            percent: Math.min(98, 80 + Math.round((pct / 100) * 18)),
            statusText: text || 'اعتماد وتثبيت البيانات في الذاكرة...',
          }));
        }
      );

      setIsSheet2Loading(false);

      if (res.detectedCols.activeM) setColM2(res.detectedCols.activeM);
      if (res.detectedCols.activeAcc) setColAcc(res.detectedCols.activeAcc);
      if (res.detectedCols.activeRep) setColRep(res.detectedCols.activeRep);

      // Save complete rows in smart memory cache, and store 50-row preview in React state
      chunkCache.setRows('sheet2', data);
      setSheet2(res.previewRows);
      setSheet2TotalCount(res.totalCount);
      setSheet2FileName(file.name);

      setProgressState((p) => ({
        ...p,
        percent: 100,
        statusText: `اكتمل اعتماد وتثبيت ${res.totalCount.toLocaleString('ar-EG')} سجل بنجاح في الذاكرة الذكية!`,
      }));
      showToast(`✅ تم رفع واعتماد شيت المدفوعات بنجاح: ${res.totalCount.toLocaleString('ar-EG')} سجل من ملف «${file.name}»`);
    } catch (err: any) {
      console.error(err);
      setIsSheet2Loading(false);
      setProgressState((p) => ({ ...p, isOpen: false }));
      showToast(`❌ تعذر قراءة شيت المدفوعات: ${err?.message || 'يرجى التأكد من صيغة الملف.'}`);
    }
  };

  // Handle Sheet 3 upload (Cash Sheet)
  const handleSheet3Upload = async (file: File) => {
    // 1. Check if uploaded file is a ZIP archive
    if (isZipFile(file)) {
      try {
        const items = await inspectZipFile(file);
        const supported = items.filter((f) => f.isSupportedSheet);
        if (supported.length === 0) {
          showToast('⚠️ لم يتم العثور على أي ملفات جداول CSV أو Excel متوافقة داخل أرشيف ZIP.');
          return;
        }
        if (supported.length > 1) {
          setAppZipPicker({
            isOpen: true,
            zipFile: file,
            files: items,
            target: 'sheet3',
          });
          return;
        }
        if (supported[0]?.path !== '__DIRECT_XLSX__') {
          const extracted = await extractFileFromZip(file, supported[0].path);
          file = extracted;
        }
      } catch (err: any) {
        showToast('❌ تعذر فحص أو فك ضغط ملف ZIP: ' + (err?.message || ''));
        return;
      }
    }

    setIsSheet3Loading(true);
    setProgressState({
      isOpen: true,
      title: 'شيت أجهزة الكاش',
      fileName: file.name,
      subtitle: 'جاري تحميل ومعالجة بيانات شيت الكاش بأقصى سرعة...',
      percent: 0,
      statusText: 'فتح وتحميل وقراءة الملف مباشرة...',
      uploadedSheetType: 'sheet3',
    });

    try {
      const data = await processFileWithWorker(file, 'cash', (pct, text) => {
        setProgressState({
          isOpen: true,
          title: 'شيت أجهزة الكاش',
          fileName: file.name,
          subtitle: 'جاري تحميل وقراءة بيانات شيت الكاش في المسار الخلفي...',
          percent: Math.min(80, pct),
          statusText: text || 'تحميل ومعالجة البيانات بسرعة فائقة في المسار الخلفي...',
          uploadedSheetType: 'sheet3',
        });
      });

      if (!data || data.length === 0) {
        setIsSheet3Loading(false);
        setProgressState((p) => ({ ...p, isOpen: false }));
        showToast(`⚠️ لم يتم العثور على أسطر بيانات صالحة في «${file.name}». يرجى التأكد من محتوى الملف.`);
        return;
      }

      // Perform background approval, column detection, auto-machine indexing in Worker
      const res = await approveSheetWithWorker(
        data,
        'cash',
        sheet1.length,
        (pct, text) => {
          setProgressState((prev) => ({
            ...prev,
            percent: Math.min(98, 80 + Math.round((pct / 100) * 18)),
            statusText: text || 'اعتماد وتثبيت البيانات في الذاكرة...',
          }));
        }
      );

      setIsSheet3Loading(false);

      if (res.detectedCols.activeM) setColM3(res.detectedCols.activeM);
      if (res.detectedCols.activeAcc) setColCashAcc(res.detectedCols.activeAcc);
      if (res.detectedCols.activeRep) setColCashRep(res.detectedCols.activeRep);

      // Save complete rows in smart memory cache, and store 50-row preview in React state
      chunkCache.setRows('sheet3', data);
      setSheet3(res.previewRows);
      setSheet3TotalCount(res.totalCount);
      setSheet3FileName(file.name);

      setProgressState((p) => ({
        ...p,
        percent: 100,
        statusText: `اكتمل اعتماد وتثبيت ${res.totalCount.toLocaleString('ar-EG')} جهاز بنجاح في الذاكرة الذكية!`,
      }));
      showToast(`✅ تم رفع واعتماد شيت أجهزة الكاش بنجاح: ${res.totalCount.toLocaleString('ar-EG')} جهاز من ملف «${file.name}»`);
    } catch (err: any) {
      console.error(err);
      setIsSheet3Loading(false);
      setProgressState((p) => ({ ...p, isOpen: false }));
      showToast(`❌ تعذر قراءة شيت أجهزة الكاش: ${err?.message || 'يرجى التأكد من صيغة الملف.'}`);
    }
  };

  // Instant Sheet Clear Handlers
  const handleClearSheet1 = () => {
    setIsSheet1Loading(false);
    setSheet1([]);
    setSheet1FileName('');
    setSheet1Counts({ total: 0, cash: 0, payments: 0 });
    if (sheet1InputRef.current) sheet1InputRef.current.value = '';
    if (sheet2.length === 0 && sheet3.length === 0) {
      setMachinesResults([]);
      setExpandedRows([]);
      setDuplicates([]);
      setIrregulars([]);
      setReconciliationCounts({
        singleCount: 0,
        multiCount: 0,
        multiRowsCount: 0,
        noneCount: 0,
        cashRowsCount: 0,
        paymentsRowsCount: 0,
      });
    }
    showToast('🗑️ تم حذف وإغلاق شيت الماكينات بنجاح');
  };

  const handleClearSheet2 = () => {
    setIsSheet2Loading(false);
    setSheet2([]);
    setSheet2TotalCount(0);
    setSheet2FileName('');
    chunkCache.clear('sheet2');
    if (sheet2InputRef.current) sheet2InputRef.current.value = '';
    if (sheet1.length === 0 && sheet3.length === 0) {
      setMachinesResults([]);
      setExpandedRows([]);
      setDuplicates([]);
      setIrregulars([]);
      setReconciliationCounts({
        singleCount: 0,
        multiCount: 0,
        multiRowsCount: 0,
        noneCount: 0,
        cashRowsCount: 0,
        paymentsRowsCount: 0,
      });
    }
    showToast('🗑️ تم حذف وإغلاق شيت المدفوعات بنجاح');
  };

  const handleClearSheet3 = () => {
    setIsSheet3Loading(false);
    setSheet3([]);
    setSheet3TotalCount(0);
    setSheet3FileName('');
    chunkCache.clear('sheet3');
    if (sheet3InputRef.current) sheet3InputRef.current.value = '';
    if (sheet1.length === 0 && sheet2.length === 0) {
      setMachinesResults([]);
      setExpandedRows([]);
      setDuplicates([]);
      setIrregulars([]);
      setReconciliationCounts({
        singleCount: 0,
        multiCount: 0,
        multiRowsCount: 0,
        noneCount: 0,
        cashRowsCount: 0,
        paymentsRowsCount: 0,
      });
    }
    showToast('🗑️ تم حذف وإغلاق شيت أجهزة الكاش بنجاح');
  };

  // Dedicated Inquiry sheets reset handler (clears Cash and Payments cache)
  const handleClearInquirySheets = () => {
    handleClearSheet2();
    handleClearSheet3();
    showToast('🗑️ تم مسح بيانات شيتات الكاش والمدفوعات من الذاكرة بنجاح');
  };

  // Instant Sample Demo
  const handleLoadSample = () => {
    const sample1: SheetRow[] = [
      { 'رقم الماكينة': 'POS-100', 'الفرع / المنطقة': 'القاهرة - المعادي' },
      { 'رقم الماكينة': 'POS-200', 'الفرع / المنطقة': 'الجيزة - الدقي' },
      { 'رقم الماكينة': 'POS-300', 'الفرع / المنطقة': 'الإسكندرية - سموحة' },
      { 'رقم الماكينة': 'POS-400', 'الفرع / المنطقة': 'المنصورة - المشاية' },
      { 'رقم الماكينة': 'POS-500', 'الفرع / المنطقة': 'طنطا - المحطة' },
      { 'رقم الماكينة': 'POS-600', 'الفرع / المنطقة': 'أسيوط - الجمهورية' },
      { 'رقم الماكينة': 'POS-100', 'الفرع / المنطقة': 'القاهرة - المعادي (تكرار)' },
    ];

    const sample2: SheetRow[] = [
      { 'رقم الماكينة': 'POS-100', 'رقم حساب المدفوعات': '1234', 'اسم مسؤول المدفوعات': 'أحمد محمود سالم' },
      { 'رقم الماكينة': 'POS-100', 'رقم حساب المدفوعات': '456', 'اسم مسؤول المدفوعات': 'محمود حسن رضوان' },
      { 'رقم الماكينة': 'POS-200', 'رقم حساب المدفوعات': '555', 'اسم مسؤول المدفوعات': '' },
      { 'رقم الماكينة': 'POS-300', 'رقم حساب المدفوعات': '789', 'اسم مسؤول المدفوعات': 'خالد عبد الرحمن' },
      { 'رقم الماكينة': 'POS-300', 'رقم حساب المدفوعات': '890', 'اسم مسؤول المدفوعات': 'طارق زياد العتيبي' },
      { 'رقم الماكينة': 'POS-300', 'رقم حساب المدفوعات': '999', 'اسم مسؤول المدفوعات': 'عمر فاروق الشامي' },
      { 'رقم الماكينة': 'POS-400', 'رقم حساب المدفوعات': '777-ERR', 'اسم مسؤول المدفوعات': 'إبراهيم حسني مراد' },
    ];

    const sample3: SheetRow[] = [
      { 'رقم الماكينة': '7-POS-100', 'رقم حساب الكاش': '1234', 'اسم مسؤول الكاش': 'أحمد محمود سالم (كاش)' },
      { 'رقم الماكينة': '7-POS-200', 'رقم حساب الكاش': '555', 'اسم مسؤول الكاش': 'خالد عبد الرحمن (كاش)' },
      { 'رقم الماكينة': '7-POS-300', 'رقم حساب الكاش': '789', 'اسم مسؤول الكاش': 'طارق زياد العتيبي (كاش)' },
      { 'رقم الماكينة': '7-POS-400', 'رقم حساب الكاش': '777', 'اسم مسؤول الكاش': 'سامح عبد الله كمال (كاش)' },
      { 'رقم الماكينة': '7-POS-500', 'رقم حساب الكاش': '888', 'اسم مسؤول الكاش': 'مصطفى كمال (كاش)' },
    ];

    setSheet1(sample1);
    setSheet1FileName('عينة_شيت_الماكينات.xlsx');
    setSheet1Counts({
      total: sample1.length,
      cash: 0,
      payments: sample1.length
    });
    setSheet2(sample2);
    setSheet2FileName('عينة_شيت_المدفوعات.xlsx');
    setSheet3(sample3);
    setSheet3FileName('عينة_شيت_الكاش.xlsx');

    const m1 = 'رقم الماكينة';
    const m2 = 'رقم الماكينة';
    const acc = 'رقم حساب المدفوعات';
    const rep = 'اسم مسؤول المدفوعات';
    const m3 = 'رقم الماكينة';
    const cashAcc = 'رقم حساب الكاش';
    const cashRep = 'اسم مسؤول الكاش';

    setColM1(m1);
    setColM2(m2);
    setColAcc(acc);
    setColRep(rep);
    setColM3(m3);
    setColCashAcc(cashAcc);
    setColCashRep(cashRep);

    executeReconciliation(sample1, sample2, sample3, m1, m2, acc, rep, m3, cashAcc, cashRep, 'لا يوجد مسؤول');
    setCurrentTab(4);
    showToast('✨ تم تحميل العينة التجريبية وعرض النتائج فوراً!');
  };

  // Perform complete reset
  const performResetAll = () => {
    setSheet1([]);
    setSheet2([]);
    setSheet3([]);
    setSheet2TotalCount(0);
    setSheet3TotalCount(0);
    setSheet1FileName('');
    setSheet2FileName('');
    setSheet3FileName('');
    setSheet1Counts({ total: 0, cash: 0, payments: 0 });
    setReconciliationCounts({
      singleCount: 0,
      multiCount: 0,
      multiRowsCount: 0,
      noneCount: 0,
      cashRowsCount: 0,
      paymentsRowsCount: 0,
    });
    setMachinesResults([]);
    setExpandedRows([]);
    setDuplicates([]);
    setIrregulars([]);
    setSelectedMachines(new Set());
    setSearchQuery('');
    setCurrentFilter('all');
    setAccountTypeFilter('all');
    setCurrentPage(1);
    setCurrentTab(1);
    showToast('🗑️ تم مسح كافة البيانات وتفريغ النظام بالكامل.');
  };

  // Export results to Excel (automatically splits across sheets if > 900k rows)
  const handleExportExcel = () => {
    if (!expandedRows.length) {
      showToast('⚠️ لا توجد نتائج لتصديرها. ارفع الشيتات أو اختر «عينة فورية».');
      return;
    }
    exportReconciliationToExcel(expandedRows);
    showToast('📥 تم تصدير ملف الإكسل المفصل بنجاح! (مقسم تلقائياً لشيتات إذا تجاوز 900 ألف صف)');
  };

  // Export results to CSV (uncapped rows, supports millions of rows without limits)
  const handleExportCsv = () => {
    if (!expandedRows.length) {
      showToast('⚠️ لا توجد نتائج لتصديرها. ارفع الشيتات أو اختر «عينة فورية».');
      return;
    }
    exportReconciliationToCsv(expandedRows);
    showToast('📥 تم تصدير ملف الـ CSV الشامل بنجاح (بدون أي سقف لعدد الصفوف)!');
  };

  // Apply records directly from Big File Splitter Modal into Cash Sheet
  const handleApplyToCashSheetFromSplitter = (rows: SheetRow[], fileName: string) => {
    setSheet3(rows);
    setSheet3FileName(fileName);
    showToast(`✅ تم اعتماد ${rows.length.toLocaleString('ar-EG')} سجل كاش بنجاح بالمنظومة!`);

    if (sheet1.length > 0) {
      const activeColM1 = colM1 || Object.keys(sheet1[0])[0];
      const activeColM2 = colM2 || (sheet2[0] ? Object.keys(sheet2[0])[0] : '');
      const activeColM3 = colM3 || (rows[0] ? Object.keys(rows[0])[0] : '');
      setTimeout(() => {
        executeReconciliation(
          sheet1,
          sheet2,
          rows,
          activeColM1,
          activeColM2,
          colAcc,
          colRep,
          activeColM3,
          colCashAcc,
          colCashRep,
          emptyRepFallback
        );
      }, 10);
    }
  };

  // Automatically prepend "7-" to all machine numbers in Cash sheet (Sheet 3) and ONLY pure cash machines in Sheet 1
  const handleApplyCashPrefix = () => {
    if (!sheet1.length && !sheet3.length) {
      showToast('⚠️ يرجى رفع شيت الماكينات أو شيت الكاش أولاً لتطبيق البادئة.');
      return;
    }

    let modifiedCount = 0;

    // 1. Update Sheet 3 (Cash Sheet)
    let updatedSheet3 = sheet3;
    if (sheet3.length > 0) {
      const mCol3 = colM3 || Object.keys(sheet3[0])[0];
      if (mCol3) {
        updatedSheet3 = sheet3.map((row) => {
          const val = row[mCol3];
          if (val !== undefined && val !== null && val !== '') {
            const str = String(val).trim();
            const norm = normalizeMachineId(str);
            if (!str.startsWith('7-') && !str.startsWith('٧-')) {
              modifiedCount++;
              return {
                ...row,
                [mCol3]: `7-${norm}`,
              };
            }
          }
          return row;
        });
        setSheet3(updatedSheet3);
      }
    }

    // 2. Update Sheet 1 (Machines Sheet) - STRICTLY PROTECT PAYMENT MACHINES
    let updatedSheet1 = sheet1;
    if (sheet1.length > 0) {
      const mCol1 = colM1 || Object.keys(sheet1[0])[0];
      if (mCol1) {
        const cashMachines = updatedSheet3.length > 0
          ? new Set(updatedSheet3.map((r) => normalizeMachineId(String(r[colM3 || Object.keys(r)[0]]))))
          : null;

        const paymentMachines = sheet2.length > 0
          ? new Set(sheet2.map((r) => normalizeMachineId(String(r[colM2 || Object.keys(r)[0]]))))
          : null;

        updatedSheet1 = sheet1.map((row) => {
          const val = row[mCol1];
          if (val !== undefined && val !== null && val !== '') {
            const str = String(val).trim();
            const norm = normalizeMachineId(str);

            // A. PAYMENTS TAB (_tabType === 'payments'):
            // MUST STAY EXACTLY AS IS WITHOUT 7- PREFIX!
            if (row._tabType === 'payments') {
              return {
                ...row,
                [mCol1]: norm, // keep clean without 7- prefix
                _tabType: 'payments',
              };
            }

            // B. CASH TAB (_tabType === 'cash'):
            // ALL MACHINES IN THIS TAB CONVERT TO 7- AND THE NUMBER!
            if (row._tabType === 'cash') {
              if (!str.startsWith('7-') && !str.startsWith('٧-')) {
                modifiedCount++;
                return {
                  ...row,
                  [mCol1]: `7-${norm}`,
                  _tabType: 'cash',
                };
              }
              return row;
            }

            // C. Fallback for unclassified rows (single sheet uploaded without tabs):
            const matchesSheet3 = cashMachines ? cashMachines.has(norm) : false;
            const matchesSheet2 = paymentMachines ? paymentMachines.has(norm) : false;

            if (str.startsWith('7-') || str.startsWith('٧-') || (matchesSheet3 && !matchesSheet2)) {
              if (!str.startsWith('7-') && !str.startsWith('٧-')) {
                modifiedCount++;
                return {
                  ...row,
                  [mCol1]: `7-${norm}`,
                  _tabType: 'cash',
                };
              }
              return {
                ...row,
                _tabType: 'cash',
              };
            }

            // Otherwise, keep as payments:
            return {
              ...row,
              [mCol1]: norm,
              _tabType: 'payments',
            };
          }
          return row;
        });
        setSheet1(updatedSheet1);

        // Recalculate sheet1Counts
        let cash = 0;
        const mCol = mCol1;
        for (let i = 0; i < updatedSheet1.length; i++) {
          const r = updatedSheet1[i];
          const val = String(r[mCol] || '').trim();
          if (r._tabType === 'cash' || val.startsWith('7-') || val.startsWith('٧-')) {
            cash++;
          }
        }
        setSheet1Counts({
          total: updatedSheet1.length,
          cash,
          payments: updatedSheet1.length - cash
        });
      }
    }

    if (modifiedCount > 0) {
      showToast(`⚡ تم تحويل كافة ماكينات تبويب الكاش إلى البادئة 7- بنجاح! (تم تعديل ${modifiedCount} ماكينة وبقاء تبويب المدفوعات كما هو بدون تغيير)`);
    } else {
      showToast(`✅ كافة ماكينات تبويب الكاش تحتوي بالفعل على البادئة 7- وتبويب المدفوعات ظل كما هو دون تغيير`);
    }

    // Auto run reconciliation if sheets are ready
    if (updatedSheet1.length > 0 && (colM1 || Object.keys(updatedSheet1[0])[0])) {
      const activeColM1 = colM1 || Object.keys(updatedSheet1[0])[0];
      executeReconciliation(
        updatedSheet1,
        sheet2,
        updatedSheet3,
        activeColM1,
        colM2,
        colAcc,
        colRep,
        colM3,
        colCashAcc,
        colCashRep,
        emptyRepFallback
      );
    }
  };

  // Bulk actions handlers
  const handleToggleSelectRow = (machine: string) => {
    setSelectedMachines((prev) => {
      const next = new Set(prev);
      if (next.has(machine)) next.delete(machine);
      else next.add(machine);
      return next;
    });
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allMs = new Set(displayedSlice.map((r) => r.machine));
      setSelectedMachines(allMs);
    } else {
      setSelectedMachines(new Set());
    }
  };

  const handleBulkReassign = (newRep: string, newAcc: string) => {
    if (selectedMachines.size === 0) return;

    const updatedSheet2 = sheet2.filter((r) => !selectedMachines.has(String(r[colM2]).trim()));
    selectedMachines.forEach((m) => {
      updatedSheet2.push({
        [colM2]: m,
        [colAcc]: newAcc || 'غير متوفر',
        [colRep]: newRep || emptyRepFallback,
      });
    });

    setSheet2(updatedSheet2);
    executeReconciliation(sheet1, updatedSheet2, sheet3, colM1, colM2, colAcc, colRep, colM3, colCashAcc, colCashRep, emptyRepFallback);
    setSelectedMachines(new Set());
    showToast(`✅ تم إعادة توزيع ${selectedMachines.size} ماكينة للمندوب بنجاح!`);
  };

  const handleBulkMarkVacant = () => {
    if (selectedMachines.size === 0) return;
    const updatedSheet2 = sheet2.filter((r) => !selectedMachines.has(String(r[colM2]).trim()));
    setSheet2(updatedSheet2);
    executeReconciliation(sheet1, updatedSheet2, sheet3, colM1, colM2, colAcc, colRep, colM3, colCashAcc, colCashRep, emptyRepFallback);
    setSelectedMachines(new Set());
    showToast(`✅ تم تحويل ${selectedMachines.size} ماكينة إلى شاغرة (بدون مندوب).`);
  };

  // Sheet 1 Preview filters & counts (Highly optimized using cached counts and lazy loop)
  const cashMachinesCount = useMemo(() => {
    return sheet1Counts.cash;
  }, [sheet1Counts]);

  const payMachinesCount = useMemo(() => {
    return sheet1Counts.payments;
  }, [sheet1Counts]);

  const filteredPreviewTotalCount = useMemo(() => {
    if (sheet1PreviewFilter === 'cash') return sheet1Counts.cash;
    if (sheet1PreviewFilter === 'payments') return sheet1Counts.payments;
    return sheet1Counts.total;
  }, [sheet1Counts, sheet1PreviewFilter]);

  const filteredPreviewRows = useMemo(() => {
    const list: SheetRow[] = [];
    const limit = 25;
    const mCol = colM1 || (sheet1[0] ? Object.keys(sheet1[0])[0] : '');
    if (!mCol) return [];

    const maxScan = Math.min(sheet1.length, 100000);
    for (let i = 0; i < maxScan; i++) {
      const r = sheet1[i];
      if (!r) continue;
      const val = r[mCol];
      const strVal = val !== undefined && val !== null ? String(val).trim() : '';
      const isCash =
        r._tabType === 'cash' ||
        strVal.startsWith('7-') ||
        strVal.startsWith('٧-') ||
        strVal.startsWith('7') ||
        strVal.startsWith('٧');

      if (sheet1PreviewFilter === 'all') {
        list.push(r);
      } else if (sheet1PreviewFilter === 'cash' && isCash) {
        list.push(r);
      } else if (sheet1PreviewFilter === 'payments' && !isCash) {
        list.push(r);
      }
      if (list.length >= limit) break;
    }
    return list;
  }, [sheet1, sheet1PreviewFilter, colM1]);

  // Tab 5 reconciliation rows counts by type (Highly optimized - read from precalculated counts)
  const cashRowsCount = useMemo(() => {
    return reconciliationCounts.cashRowsCount;
  }, [reconciliationCounts]);

  const paymentsRowsCount = useMemo(() => {
    return reconciliationCounts.paymentsRowsCount;
  }, [reconciliationCounts]);

  // Filtered rows for Tab 5 (Heavy performance optimization: returns original array if unfiltered, and exits early at 10,000 matches)
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const hasFilters = q !== '' || currentFilter !== 'all' || accountTypeFilter !== 'all';
    if (!hasFilters) {
      return expandedRows;
    }

    const qNorm = normalizeMachineId(q);
    const qClean = q
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/\.0$/, '');

    const result: ExpandedRow[] = [];
    for (let i = 0; i < expandedRows.length; i++) {
      const item = expandedRows[i];
      if (currentFilter !== 'all' && item.status !== currentFilter) continue;
      if (accountTypeFilter === 'cash' && item.type !== 'cash') continue;
      if (accountTypeFilter === 'payments' && item.type !== 'payment') continue;

      if (q) {
        const itemMNorm = normalizeMachineId(item.machine).toLowerCase();
        const matchM =
          item.machine.toLowerCase().includes(q) ||
          (qNorm ? itemMNorm.includes(qNorm) : false);

        const accClean = item.account
          .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
          .trim()
          .toLowerCase()
          .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
          .replace(/\.0$/, '');

        const matchAcc =
          item.account.toLowerCase().includes(q) ||
          (qClean !== '' && accClean.includes(qClean)) ||
          (qClean !== '' && qClean.includes(accClean) && accClean !== 'غير متوفر');

        const matchRep = item.repName.toLowerCase().includes(q);
        if (!(matchM || matchAcc || matchRep)) continue;
      }
      result.push(item);
      if (result.length >= 10000) break; // Heavy optimization for 1.6M rows search
    }
    return result;
  }, [expandedRows, currentFilter, accountTypeFilter, searchQuery]);

  // Paginated slice
  const maxPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const displayedSlice = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Compute unique machines list for Split-View (Only computed when split mode is active, limit 200 items)
  const uniqueMachinesInFilter = useMemo(() => {
    if (viewMode !== 'split') return [];
    const seen = new Set<string>();
    const list: ExpandedRow[] = [];
    for (const item of filteredRows) {
      if (!seen.has(item.machine)) {
        seen.add(item.machine);
        list.push(item);
      }
      if (list.length >= 200) break;
    }
    return list;
  }, [filteredRows, viewMode]);

  // Auto-select first unique machine on filter change
  useEffect(() => {
    if (viewMode === 'split' && uniqueMachinesInFilter.length > 0) {
      const exists = uniqueMachinesInFilter.some(m => m.machine === splitSelectedMachine);
      if (!exists) {
        setSplitSelectedMachine(uniqueMachinesInFilter[0].machine);
      }
    }
  }, [uniqueMachinesInFilter, viewMode, splitSelectedMachine]);

  // Retrieve original records from Sheet 2 for Split-View
  const getPaymentsRowsForMachine = (machineId: string) => {
    const normId = normalizeMachineId(machineId);
    if (!normId) return [];

    const effectiveM2 = colM2 || 'acceptor1';

    if (chunkCache.getCount('sheet2') > 0) {
      return chunkCache.filterRows('sheet2', (row: any) => normalizeMachineId(row[effectiveM2] || row[Object.keys(row)[0]]) === normId, 50);
    }
    if (!sheet2.length) return [];
    const s2Sample = sheet2[0] || {};
    const s2Keys = Object.keys(s2Sample);
    const resolvedM2 = colM2 && s2Sample[colM2] !== undefined
      ? colM2
      : s2Keys.find((k) => /^(acceptor1|acceptor_1|acceptor 1|acceptor|ماكينة المدفوعات|ماكينه المدفوعات)$/i.test(k))
        || s2Keys.find((k) => /(acceptor.*1|^acceptor$|ماكين.*مدفوعات)/i.test(k))
        || s2Keys.find((k) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(k))
        || s2Keys[0] || '';
    
    return sheet2.filter(row => normalizeMachineId(row[resolvedM2]) === normId);
  };

  // Retrieve original records from Sheet 3 for Split-View
  const getCashRowsForMachine = (machineId: string) => {
    const normId = normalizeMachineId(machineId);
    if (!normId) return [];

    const effectiveM3 = colM3 || 'acceptor2';

    if (chunkCache.getCount('sheet3') > 0) {
      return chunkCache.filterRows('sheet3', (row: any) => normalizeMachineId(row[effectiveM3] || row[Object.keys(row)[0]]) === normId, 50);
    }
    if (!sheet3.length) return [];
    const s3Sample = sheet3[0] || {};
    const s3Keys = Object.keys(s3Sample);
    const resolvedM3 = colM3 && s3Sample[colM3] !== undefined
      ? colM3
      : s3Keys.find((k) => /^(acceptor2|acceptor_2|acceptor 2|رقم ماكينه الكاش|ماكينه الكاش|ماكينة الكاش)$/i.test(k))
        || s3Keys.find((k) => /(acceptor.*2|ماكين.*كاش|ماكينة.*الكاش)/i.test(k))
        || s3Keys.find((k) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(k))
        || s3Keys[0] || '';
    
    return sheet3.filter(row => normalizeMachineId(row[resolvedM3]) === normId);
  };

  // Virtualization / Windowing Setup for High Performance Rendering in Tab 4
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [cardsScrollTop, setCardsScrollTop] = useState(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  
  // Heights and Viewport setup
  const tableRowHeight = 53;
  const cardsRowHeight = 230; // estimated grid row height
  const viewportHeight = 550; // container max height
  
  // Dynamic screen columns count detector to align grid layout with virtualization
  const [colsCount, setColsCount] = useState(4);
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) setColsCount(1);
      else if (w < 1024) setColsCount(2);
      else if (w < 1280) setColsCount(3);
      else setColsCount(4);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset scroll offsets when current filter, searchQuery, viewMode, or currentPage changes
  useEffect(() => {
    setTableScrollTop(0);
    setCardsScrollTop(0);
    if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
    if (cardsContainerRef.current) cardsContainerRef.current.scrollTop = 0;
  }, [currentPage, searchQuery, currentFilter, accountTypeFilter, viewMode]);

  // Memoized table virtualization parameters
  const tableVirtualState = useMemo(() => {
    const visibleCount = Math.ceil(viewportHeight / tableRowHeight);
    const start = Math.max(0, Math.floor(tableScrollTop / tableRowHeight) - 3); // 3 buffer rows
    const end = Math.min(displayedSlice.length, start + visibleCount + 6); // 6 buffer rows
    const topPadding = start * tableRowHeight;
    const bottomPadding = Math.max(0, (displayedSlice.length - end) * tableRowHeight);
    
    return {
      startIndex: start,
      endIndex: end,
      topPadding,
      bottomPadding,
    };
  }, [tableScrollTop, displayedSlice, viewportHeight]);

  // Memoized cards virtualization parameters
  const cardsVirtualState = useMemo(() => {
    const totalRows = Math.ceil(displayedSlice.length / colsCount);
    const visibleRows = Math.ceil(viewportHeight / cardsRowHeight);
    const startRow = Math.max(0, Math.floor(cardsScrollTop / cardsRowHeight) - 1); // 1 buffer row
    const endRow = Math.min(totalRows, startRow + visibleRows + 2); // 2 buffer rows
    
    const startIndex = startRow * colsCount;
    const endIndex = Math.min(displayedSlice.length, endRow * colsCount);
    const topPadding = startRow * cardsRowHeight;
    const bottomPadding = Math.max(0, (totalRows - endRow) * cardsRowHeight);
    
    return {
      startIndex,
      endIndex,
      topPadding,
      bottomPadding,
    };
  }, [cardsScrollTop, displayedSlice, colsCount, viewportHeight]);

  // KPIs (Precalculated during reconciliation for maximum UI speed and zero freeze)
  const singleCount = reconciliationCounts.singleCount;
  const multiCount = reconciliationCounts.multiCount;
  const multiRowsCount = reconciliationCounts.multiRowsCount;
  const noneCount = reconciliationCounts.noneCount;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090d16] text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Offline Connectivity Notification */}
      <OfflineIndicator />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-1/2 translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 text-white border border-indigo-500/40 shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}



      {/* Desktop App Center Modal */}
      <DesktopAppCenterModal
        isOpen={isDesktopCenterOpen}
        onClose={() => setIsDesktopCenterOpen(false)}
      />

      {/* Manual Online/Offline Table Editor Modal */}
      <ManualEditorModal
        isOpen={isManualEditorOpen}
        onClose={() => setIsManualEditorOpen(false)}
        initialMode={editorInitialMode}
        currentSheet1={sheet1}
        currentSheet2={sheet2}
        onApplySheet1={(data) => {
          setSheet1(data);
          setSheet1FileName('شيت_الماكينات_المعدل_يدوياً');
          const mCol = colM1 || Object.keys(data[0] || {})[0] || 'رقم الماكينة';
          let cash = 0;
          for (let i = 0; i < data.length; i++) {
            const r = data[i];
            const val = String(r[mCol] || '').trim();
            const isCash =
              r._tabType === 'cash' ||
              val.startsWith('7-') ||
              val.startsWith('٧-') ||
              val.startsWith('7') ||
              val.startsWith('٧');
            if (isCash) {
              cash++;
              r._tabType = 'cash';
            } else {
              if (!r._tabType || r._tabType === 'machines') r._tabType = 'payments';
            }
          }
          setSheet1Counts({
            total: data.length,
            cash,
            payments: data.length - cash,
          });
          showToast(`✅ تم اعتماد ${data.length} ماكينة (${cash} كاش، ${data.length - cash} مدفوعات) من محرر القوالب.`);
          if (sheet2.length > 0 || sheet3.length > 0) {
            executeReconciliation(data, sheet2, sheet3, colM1 || 'رقم الماكينة', colM2 || 'رقم الماكينة', colAcc, colRep, colM3 || 'رقم الماكينة', colCashAcc, colCashRep, emptyRepFallback);
          }
        }}
        onApplySheet2={(data) => {
          setSheet2(data);
          setSheet2FileName('شيت_المناديب_المعدل_يدوياً');
          showToast(`✅ تم اعتماد ${data.length} سجل مناديب من محرر القوالب.`);
          if (sheet1.length > 0) {
            executeReconciliation(sheet1, data, sheet3, colM1 || 'رقم الماكينة', colM2 || 'رقم الماكينة', colAcc, colRep, colM3 || 'رقم الماكينة', colCashAcc, colCashRep, emptyRepFallback);
          }
        }}
      />

      {/* Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={performResetAll}
      />

      {/* Rep / Machine Lookup Modal */}
      <RepLookupModal
        isOpen={isRepLookupOpen}
        onClose={() => setIsRepLookupOpen(false)}
        machinesResults={machinesResults}
        expandedRows={expandedRows}
        sheet1={sheet1}
        sheet2={sheet2}
        sheet3={sheet3}
        colM1={colM1}
        colM2={colM2}
        colM3={colM3}
        colAcc={colAcc}
        colRep={colRep}
        colCashAcc={colCashAcc}
        colCashRep={colCashRep}
        initialRepQuery={repLookupQuery}
        onLoadSample={handleLoadSample}
        onFilterMainTable={(query) => {
          setSearchQuery(query);
          setCurrentFilter('all');
          setCurrentPage(1);
          setCurrentTab(5);
          showToast(`🔍 تم تطبيق التصفية للماكينة / المندوب: ${query}`);
        }}
      />



      {/* Desktop Header */}
      <DesktopHeader
        onOpenDesktopCenter={() => setIsDesktopCenterOpen(true)}
        onOpenManualEditor={() => {
          setEditorInitialMode(1);
          setIsManualEditorOpen(true);
        }}
        onOpenRepLookup={() => {
          setRepLookupQuery('');
          setIsRepLookupOpen(true);
        }}
        onLoadSample={handleLoadSample}
        onResetAll={() => setIsResetConfirmOpen(true)}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6 relative z-10 font-['Cairo']">
        {/* Navigation Tabs - Modern Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5 sm:gap-3">
          {/* Card 1: Sheet 1 */}
          <button
            onClick={() => setCurrentTab(1)}
            className={`p-3 sm:p-3.5 rounded-2xl border text-right transition-all duration-200 flex flex-col justify-between gap-2.5 cursor-pointer group relative overflow-hidden ${
              currentTab === 1
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/40'
                : 'bg-white dark:bg-[#0a0f1d] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400/60 hover:bg-slate-50 dark:hover:bg-[#0e1628]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                  currentTab === 1
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                01
              </span>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  currentTab === 1
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 group-hover:bg-indigo-500/20'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
              </div>
            </div>

            <div>
              <h4
                className={`text-xs font-bold leading-tight ${
                  currentTab === 1 ? 'text-white' : 'text-slate-900 dark:text-white'
                }`}
              >
                1. شيت الماكينات
              </h4>
              <p
                className={`text-[10px] mt-1 font-medium truncate flex items-center gap-1 ${
                  currentTab === 1 ? 'text-indigo-100 font-bold' : sheet1.length > 0 ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {sheet1.length > 0 ? `✓ ${sheet1.length.toLocaleString('ar-EG')} ماكينة` : 'رفع ملف الأرقام'}
              </p>
            </div>

            {currentTab === 1 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/70 rounded-full mx-3 mb-0.5" />
            )}
          </button>

          {/* Card 2: Sheet 2 */}
          <button
            onClick={() => setCurrentTab(2)}
            className={`p-3 sm:p-3.5 rounded-2xl border text-right transition-all duration-200 flex flex-col justify-between gap-2.5 cursor-pointer group relative overflow-hidden ${
              currentTab === 2
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/40'
                : 'bg-white dark:bg-[#0a0f1d] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400/60 hover:bg-slate-50 dark:hover:bg-[#0e1628]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                  currentTab === 2
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                02
              </span>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  currentTab === 2
                    ? 'bg-white/20 text-white'
                    : effectiveSheet2Count > 0
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'bg-blue-500/10 text-blue-500 dark:text-blue-400 group-hover:bg-blue-500/20'
                }`}
              >
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div>
              <h4
                className={`text-xs font-bold leading-tight ${
                  currentTab === 2 ? 'text-white' : 'text-slate-900 dark:text-white'
                }`}
              >
                2. شيت المدفوعات
              </h4>
              <p
                className={`text-[10px] mt-1 font-medium truncate flex items-center gap-1 ${
                  currentTab === 2 ? 'text-indigo-100 font-bold' : effectiveSheet2Count > 0 ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {effectiveSheet2Count > 0 ? `✓ ${effectiveSheet2Count.toLocaleString('ar-EG')} سجل توزيع` : 'ربط الحسابات'}
              </p>
            </div>

            {currentTab === 2 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/70 rounded-full mx-3 mb-0.5" />
            )}
          </button>

          {/* Card 3: Sheet 3 */}
          <button
            onClick={() => setCurrentTab(3)}
            className={`p-3 sm:p-3.5 rounded-2xl border text-right transition-all duration-200 flex flex-col justify-between gap-2.5 cursor-pointer group relative overflow-hidden ${
              currentTab === 3
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/40'
                : 'bg-white dark:bg-[#0a0f1d] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400/60 hover:bg-slate-50 dark:hover:bg-[#0e1628]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                  currentTab === 3
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                03
              </span>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  currentTab === 3
                    ? 'bg-white/20 text-white'
                    : effectiveSheet3Count > 0
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500 dark:text-amber-400 group-hover:bg-amber-500/20'
                }`}
              >
                <Calculator className="w-4 h-4" />
              </div>
            </div>

            <div>
              <h4
                className={`text-xs font-bold leading-tight ${
                  currentTab === 3 ? 'text-white' : 'text-slate-900 dark:text-white'
                }`}
              >
                3. شيت الكاش
              </h4>
              <p
                className={`text-[10px] mt-1 font-medium truncate flex items-center gap-1 ${
                  currentTab === 3 ? 'text-indigo-100 font-bold' : effectiveSheet3Count > 0 ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {effectiveSheet3Count > 0 ? `✓ ${effectiveSheet3Count.toLocaleString('ar-EG')} سجل كاش` : 'ربط حسابات الكاش'}
              </p>
            </div>

            {currentTab === 3 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/70 rounded-full mx-3 mb-0.5" />
            )}
          </button>

          {/* Card 4: Mapping */}
          <button
            onClick={() => setCurrentTab(4)}
            className={`p-3 sm:p-3.5 rounded-2xl border text-right transition-all duration-200 flex flex-col justify-between gap-2.5 cursor-pointer group relative overflow-hidden ${
              currentTab === 4
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/40'
                : 'bg-white dark:bg-[#0a0f1d] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400/60 hover:bg-slate-50 dark:hover:bg-[#0e1628]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                  currentTab === 4
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                04
              </span>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  currentTab === 4
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-500/10 text-amber-500 dark:text-amber-400 group-hover:bg-amber-500/20'
                }`}
              >
                <Sliders className="w-4 h-4" />
              </div>
            </div>

            <div>
              <h4
                className={`text-xs font-bold leading-tight ${
                  currentTab === 4 ? 'text-white' : 'text-slate-900 dark:text-white'
                }`}
              >
                4. تعيين الأعمدة
              </h4>
              <p
                className={`text-[10px] mt-1 font-medium truncate ${
                  currentTab === 4 ? 'text-indigo-100 font-bold' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {colM1 && colM2 ? 'أعمدة الربط محددة' : 'ضبط ومطابقة الأعمدة'}
              </p>
            </div>

            {currentTab === 4 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/70 rounded-full mx-3 mb-0.5" />
            )}
          </button>

          {/* Card 5: Reports */}
          <button
            onClick={() => setCurrentTab(5)}
            className={`p-3 sm:p-3.5 rounded-2xl border text-right transition-all duration-200 flex flex-col justify-between gap-2.5 cursor-pointer group relative overflow-hidden ${
              currentTab === 5
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/40'
                : 'bg-white dark:bg-[#0a0f1d] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400/60 hover:bg-slate-50 dark:hover:bg-[#0e1628]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                  currentTab === 5
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                05
              </span>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  currentTab === 5
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 group-hover:bg-indigo-500/20'
                }`}
              >
                <Layers className="w-4 h-4" />
              </div>
            </div>

            <div>
              <h4
                className={`text-xs font-bold leading-tight ${
                  currentTab === 5 ? 'text-white' : 'text-slate-900 dark:text-white'
                }`}
              >
                5. تقرير الأسطر
              </h4>
              <p
                className={`text-[10px] mt-1 font-mono font-bold truncate ${
                  currentTab === 5 ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {expandedRows.length.toLocaleString('ar-EG')} سطر مفصل
              </p>
            </div>

            {currentTab === 5 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/70 rounded-full mx-3 mb-0.5" />
            )}
          </button>

          {/* Card 6: Audit & Conflicts */}
          <button
            onClick={() => setCurrentTab(6)}
            className={`p-3 sm:p-3.5 rounded-2xl border text-right transition-all duration-200 flex flex-col justify-between gap-2.5 cursor-pointer group relative overflow-hidden ${
              currentTab === 6
                ? 'bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-600/30 ring-2 ring-amber-400/40'
                : 'bg-white dark:bg-[#0a0f1d] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400/60 hover:bg-slate-50 dark:hover:bg-[#0e1628]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                  currentTab === 6
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                06
              </span>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  currentTab === 6
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-500/10 text-amber-500 dark:text-amber-400 group-hover:bg-amber-500/20'
                }`}
              >
                <CircleAlert className="w-4 h-4" />
              </div>
            </div>

            <div>
              <h4
                className={`text-xs font-bold leading-tight ${
                  currentTab === 6 ? 'text-white' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                6. فحص النزاعات
              </h4>
              <p
                className={`text-[10px] mt-1 font-mono font-bold truncate ${
                  currentTab === 6 ? 'text-amber-100' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {duplicates.length + irregulars.length > 0
                  ? `${(duplicates.length + irregulars.length).toLocaleString('ar-EG')} شاذ / مكرر`
                  : 'فحص سليم (0)'}
              </p>
            </div>

            {currentTab === 6 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/70 rounded-full mx-3 mb-0.5" />
            )}
          </button>

          {/* Card 7: Desktop App Studio */}
          <button
            onClick={() => setCurrentTab(7)}
            className={`p-3 sm:p-3.5 rounded-2xl border text-right transition-all duration-200 flex flex-col justify-between gap-2.5 cursor-pointer group relative overflow-hidden ${
              currentTab === 7
                ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/40'
                : 'bg-white dark:bg-[#0a0f1d] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400/60 hover:bg-slate-50 dark:hover:bg-[#0e1628]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                  currentTab === 7
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                07
              </span>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  currentTab === 7
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-500/10 text-blue-500 dark:text-blue-400 group-hover:bg-blue-500/20'
                }`}
              >
                <FileCode className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-1">
                <h4
                  className={`text-xs font-bold leading-tight ${
                    currentTab === 7 ? 'text-white' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  7. استوديو HTML
                </h4>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Live Update" />
              </div>
              <p
                className={`text-[10px] mt-1 font-medium truncate ${
                  currentTab === 7 ? 'text-blue-100 font-bold' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                تحديث أوفلاين
              </p>
            </div>

            {currentTab === 7 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/70 rounded-full mx-3 mb-0.5" />
            )}
          </button>

          {/* Card 8: Direct Rep & Machine Inquiry Hub */}
          <button
            onClick={() => setCurrentTab(8)}
            className={`p-3 sm:p-3.5 rounded-2xl border text-right transition-all duration-200 flex flex-col justify-between gap-2.5 cursor-pointer group relative overflow-hidden ${
              currentTab === 8
                ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/40'
                : 'bg-white dark:bg-[#0a0f1d] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-purple-400/60 hover:bg-slate-50 dark:hover:bg-[#0e1628]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                  currentTab === 8
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                08
              </span>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  currentTab === 8
                    ? 'bg-white/20 text-white'
                    : 'bg-purple-500/10 text-purple-500 dark:text-purple-400 group-hover:bg-purple-500/20'
                }`}
              >
                <Search className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-1">
                <h4
                  className={`text-xs font-bold leading-tight ${
                    currentTab === 8 ? 'text-white' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  8. استعلام المندوب
                </h4>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="جاهز للاستعلام" />
              </div>
              <p
                className={`text-[10px] mt-1 font-medium truncate ${
                  currentTab === 8 ? 'text-purple-100 font-bold' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                كاش ومدفوعات
              </p>
            </div>

            {currentTab === 8 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/70 rounded-full mx-3 mb-0.5" />
            )}
          </button>
        </div>

        {/* TAB 1: Sheet 1 Upload */}
        {currentTab === 1 && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-indigo-500" />
                    <span>رفع الشيت الأول (شيت أرقام الماكينات المستهدفة)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    الملف الذي يحتوي على أرقام الماكينات (Machine ID / Serial) المطلوب فحصها ومعرفة مناديبها وحساباتهم.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleApplyCashPrefix}
                    className="px-3.5 py-1.5 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                    title="تحويل كافة ماكينات الكاش في الشيت المرفوع تلقائياً إلى البادئة 7-"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>⚡ تحويل ماكينات الكاش لـ 7-</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorInitialMode(1);
                      setIsManualEditorOpen(true);
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <TableProperties className="w-3.5 h-3.5" />
                    <span>تعبئة القالب يدوياً</span>
                  </button>
                  <button
                    onClick={() => setIsCompressionTipsOpen(true)}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="نصائح عملية لتقليص حجم الملفات الكبيرة قبل رفعها"
                  >
                    <span>💡 نصائح تقليص الحجم والضغط</span>
                  </button>
                  <button
                    onClick={() => downloadTemplateFile(1, 'xlsx')}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل نموذج القالب</span>
                  </button>
                </div>
              </div>

              {/* Dropzone */}
              <label className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 text-center cursor-pointer hover:border-indigo-500 bg-slate-50 dark:bg-slate-800/30 block transition-colors group">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv, .zip, application/zip, application/x-zip-compressed"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      handleSheet1Upload(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                />
                <FileSpreadsheet className="w-12 h-12 text-indigo-500 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  اضغط هنا لاختيار شيت الماكينات (Excel أو CSV أو ZIP مضغوط) أو اسحبه وأفلته هنا
                </p>
                <p className="text-[11px] text-slate-400">
                  يدعم ملفات Excel و CSV وأرشيف ZIP المضغوط مع فك فوري ومعالجة محلية 100%
                </p>
              </label>

              {sheet1.length > 0 && (
                <div className="mt-5 space-y-4 border-t border-slate-200 dark:border-slate-800/80 pt-5">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>تم قراءة شيت الماكينات بنجاح: {sheet1.length.toLocaleString('ar-EG')} ماكينة</span>
                      {sheet1FileName && <span className="text-slate-400 font-normal">({sheet1FileName})</span>}
                    </div>

                    <div className="flex items-center gap-2">
                      {(sheet2.length > 0 || sheet3.length > 0) && (
                        <button
                          onClick={() => runReconciliation(sheet1, sheet2, sheet3, true)}
                          className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-500/20 active:scale-95"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-300" />
                          <span>تشغيل المطابقة (النتائج) ←</span>
                        </button>
                      )}
                      <button
                        onClick={handleApplyCashPrefix}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>⚡ تحويل ماكينات الكاش لـ 7-</span>
                      </button>
                      <button
                        onClick={handleClearSheet1}
                        className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 border border-rose-500/30 shadow-sm active:scale-95"
                        title="إغلاق وحذف هذا الشيت في حالة رفعه بطريق الخطأ"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>إغلاق الشيت (حذف)</span>
                      </button>
                      <button
                        onClick={() => setCurrentTab(2)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 underline font-bold cursor-pointer transition text-xs mr-2"
                      >
                        الانتقال لرفع شيت المناديب &larr;
                      </button>
                    </div>
                  </div>

                  {sheet2.length === 0 && sheet3.length === 0 && (
                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-indigo-600 dark:text-indigo-300 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <CircleAlert className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>✅ تم رفع واعتماد شيت الماكينات بنجاح! لمطابقة الأرقام بحسابات المناديب، يرجى الانتقال إلى شيت المدفوعات (الخطوة 02).</span>
                      </div>
                      <button
                        onClick={() => setCurrentTab(2)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
                      >
                        <span>الانتقال لرفع شيت المدفوعات (02)</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Stat Boxes for Cash & Payment Machines Count */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-900/80 border border-emerald-500/40 rounded-2xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base">
                          💵
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">ماكينات الكاش (7-)</span>
                          <span className="text-xs text-emerald-400 font-semibold">مخصصة لحسابات الكاش</span>
                        </div>
                      </div>
                      <span className="text-xl font-mono font-black text-emerald-400">{cashMachinesCount.toLocaleString('ar-EG')}</span>
                    </div>

                    <div className="p-3.5 bg-slate-900/80 border border-blue-500/40 rounded-2xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-base">
                          💳
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">ماكينات المدفوعات</span>
                          <span className="text-xs text-blue-400 font-semibold">مخصصة لحسابات المدفوعات</span>
                        </div>
                      </div>
                      <span className="text-xl font-mono font-black text-blue-400">{payMachinesCount.toLocaleString('ar-EG')}</span>
                    </div>

                    <div className="p-3.5 bg-slate-900/80 border border-indigo-500/40 rounded-2xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-base">
                          📦
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">إجمالي ماكينات الشيت</span>
                          <span className="text-xs text-indigo-400 font-semibold">كافة الأجهزة المحملة</span>
                        </div>
                      </div>
                      <span className="text-xl font-mono font-black text-indigo-400">{sheet1.length.toLocaleString('ar-EG')}</span>
                    </div>
                  </div>

                  {/* Live Sheet 1 Preview Table with Interactive Filter Pills */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-3.5 bg-slate-100 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          معاينة بيانات شيت الماكينات المرفوع مباشرة ({Math.min(25, filteredPreviewTotalCount)} من {filteredPreviewTotalCount.toLocaleString('ar-EG')})
                        </h4>
                      </div>

                      {/* Filter Pills for Cash & Payments */}
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                          onClick={() => setSheet1PreviewFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            sheet1PreviewFilter === 'all'
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          كافة الماكينات ({sheet1Counts.total})
                        </button>

                        <button
                          onClick={() => setSheet1PreviewFilter('cash')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            sheet1PreviewFilter === 'cash'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span>💵 ماكينات الكاش</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-950/40 text-emerald-200 font-mono text-[10px]">
                            {cashMachinesCount}
                          </span>
                        </button>

                        <button
                          onClick={() => setSheet1PreviewFilter('payments')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            sheet1PreviewFilter === 'payments'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span>💳 ماكينات المدفوعات</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-blue-950/40 text-blue-200 font-mono text-[10px]">
                            {payMachinesCount}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-200/80 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
                          <tr>
                            <th className="p-2.5 w-12 text-center font-mono">م</th>
                            {Object.keys(sheet1[0]).filter((col) => !col.startsWith('_')).map((col) => (
                              <th key={col} className="p-2.5">{col}</th>
                            ))}
                            <th className="p-2.5 text-center">تصنيف الماكينة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                          {filteredPreviewTotalCount === 0 ? (
                            <tr>
                              <td colSpan={Object.keys(sheet1[0]).filter((col) => !col.startsWith('_')).length + 2} className="p-8 text-center text-slate-400">
                                لا توجد ماكينات مطابقة لهذا التصنيف في الشيت المرفوع حالياً.
                              </td>
                            </tr>
                          ) : (
                            filteredPreviewRows.map((row, idx) => {
                              const mCol = colM1 || Object.keys(row)[0];
                              const machineVal = String(row[mCol] || '').trim();
                              const isCash =
                                row._tabType === 'cash' ||
                                (row._tabType !== 'payments' &&
                                  (machineVal.startsWith('7-') ||
                                    machineVal.startsWith('٧-') ||
                                    machineVal.startsWith('7') ||
                                    machineVal.startsWith('٧')));
                              return (
                                <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                                  <td className="p-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                                  {Object.keys(sheet1[0]).filter((col) => !col.startsWith('_')).map((col) => (
                                    <td key={col} className="p-2 font-bold text-slate-800 dark:text-slate-200">
                                      {String(row[col] ?? '')}
                                    </td>
                                  ))}
                                  <td className="p-2 text-center">
                                    {isCash ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        💵 ماكينة كاش
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                        💳 مدفوعات
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {filteredPreviewTotalCount > 25 && (
                      <div className="p-2.5 bg-slate-100/50 dark:bg-slate-800/50 text-center text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 font-semibold">
                        عرض أول 25 ماكينة من إجمالي {filteredPreviewTotalCount.toLocaleString('ar-EG')} ماكينة محملة في هذا التصنيف.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Sheet 2 Upload */}
        {currentTab === 2 && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>رفع الشيت الثاني (شيت مدفوعات المناديب وأرقام حساباتهم)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    الملف الذي يحتوي على رقم الماكينة، اسم المندوب، ورقم حساب المندوب للمدفوعات (Account No / Code).
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setSplitterDefaultType('payments');
                      setIsSplitterOpen(true);
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="أداة خاصة لمعالجة وتقسيم ملفات المدفوعات الضخمة التي تتجاوز 1.66 مليون صف"
                  >
                    <Split className="w-3.5 h-3.5 text-amber-400" />
                    <span>⚡ معالج الملفات المليونية (+1.66M)</span>
                  </button>
                  <button
                    onClick={() => setIsCompressionTipsOpen(true)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="نصائح عملية لتقليص حجم ملفات المدفوعات الكبيرة"
                  >
                    <span>💡 نصائح تقليص الحجم</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorInitialMode(2);
                      setIsManualEditorOpen(true);
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <TableProperties className="w-3.5 h-3.5" />
                    <span>تعبئة القالب يدوياً</span>
                  </button>
                  <button
                    onClick={() => downloadTemplateFile(2, 'xlsx')}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل نموذج القالب</span>
                  </button>
                </div>
              </div>

              {/* 1.66 Million Rows Alert Banner for Payments */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-4">
                <div className="flex items-center gap-2.5 text-amber-300">
                  <Info className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>هل حجم ملف المدفوعات ضخم أو يحتوي على ملايين الصفوف؟</strong> يمكنك ضغطه في أرشيف ZIP لتخفيض حجمه بنسبة 85% ورفعه مباشرة، أو استخدام معالج التجزئة لتقسيم السجلات بدقة!
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setIsCompressionTipsOpen(true)}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    💡 نصائح التقليص
                  </button>
                  <button
                    onClick={() => {
                      setSplitterDefaultType('payments');
                      setIsSplitterOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer shadow-sm"
                  >
                    فتح أداة التقسيم &larr;
                  </button>
                </div>
              </div>

              {/* Dropzone */}
              <label className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 text-center cursor-pointer hover:border-blue-500 bg-slate-50 dark:bg-slate-800/30 block transition-colors group">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv, .zip, application/zip, application/x-zip-compressed"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      handleSheet2Upload(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                />
                <FileSpreadsheet className="w-12 h-12 text-blue-500 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  اضغط هنا لاختيار شيت المدفوعات (Excel أو CSV أو ZIP مضغوط) أو اسحبه وأفلته هنا
                </p>
                <p className="text-[11px] text-slate-400">
                  يدعم ملفات Excel و CSV وأرشيف ZIP مع استخراج سريع لعمودي acceptor1 و doner1
                </p>
              </label>

              {effectiveSheet2Count > 0 && (
                <div className="mt-5 space-y-4 border-t border-slate-200 dark:border-slate-800/80 pt-5">
                  {/* Record Count Summary Card */}
                  <div className="p-4 bg-slate-900/90 border border-blue-500/40 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg">
                        💳
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 block">إجمالي سجلات المدفوعات المرفوعة</span>
                        <span className="text-[11px] text-slate-500 font-semibold">{sheet2FileName || 'ملف المدفوعات'}</span>
                      </div>
                    </div>
                    <span className="text-2xl font-mono font-black text-blue-400">{effectiveSheet2Count.toLocaleString('ar-EG')}</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>تم قراءة واعتماد شيت المدفوعات بنجاح: {effectiveSheet2Count.toLocaleString('ar-EG')} سجل توزيع</span>
                      {sheet2FileName && <span className="text-slate-400 font-normal">({sheet2FileName})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {sheet1.length > 0 && (
                        <button
                          onClick={() => runReconciliation(sheet1, sheet2, sheet3, true)}
                          className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-500/20 active:scale-95"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-300" />
                          <span>تشغيل المطابقة (النتائج) ←</span>
                        </button>
                      )}
                      <button
                        onClick={handleClearSheet2}
                        className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 border border-rose-500/30 shadow-sm active:scale-95"
                        title="إغلاق وحذف هذا الشيت في حالة رفعه بطريق الخطأ"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>إغلاق الشيت (حذف)</span>
                      </button>
                      <button
                        onClick={() => setCurrentTab(3)}
                        className="text-indigo-600 dark:text-indigo-400 underline font-bold cursor-pointer transition text-xs mr-2"
                      >
                        الانتقال لرفع شيت الكاش &larr;
                      </button>
                    </div>
                  </div>

                  {/* Instant Representative & Machines Inquiry Hub (Direct Query on Sheet 2 & 3) */}
                  <InstantRepInquiry
                    sheet2Count={effectiveSheet2Count}
                    sheet3Count={effectiveSheet3Count}
                    sheet2FileName={sheet2FileName}
                    sheet3FileName={sheet3FileName}
                    colM2={colM2}
                    colAcc={colAcc}
                    colRep={colRep}
                    colM3={colM3}
                    colCashAcc={colCashAcc}
                    colCashRep={colCashRep}
                    onOpenFullLookup={(query) => {
                      setRepLookupQuery(query || '');
                      setIsRepLookupOpen(true);
                    }}
                    onClearInquirySheets={handleClearInquirySheets}
                    showToast={showToast}
                  />

                  {/* Live Sheet 2 Preview Table */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-3.5 bg-slate-100 dark:bg-slate-800 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-blue-500" />
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          معاينة بيانات شيت المدفوعات المعتمد ({Math.min(50, sheet2.length)} من {effectiveSheet2Count.toLocaleString('ar-EG')})
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/30 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>معاينة ذكية 50 سجلاً (ذاكرة معزولة)</span>
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-200/80 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
                          <tr>
                            <th className="p-2.5 w-12 text-center font-mono">م</th>
                            {sheet2[0] && Object.keys(sheet2[0]).filter((col) => !col.startsWith('_')).map((col) => {
                              const isAcc1 = /acceptor1/i.test(col);
                              const isDon1 = /doner1/i.test(col);
                              return (
                                <th key={col} className="p-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <span>{col}</span>
                                    {isAcc1 && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                                        رقم الحساب
                                      </span>
                                    )}
                                    {isDon1 && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30">
                                        المندوب
                                      </span>
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                          {sheet2.slice(0, 50).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                              <td className="p-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                              {Object.keys(sheet2[0]).filter((col) => !col.startsWith('_')).map((col) => (
                                <td key={col} className="p-2 font-bold text-slate-800 dark:text-slate-200">
                                  {String(row[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {effectiveSheet2Count > 50 && (
                      <div className="p-2.5 bg-slate-100/50 dark:bg-slate-800/50 text-center text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 font-semibold flex items-center justify-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        <span>عرض أول 50 سجل من إجمالي {effectiveSheet2Count.toLocaleString('ar-EG')} سجل مثبتة بالكامل في الذاكرة الذكية دون أي تجميد للشاشة.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Sheet 3 Upload (Cash) */}
        {currentTab === 3 && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-500" />
                    <span>رفع الشيت الثالث (شيت الكاش وحسابات المناديب)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    الملف الذي يحتوي على رقم الماكينة، اسم المندوب المسؤول عن الكاش، ورقم حساب الكاش (Account No / Code).
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setSplitterDefaultType('cash');
                      setIsSplitterOpen(true);
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="أداة خاصة لمعالجة وتقسيم ملفات الكاش الضخمة التي تتجاوز 1.66 مليون صف"
                  >
                    <Split className="w-3.5 h-3.5 text-amber-400" />
                    <span>⚡ معالج الملفات المليونية (+1.66M)</span>
                  </button>
                  <button
                    onClick={() => setIsCompressionTipsOpen(true)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="نصائح عملية لتقليص حجم ملفات الكاش الكبيرة"
                  >
                    <span>💡 نصائح تقليص الحجم</span>
                  </button>
                  <button
                    onClick={() => downloadTemplateFile(3, 'xlsx')}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل نموذج القالب</span>
                  </button>
                </div>
              </div>

              {/* 1.66 Million Rows Alert Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-4">
                <div className="flex items-center gap-2.5 text-amber-300">
                  <Info className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>هل حجم ملف الكاش ضخم أو يتجاوز مليون صف؟</strong> يمكنك ضغطه في أرشيف ZIP لتخفيض حجمه بنسبة 85% ورفعه مباشرة، أو استخدام أداة التقسيم المدمجة لتجزئته لورقات عمل متعددة!
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setIsCompressionTipsOpen(true)}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    💡 نصائح التقليص
                  </button>
                  <button
                    onClick={() => {
                      setSplitterDefaultType('cash');
                      setIsSplitterOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer shadow-sm"
                  >
                    فتح أداة التقسيم &larr;
                  </button>
                </div>
              </div>

              {/* Dropzone */}
              <label className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 text-center cursor-pointer hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/30 block transition-colors group">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv, .zip, application/zip, application/x-zip-compressed"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      handleSheet3Upload(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                />
                <FileSpreadsheet className="w-12 h-12 text-emerald-500 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  اضغط هنا لاختيار شيت الكاش (Excel أو CSV أو ZIP مضغوط) أو اسحبه وأفلته هنا
                </p>
                <p className="text-[11px] text-slate-400">
                  يدعم ملفات Excel و CSV وأرشيف ZIP مع استخراج سريع لعمودي acceptor2 و doner2
                </p>
              </label>

              {effectiveSheet3Count > 0 && (
                <div className="mt-6 p-4 rounded-2xl bg-[#080d16]/60 border border-slate-850 space-y-4">
                  {/* Record Count Summary Card */}
                  <div className="p-4 bg-slate-900/90 border border-emerald-500/40 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                        💵
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 block">إجمالي أجهزة وسجلات الكاش المرفوعة</span>
                        <span className="text-[11px] text-slate-500 font-semibold">{sheet3FileName || 'ملف الكاش'}</span>
                      </div>
                    </div>
                    <span className="text-2xl font-mono font-black text-emerald-400">{effectiveSheet3Count.toLocaleString('ar-EG')}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <span>تم قراءة واعتماد شيت الكاش بنجاح: {effectiveSheet3Count.toLocaleString('ar-EG')} سجل كاش</span>
                    <div className="flex items-center gap-2">
                      {sheet1.length > 0 && (
                        <button
                          onClick={() => runReconciliation(sheet1, sheet2, sheet3, true)}
                          className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-500/20 active:scale-95"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-300" />
                          <span>تشغيل المطابقة (النتائج) ←</span>
                        </button>
                      )}
                      <button
                        onClick={handleApplyCashPrefix}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black transition cursor-pointer"
                      >
                        ⚡ تحويل لـ 7-
                      </button>
                      <button
                        onClick={handleClearSheet3}
                        className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 border border-rose-500/30 shadow-sm active:scale-95"
                        title="إغلاق وحذف هذا الشيت في حالة رفعه بطريق الخطأ"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>إغلاق الشيت (حذف)</span>
                      </button>
                      <button
                        onClick={() => setCurrentTab(4)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 underline font-bold cursor-pointer transition text-xs mr-2"
                      >
                        الانتقال لتعيين الأعمدة &larr;
                      </button>
                    </div>
                  </div>

                  {/* Instant Representative & Machines Inquiry Hub (Direct Query on Sheet 2 & 3) */}
                  <InstantRepInquiry
                    sheet2Count={effectiveSheet2Count}
                    sheet3Count={effectiveSheet3Count}
                    sheet2FileName={sheet2FileName}
                    sheet3FileName={sheet3FileName}
                    colM2={colM2}
                    colAcc={colAcc}
                    colRep={colRep}
                    colM3={colM3}
                    colCashAcc={colCashAcc}
                    colCashRep={colCashRep}
                    onOpenFullLookup={(query) => {
                      setRepLookupQuery(query || '');
                      setIsRepLookupOpen(true);
                    }}
                    onClearInquirySheets={handleClearInquirySheets}
                    showToast={showToast}
                  />

                  {/* Smart Helper Card */}
                  <div className="p-4 rounded-xl bg-slate-800/20 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span>💡 منسق أرقام ماكينات الكاش السريع</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        إذا كانت أرقام الماكينات في شيت الكاش المرفوع تبدأ بأرقام عادية (مثل <strong className="text-amber-400">123</strong>) وتريد تحويلها فوراً للتنسيق المطلوب المعتمد المقترن ببادئة الكاش (لتصبح <strong className="text-emerald-400">7-123</strong>) بضغطة زر واحدة:
                      </p>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                      onClick={handleApplyCashPrefix}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>⚡ تحويل ماكينات الكاش إلى 7-</span>
                    </motion.button>
                  </div>

                  {/* Live Sheet 3 Preview Table */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-3.5 bg-slate-100 dark:bg-slate-800 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-emerald-500" />
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          معاينة بيانات شيت الكاش المعتمد ({Math.min(50, sheet3.length)} من {effectiveSheet3Count.toLocaleString('ar-EG')})
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/30 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>معاينة ذكية 50 سجلاً (ذاكرة معزولة)</span>
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-200/80 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
                          <tr>
                            <th className="p-2.5 w-12 text-center font-mono">م</th>
                            {sheet3[0] && Object.keys(sheet3[0]).filter((col) => !col.startsWith('_')).map((col) => {
                              const isAcc2 = /acceptor2/i.test(col);
                              const isDon2 = /doner2/i.test(col);
                              return (
                                <th key={col} className="p-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <span>{col}</span>
                                    {isAcc2 && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                                        رقم الماكينة
                                      </span>
                                    )}
                                    {isDon2 && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-teal-500/20 text-teal-400 font-bold border border-teal-500/30">
                                        رقم المندوب الكاش
                                      </span>
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                          {sheet3.slice(0, 50).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                              <td className="p-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                              {Object.keys(sheet3[0]).filter((col) => !col.startsWith('_')).map((col) => (
                                <td key={col} className="p-2 font-bold text-slate-800 dark:text-slate-200">
                                  {String(row[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {effectiveSheet3Count > 50 && (
                      <div className="p-2.5 bg-slate-100/50 dark:bg-slate-800/50 text-center text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 font-semibold flex items-center justify-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>عرض أول 50 سجل من إجمالي {effectiveSheet3Count.toLocaleString('ar-EG')} سجل كاش مثبتة بالكامل في الذاكرة الذكية دون أي تجميد للشاشة.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}



        {/* TAB 4: Column Mapping */}
        {currentTab === 4 && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-500" />
                    <span>تحديد وتعيين أعمدة الماكينة ورقم الحساب واسم المندوب</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    يتعرف النظام آلياً على الأعمدة المقابلة ويمكنك تخصيص وتعديل طريقة المطابقة:
                  </p>
                </div>
              </div>

              {/* Selectors Grid */}
              <h4 className="text-xs font-bold text-[#4f46e5] dark:text-[#818cf8] mb-2">تعيين أعمدة المدفوعات والماكينات (شيت 1 وشيت 2)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Machine Col 1 */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    1. عمود الماكينة (شيت المكن):
                  </label>
                  <select
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                    value={colM1}
                    onChange={(e) => setColM1(e.target.value)}
                  >
                    {sheet1.length > 0 ? (
                      Object.keys(sheet1[0])
                        .filter((c) => !c.startsWith('_'))
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))
                    ) : (
                      <option value="">-- يرجى رفع شيت الماكينات أولاً --</option>
                    )}
                  </select>
                  <p className="text-[10px] text-slate-400">عمود الماكينة الرئيسي من الشيت الأول</p>
                </div>

                {/* Machine Col 2 */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-bold text-blue-600 dark:text-blue-400">
                    2. عمود الماكينة (شيت المدفوعات):
                  </label>
                  <select
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:border-blue-500 focus:outline-none"
                    value={colM2}
                    onChange={(e) => setColM2(e.target.value)}
                  >
                    {sheet2.length > 0 ? (
                      Object.keys(sheet2[0])
                        .filter((c) => !c.startsWith('_'))
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))
                    ) : (
                      <option value="">-- يرجى رفع شيت المدفوعات أولاً --</option>
                    )}
                  </select>
                  <p className="text-[10px] text-slate-400">رقم الماكينة المقابل في شيت المدفوعات</p>
                </div>

                {/* Account Col */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-bold text-amber-600 dark:text-amber-400">
                    3. عمود رقم حساب المدفوعات:
                  </label>
                  <select
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:border-amber-500 focus:outline-none"
                    value={colAcc}
                    onChange={(e) => setColAcc(e.target.value)}
                  >
                    <option value="">-- بدون عمود حساب --</option>
                    {sheet2.length > 0 &&
                      Object.keys(sheet2[0])
                        .filter((c) => !c.startsWith('_'))
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                  </select>
                  <p className="text-[10px] text-slate-400">كود / حساب مسؤول المدفوعات</p>
                </div>

                {/* Rep Name Col */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    4. عمود اسم مندوب المدفوعات:
                  </label>
                  <select
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    value={colRep}
                    onChange={(e) => setColRep(e.target.value)}
                  >
                    {sheet2.length > 0 ? (
                      Object.keys(sheet2[0])
                        .filter((c) => !c.startsWith('_'))
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))
                    ) : (
                      <option value="">-- يرجى رفع شيت المدفوعات أولاً --</option>
                    )}
                  </select>
                  <p className="text-[10px] text-slate-400">عمود اسم المندوب في شيت المدفوعات</p>
                </div>
              </div>

              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2">تعيين أعمدة الكاش (شيت 3)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Machine Col 3 */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    5. عمود الماكينة (شيت الكاش):
                  </label>
                  <select
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                    value={colM3}
                    onChange={(e) => setColM3(e.target.value)}
                  >
                    {sheet3.length > 0 ? (
                      Object.keys(sheet3[0])
                        .filter((c) => !c.startsWith('_'))
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))
                    ) : (
                      <option value="">-- يرجى رفع شيت الكاش أولاً --</option>
                    )}
                  </select>
                  <p className="text-[10px] text-slate-400">رقم الماكينة المقابل في شيت الكاش</p>
                </div>

                {/* Cash Account Col */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-bold text-amber-600 dark:text-amber-400">
                    6. عمود رقم حساب الكاش:
                  </label>
                  <select
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:border-amber-500 focus:outline-none"
                    value={colCashAcc}
                    onChange={(e) => setColCashAcc(e.target.value)}
                  >
                    <option value="">-- بدون عمود حساب كاش --</option>
                    {sheet3.length > 0 &&
                      Object.keys(sheet3[0])
                        .filter((c) => !c.startsWith('_'))
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                  </select>
                  <p className="text-[10px] text-slate-400">كود / حساب مسؤول الكاش</p>
                </div>

                {/* Cash Rep Name Col */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    7. عمود اسم مندوب الكاش:
                  </label>
                  <select
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    value={colCashRep}
                    onChange={(e) => setColCashRep(e.target.value)}
                  >
                    {sheet3.length > 0 ? (
                      Object.keys(sheet3[0])
                        .filter((c) => !c.startsWith('_'))
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))
                    ) : (
                      <option value="">-- يرجى رفع شيت الكاش أولاً --</option>
                    )}
                  </select>
                  <p className="text-[10px] text-slate-400">عمود اسم المندوب في شيت الكاش</p>
                </div>
              </div>

              {/* Fallback Option */}
              <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    معالجة الحالات الشاغرة وأسماء المناديب الفارغة:
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 block sm:inline mr-1 text-[11px]">
                    إذا كانت خانة اسم المندوب فارغة يتم تلقائياً تدوين وسم "لا يوجد مندوب" أو النص الذي تخصصه.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">النص البديل:</span>
                  <select
                    className="p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400"
                    value={emptyRepFallback}
                    onChange={(e) => setEmptyRepFallback(e.target.value)}
                  >
                    <option value="لا يوجد مندوب">لا يوجد مندوب</option>
                    <option value="لا يوجد">لا يوجد</option>
                    <option value="بدون مندوب مسند">بدون مندوب مسند</option>
                    <option value="شاغرة">شاغرة</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <button
                  onClick={() => setCurrentTab(3)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>الرجوع لشيت الكاش</span>
                </button>
                <button
                  onClick={() => runReconciliation()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-6 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>تأكيد الإعدادات وتشغيل المطابقة</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Detailed Reconciliation Reports & Sequential Rows */}
        {currentTab === 5 && (
          <div className="space-y-5">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Unique Machines */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 block mb-1">الماكينات الفريدة</span>
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {machinesResults.length.toLocaleString('ar-EG')}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  ينتج عنها{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400">
                    {expandedRows.length.toLocaleString('ar-EG')}
                  </strong>{' '}
                  سطر
                </span>
              </div>

              {/* Single Rep */}
              <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800/60 p-3.5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block mb-1">
                    مندوب واحد
                  </span>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {singleCount.toLocaleString('ar-EG')}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">ماكينة بسطر مستقل</span>
              </div>

              {/* Multi Rep */}
              <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/80 p-3.5 rounded-2xl bg-amber-500/[0.02] shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold block mb-1">
                    متعددة المناديب
                  </span>
                  <Users className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                  {multiCount.toLocaleString('ar-EG')}
                </span>
                <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 block mt-1">
                  مفصلة في <strong>{multiRowsCount.toLocaleString('ar-EG')}</strong> أسطر
                </span>
              </div>

              {/* Vacant / None */}
              <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800/60 p-3.5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold block mb-1">
                    بدون مندوب
                  </span>
                  <UserX className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                  {noneCount.toLocaleString('ar-EG')}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">ماكينة غير مسندة</span>
              </div>

              {/* Duplicates */}
              <div
                onClick={() => setCurrentTab(5)}
                className="bg-white dark:bg-slate-900 border border-amber-500/40 dark:border-amber-600/40 p-3.5 rounded-2xl cursor-pointer hover:border-amber-500 transition-colors shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold block mb-1">
                    تكرار الشيت 1
                  </span>
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <span className="text-xl font-black text-amber-500">
                  {duplicates.length.toLocaleString('ar-EG')}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">ماكينة مكررة</span>
              </div>

              {/* Irregular Accounts */}
              <div
                onClick={() => setCurrentTab(5)}
                className="bg-white dark:bg-slate-900 border border-rose-500/40 dark:border-rose-600/40 p-3.5 rounded-2xl cursor-pointer hover:border-rose-500 transition-colors shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold block mb-1">
                    حسابات شاذة
                  </span>
                  <CircleAlert className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <span className="text-xl font-black text-rose-500">
                  {irregulars.length.toLocaleString('ar-EG')}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">حساب غير منتظم</span>
              </div>
            </div>

            {/* Table Card */}
            <div className="bg-[#0a0f1d] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm font-['Cairo']">
              {/* Notification Alert Banner */}
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-xs flex items-center justify-between flex-wrap gap-2.5 shadow-sm">
                <div className="flex items-center gap-2.5 text-slate-200">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <CircleAlert className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-xs text-slate-300 leading-relaxed">
                    يتم تفصيل كل ماكينة متعددة المناديب في أسطر متتالية تحت بعضها (رقم الماكينة ثم رقم حساب المندوب الأول، وتحته مباشرة نفس رقم الماكينة ورقم حساب المندوب الثاني وهكذا).
                  </span>
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 shrink-0">
                  <CircleAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>جاهز للعرض والتصدير كسطور منفصلة</span>
                </span>
              </div>

              {/* Toolbar & Filter Controls (Glassmorphism Bar) */}
              <div className="p-3.5 rounded-2xl bg-[#0c1220]/80 backdrop-blur-xl border border-slate-800 flex flex-col lg:flex-row justify-between items-center gap-3.5 shadow-lg">
                {/* Right Side: Search Input & Segmented View Controls */}
                <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
                  {/* Search Input */}
                  <div className="relative flex-1 sm:w-80">
                    <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400 text-xs pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                      className="w-full pr-10 pl-9 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500 shadow-inner"
                      placeholder="بحث برقم حساب المندوب أو الماكينة..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setCurrentPage(1);
                          searchInputRef.current?.focus();
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition cursor-pointer"
                        title="مسح البحث"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Segmented Control for Table vs Cards vs Split-View */}
                  <div className="inline-flex rounded-xl p-1 bg-slate-900 border border-slate-800 text-xs font-bold shrink-0">
                    <button
                      onClick={() => setViewMode('table')}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                        viewMode === 'table'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="عرض البيانات كجدول تقليدي"
                    >
                      <TableProperties className="w-3.5 h-3.5" />
                      <span>عرض الجدول (Table)</span>
                    </button>
                    <button
                      onClick={() => setViewMode('cards')}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                        viewMode === 'cards'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="عرض البيانات كبطاقات وبوكسات تفاعلية"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>عرض البطاقات (Cards)</span>
                    </button>
                    <button
                      onClick={() => setViewMode('split')}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                        viewMode === 'split'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="مقارنة جانبية لبيانات الكاش والمدفوعات لنفس الماكينة"
                    >
                      <Split className="w-3.5 h-3.5" />
                      <span>مقارنة جانبية (Split-View)</span>
                    </button>
                  </div>
                </div>

                {/* Left Side: Filter Buttons Capsules + Excel Export Button */}
                <div className="flex items-center gap-3 w-full lg:w-auto justify-end flex-wrap">
                  
                  {/* Account Type Filter Capsule (Cash vs Payments) */}
                  <div className="inline-flex rounded-xl p-1 bg-slate-900 border border-slate-800 text-xs font-bold shrink-0 flex-wrap">
                    <button
                      onClick={() => {
                        setAccountTypeFilter('all');
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        accountTypeFilter === 'all'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      كافة الحسابات
                    </button>
                    <button
                      onClick={() => {
                        setAccountTypeFilter('cash');
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                        accountTypeFilter === 'cash'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'text-slate-300 hover:text-emerald-400'
                      }`}
                      title="عرض ماكينات الكاش فقط ببادئة 7-"
                    >
                      <span>💵 ماكينات الكاش فقط</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-950/50 text-emerald-300 text-[10px] font-mono font-bold">
                        {cashRowsCount}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setAccountTypeFilter('payments');
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                        accountTypeFilter === 'payments'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'text-slate-300 hover:text-blue-400'
                      }`}
                      title="عرض ماكينات المدفوعات فقط بدون 7-"
                    >
                      <span>💳 ماكينات المدفوعات فقط</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-blue-950/50 text-blue-300 text-[10px] font-mono font-bold">
                        {paymentsRowsCount}
                      </span>
                    </button>
                  </div>

                  {/* Status Filter Buttons Capsule */}
                  <div className="inline-flex rounded-xl p-1 bg-slate-900 border border-slate-800 text-xs font-bold shrink-0 flex-wrap">
                    <button
                      onClick={() => {
                        setRepLookupQuery('');
                        setIsRepLookupOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="فتح استعلام أجهزة POS والمناديب"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>استعلام مندوب / ماكينة</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentFilter('all');
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        currentFilter === 'all'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      الكل ({expandedRows.length || 11})
                    </button>
                    <button
                      onClick={() => {
                        setCurrentFilter('single');
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        currentFilter === 'single'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      مندوب واحد
                    </button>
                    <button
                      onClick={() => {
                        setCurrentFilter('multi');
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        currentFilter === 'multi'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      متعددة المناديب
                    </button>
                    <button
                      onClick={() => {
                        setCurrentFilter('none');
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        currentFilter === 'none'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      شاغرة
                    </button>
                  </div>

                  {/* Excel, CSV Export & Print Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => window.print()}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer shrink-0 border border-slate-700"
                      title="طباعة التقرير أو حفظه كملف PDF"
                    >
                      <Download className="w-4 h-4 text-slate-300" />
                      <span>طباعة / PDF</span>
                    </button>
                    <button
                      onClick={handleExportCsv}
                      className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer shrink-0"
                      title="تصدير ملف CSV كامل بدون أي سقف لعدد الصفوف (يتحمل أكثر من 2 مليون صف دون أي اقتطاع)"
                    >
                      <Download className="w-4 h-4 text-blue-200" />
                      <span>تصدير CSV شامل (+1M صف)</span>
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-colors cursor-pointer shrink-0"
                      title="تصدير كملف إكسل (يتم تجزئته لورقات عمل متعددة تلقائياً إذا تجاوز 900 ألف صف)"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                      <span>تصدير Excel (مقسم تلقائياً)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* View Mode: CARDS OR TABLE */}
              {viewMode === 'cards' ? (
                <div className="space-y-4">
                  {displayedSlice.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <CircleAlert className="w-8 h-8 text-amber-500 mx-auto" />
                      <p className="font-bold text-sm">لا توجد نتائج تطابق شرط البحث أو الفلتر.</p>
                      <p className="text-xs">ارفع الشيتات أو اختر «عينة فورية» لتوليد البطاقات تلقائياً.</p>
                    </div>
                  ) : (
                    <div
                      ref={cardsContainerRef}
                      onScroll={(e) => setCardsScrollTop(e.currentTarget.scrollTop)}
                      className="max-h-[550px] overflow-y-auto pr-1"
                    >
                      <div
                        style={{
                          paddingTop: cardsVirtualState.topPadding,
                          paddingBottom: cardsVirtualState.bottomPadding,
                        }}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {displayedSlice.slice(cardsVirtualState.startIndex, cardsVirtualState.endIndex).map((item, idx) => {
                            const globalIdx = (currentPage - 1) * pageSize + cardsVirtualState.startIndex + idx + 1;
                            const isSelected = selectedMachines.has(item.machine);

                            return (
                              <div
                                key={item.id}
                                className={`p-4 rounded-3xl border-2 transition-all shadow-md flex flex-col justify-between gap-3 relative overflow-hidden group ${
                                  item.status === 'multi'
                                    ? 'bg-amber-950/10 dark:bg-slate-900 border-amber-500/40 hover:border-amber-400'
                                    : item.status === 'single'
                                    ? 'bg-emerald-950/10 dark:bg-slate-900 border-emerald-500/40 hover:border-emerald-400'
                                    : 'bg-rose-950/10 dark:bg-slate-900 border-rose-500/40 hover:border-rose-400'
                                }`}
                              >
                                {/* Card Header Box */}
                                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                                      checked={isSelected}
                                      onChange={() => handleToggleSelectRow(item.machine)}
                                    />
                                    <div>
                                      <span className="font-mono font-black text-slate-900 dark:text-white text-base block leading-none">
                                        {item.machine}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                                        بطاقة ماكينة #{globalIdx}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span
                                      className={`px-2 py-0.5 rounded-xl text-[10px] font-black border ${
                                        item.status === 'single'
                                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                          : item.status === 'multi'
                                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                          : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                      }`}
                                    >
                                      {item.status === 'single'
                                        ? 'مندوب واحد (1/1)'
                                        : item.status === 'multi'
                                        ? `مشتركة (${item.repOrder}/${item.totalRepsForMachine})`
                                        : 'شاغرة'}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded-xl text-[10px] font-black border ${
                                        item.type === 'cash'
                                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                          : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                      }`}
                                    >
                                      {item.type === 'cash' ? '💵 كاش' : '💳 مدفوعات'}
                                    </span>
                                  </div>
                                </div>

                                {/* Rep Sub-Card Box */}
                                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold text-[10px]">
                                      بيانات المندوب:
                                    </span>
                                    {item.account !== 'غير متوفر' ? (
                                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                                        حساب: {item.account}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-mono">بدون كود</span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                                      <UserCheck className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                        {item.repName || 'لا يوجد مندوب'}
                                      </p>
                                      {item.isMissingRepName && (
                                        <span className="text-[10px] text-amber-500 font-bold block">
                                          ⚠️ الاسم غير مدون بالشيت
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Card Footer Actions */}
                                <div className="pt-2 flex items-center justify-between text-[11px] border-t border-slate-100 dark:border-slate-800">
                                  <span className="text-slate-400 text-[10px]">
                                    {item.status === 'multi'
                                      ? `مندوب رقم ${item.repOrder} من ${item.totalRepsForMachine}`
                                      : 'ماكينة فردية'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : viewMode === 'split' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 text-slate-200">
                  {/* Right Sidebar: list of unique machines */}
                  <div className="lg:col-span-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-4 flex flex-col space-y-3.5">
                    <div className="border-b border-slate-800 pb-2.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-400">ماكينات التصفية</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {uniqueMachinesInFilter.length} ماكينة
                      </span>
                    </div>

                    {uniqueMachinesInFilter.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-xs">
                        لا توجد نتائج مطابقة للبحث أو الفلتر المختار.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                        {uniqueMachinesInFilter.map((m) => {
                          const isSelected = m.machine === splitSelectedMachine;
                          return (
                            <button
                              key={m.machine}
                              onClick={() => setSplitSelectedMachine(m.machine)}
                              className={`w-full text-right p-3 rounded-2xl border text-xs flex flex-col gap-1 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600/25 border-indigo-500 text-white font-bold shadow-md'
                                  : 'bg-[#0c1220]/60 border-slate-800/80 hover:bg-slate-800/40 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="font-mono font-black">{m.machine}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border ${
                                    m.status === 'single'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : m.status === 'multi'
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  }`}
                                >
                                  {m.status === 'single' ? 'مندوب واحد' : m.status === 'multi' ? 'متعددة' : 'شاغرة'}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 block truncate font-medium">
                                {m.repName || 'لا يوجد مندوب'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Left Main Area: side-by-side comparison panels */}
                  <div className="lg:col-span-3 flex flex-col space-y-4">
                    {!splitSelectedMachine ? (
                      <div className="p-16 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-3xl flex flex-col items-center justify-center space-y-3">
                        <Split className="w-12 h-12 text-indigo-500 animate-pulse" />
                        <p className="font-bold text-sm text-slate-200">الرجاء اختيار ماكينة من القائمة الجانبية لبدء المقارنة الفورية</p>
                        <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                          سيتم سحب كافة البيانات الأصلية والأسطر لهذه الماكينة من شيت المدفوعات وشيت الكاش وعرضها جنباً إلى جنب لمطابقة أسرع وأدق.
                        </p>
                      </div>
                    ) : (() => {
                      const payRows = getPaymentsRowsForMachine(splitSelectedMachine);
                      const cashRows = getCashRowsForMachine(splitSelectedMachine);

                      const totalPayCount = payRows.length;
                      const totalCashCount = cashRows.length;

                      // Extract and cleanup unique accounts in both sheets
                      const payAccounts = Array.from(
                        new Set(
                          payRows
                            .map((r) => String(r[colAcc || Object.keys(r)[0] || ''] || '').trim())
                            .filter((val) => val && val !== 'غير متوفر')
                        )
                      );
                      const cashAccounts = Array.from(
                        new Set(
                          cashRows
                            .map((r) => String(r[colCashAcc || Object.keys(r)[0] || ''] || '').trim())
                            .filter((val) => val && val !== 'غير متوفر')
                        )
                      );

                      // Determine if a dispute or difference exists
                      const countMismatch = totalPayCount !== totalCashCount;
                      const accountsMismatch =
                        payAccounts.length !== cashAccounts.length ||
                        payAccounts.some((acc) => !cashAccounts.includes(acc)) ||
                        cashAccounts.some((acc) => !payAccounts.includes(acc));

                      const hasDiscrepancy = countMismatch || accountsMismatch;

                      return (
                        <div className="space-y-4 font-['Cairo']">
                          {/* Discrepancy analysis alert */}
                          <div
                            className={`p-4 rounded-3xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${
                              hasDiscrepancy
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full ${
                                    hasDiscrepancy ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
                                  }`}
                                />
                                <h4 className="font-bold text-sm text-white">
                                  تحليل المطابقة التلقائية: <span className="font-mono text-indigo-400 font-black">{splitSelectedMachine}</span>
                                </h4>
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                {hasDiscrepancy
                                  ? '⚠️ تم الكشف عن تباين: الماكينة لديها عدد أسطر مختلف أو مناديب غير متطابقين بين الشيتين!'
                                  : '✅ تطابق تام: الماكينة مرتبطة بنفس الحسابات والمناديب في كلا شيتي الكاش والمدفوعات.'}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0 flex-wrap font-sans">
                              <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-950/60 text-slate-300 border border-slate-800">
                                💳 المدفوعات: {totalPayCount} سجل
                              </span>
                              <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-950/60 text-slate-300 border border-slate-800">
                                💵 الكاش: {totalCashCount} سجل
                              </span>
                            </div>
                          </div>

                          {/* Two Side-by-Side adjacent panels */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Payments Column */}
                            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-4 flex flex-col space-y-3">
                              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">💳</span>
                                  <span className="font-bold text-xs text-blue-400">سجلات شيت المدفوعات</span>
                                </div>
                                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono font-black">
                                  {totalPayCount} سجل
                                </span>
                              </div>

                              {totalPayCount === 0 ? (
                                <div className="p-10 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl space-y-1.5">
                                  <p className="text-xs">لا توجد سجلات لهذه الماكينة في شيت المدفوعات.</p>
                                  <p className="text-[10px] text-slate-600 font-sans">يرجى التأكد من اختيار العمود الصحيح للماكينة.</p>
                                </div>
                              ) : (
                                <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                                  {payRows.map((row, rIdx) => {
                                    const mappedAcc = row[colAcc || Object.keys(row)[0]] || 'غير متوفر';
                                    const mappedRepName = row[colRep || Object.keys(row)[1]] || 'لا يوجد مندوب';
                                    return (
                                      <div
                                        key={rIdx}
                                        className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800 hover:border-slate-700/80 transition-all space-y-3 text-right"
                                      >
                                        <div className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-2">
                                          <span className="font-bold text-slate-400">سجل #{rIdx + 1}</span>
                                          <span className="font-mono text-indigo-400 font-black bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                                            حساب: {mappedAcc}
                                          </span>
                                        </div>
                                        <div className="text-xs">
                                          <p className="font-bold text-slate-200">
                                            اسم المندوب: <span className="text-white font-black">{mappedRepName}</span>
                                          </p>
                                        </div>

                                        {/* Grid of all other columns in that row */}
                                        <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-slate-800/40 font-mono text-right">
                                          {Object.entries(row).map(([key, val]) => {
                                            if ([colM2, colAcc, colRep].includes(key)) return null;
                                            return (
                                              <div
                                                key={key}
                                                className="bg-[#0c1220]/50 p-2 rounded-xl border border-slate-800/40 truncate text-right"
                                                title={`${key}: ${val}`}
                                              >
                                                <span className="text-slate-500 block text-[9px] mb-0.5 truncate">{key}</span>
                                                <span className="text-slate-300 font-bold truncate block">{String(val ?? '-')}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Cash Column */}
                            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-4 flex flex-col space-y-3">
                              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">💵</span>
                                  <span className="font-bold text-xs text-emerald-400">سجلات شيت الكاش</span>
                                </div>
                                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-black">
                                  {totalCashCount} سجل
                                </span>
                              </div>

                              {totalCashCount === 0 ? (
                                <div className="p-10 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl space-y-1.5">
                                  <p className="text-xs">لا توجد سجلات لهذه الماكينة في شيت الكاش.</p>
                                  <p className="text-[10px] text-slate-600 font-sans">يرجى التأكد من اختيار العمود الصحيح للماكينة.</p>
                                </div>
                              ) : (
                                <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                                  {cashRows.map((row, rIdx) => {
                                    const mappedAcc = row[colCashAcc || Object.keys(row)[0]] || 'غير متوفر';
                                    const mappedRepName = row[colCashRep || Object.keys(row)[1]] || 'لا يوجد مندوب';
                                    return (
                                      <div
                                        key={rIdx}
                                        className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800 hover:border-slate-700/80 transition-all space-y-3 text-right"
                                      >
                                        <div className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-2">
                                          <span className="font-bold text-slate-400">سجل #{rIdx + 1}</span>
                                          <span className="font-mono text-indigo-400 font-black bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                                            حساب: {mappedAcc}
                                          </span>
                                        </div>
                                        <div className="text-xs">
                                          <p className="font-bold text-slate-200">
                                            اسم المسؤول: <span className="text-white font-black">{mappedRepName}</span>
                                          </p>
                                        </div>

                                        {/* Grid of all other columns in that row */}
                                        <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-slate-800/40 font-mono text-right">
                                          {Object.entries(row).map(([key, val]) => {
                                            if ([colM3, colCashAcc, colCashRep].includes(key)) return null;
                                            return (
                                              <div
                                                key={key}
                                                className="bg-[#0c1220]/50 p-2 rounded-xl border border-slate-800/40 truncate text-right"
                                                title={`${key}: ${val}`}
                                              >
                                                <span className="text-slate-500 block text-[9px] mb-0.5 truncate">{key}</span>
                                                <span className="text-slate-300 font-bold truncate block">{String(val ?? '-')}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                /* Table View */
                <div
                  ref={tableContainerRef}
                  onScroll={(e) => setTableScrollTop(e.currentTarget.scrollTop)}
                  className="max-h-[550px] overflow-y-auto border border-slate-800/90 rounded-2xl bg-slate-900/80 backdrop-blur-md shadow-2xl relative"
                >
                  <table className="w-full text-right border-collapse text-xs">
                    <thead className="bg-[#0a0f1d] text-slate-400 font-bold border-b border-slate-800 sticky top-0 z-20 shadow-md">
                      <tr>
                        <th className="p-3.5 w-12 text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 cursor-pointer"
                            checked={
                              displayedSlice.length > 0 &&
                              displayedSlice.every((r) => selectedMachines.has(r.machine))
                            }
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                            title="تحديد الكل المعروض"
                          />
                        </th>
                        <th className="p-3.5 w-14 text-center font-mono">م</th>
                        <th className="p-3.5 w-48">رقم الماكينة</th>
                        <th className="p-3.5 w-32 text-center">نوع الحساب</th>
                        <th className="p-3.5 w-40">رقم حساب المندوب</th>
                        <th className="p-3.5">اسم المندوب المسند</th>
                        <th className="p-3.5 w-48 text-center">ترتيب المندوب للماكينة</th>
                        <th className="p-3.5 w-40 text-center">حالة الماكينة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300">
                      {displayedSlice.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            لا توجد نتائج تطابق شرط البحث أو الفلتر. ارفع الشيتات أو اختر «عينة فورية».
                          </td>
                        </tr>
                      ) : (
                        <>
                          {tableVirtualState.topPadding > 0 && (
                            <tr style={{ border: 'none' }}>
                              <td colSpan={8} style={{ height: tableVirtualState.topPadding, padding: 0, border: 'none' }} />
                            </tr>
                          )}
                          {displayedSlice.slice(tableVirtualState.startIndex, tableVirtualState.endIndex).map((item, idx) => {
                            const globalIdx = (currentPage - 1) * pageSize + tableVirtualState.startIndex + idx + 1;
                            const isSelected = selectedMachines.has(item.machine);
                            const isChildRow = item.status === 'multi' && item.repOrder > 1;

                            const rowClass = isChildRow
                              ? 'bg-slate-950/60 hover:bg-slate-800/40 transition-colors'
                              : 'hover:bg-slate-800/50 transition-colors';

                            return (
                              <tr key={item.id} className={rowClass} style={{ height: tableRowHeight }}>
                                <td className="p-3.5 text-center">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 cursor-pointer"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectRow(item.machine)}
                                  />
                                </td>
                                <td className="p-3.5 text-center text-slate-500 font-mono font-bold">
                                  {globalIdx}
                                </td>

                                {/* Machine Column */}
                                <td className="p-3.5">
                                  {isChildRow ? (
                                    <div className="flex items-center gap-2 font-mono font-bold text-slate-300 pr-3 border-r-2 border-indigo-500/50">
                                      <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                                      <span className="tracking-wide">{item.machine}</span>
                                      <span className="text-[10px] text-slate-400 font-sans font-normal px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
                                        (تابع)
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="font-mono font-black text-white text-sm tracking-wide">
                                      {item.machine}
                                    </span>
                                  )}
                                </td>

                                {/* Account Type Column */}
                                 <td className="p-3.5 text-center font-bold">
                                   {item.type === 'cash' ? (
                                     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#042016] text-[#34d399] border border-[#065f46] shadow-sm">
                                       <span>💵</span>
                                       <span>كاش (-7)</span>
                                     </span>
                                   ) : (
                                     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#0d1427] text-[#38bdf8] border border-[#1e3a8a] shadow-sm">
                                       <span>💳</span>
                                       <span>مدفوعات</span>
                                     </span>
                                   )}
                                 </td>

                                 {/* Account Column */}
                                <td className="p-3.5">
                                  {item.account === 'غير متوفر' ? (
                                    <span className="text-slate-500 font-mono text-xs">غير متوفر</span>
                                  ) : (
                                    <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-blue-950/60 text-blue-400 border border-blue-500/30 inline-block">
                                      {item.account}
                                    </span>
                                  )}
                                </td>

                                 {/* Rep Name Column */}
                                <td className="p-3.5">
                                  {item.status === 'none' || item.isMissingRepName ? (
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700/60 text-rose-400 flex items-center justify-center text-xs shadow-inner">
                                        <UserX className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="text-xs font-bold text-rose-400">
                                        {item.repName || 'لا يوجد مندوب مسند'}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2.5 text-right">
                                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700/60 text-blue-400 flex items-center justify-center text-xs shadow-inner">
                                        <UserCheck className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="font-bold text-white text-xs">
                                        {item.repName}
                                      </span>
                                    </div>
                                  )}
                                </td>

                                {/* Rep Order Column */}
                                <td className="p-3.5 text-center">
                                  {item.status === 'none' ? (
                                    <span className="text-xs text-slate-500 font-bold">-</span>
                                  ) : item.status === 'single' ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      مندوب رئيسي (1 من 1)
                                    </span>
                                  ) : item.repOrder === 1 ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      المندوب الأول (1 من {item.totalRepsForMachine})
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700/60">
                                      مندوب إضافي ({item.repOrder} من {item.totalRepsForMachine})
                                    </span>
                                  )}
                                </td>

                                {/* Machine Status Column */}
                                <td className="p-3.5 text-center">
                                  {item.status === 'single' ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      مندوب فردي
                                    </span>
                                  ) : item.status === 'multi' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                      <CircleAlert className="w-3.5 h-3.5 text-indigo-400" />
                                      <span>متعددة ({item.totalRepsForMachine} مناديب)</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                      شاغرة
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {tableVirtualState.bottomPadding > 0 && (
                            <tr style={{ border: 'none' }}>
                              <td colSpan={8} style={{ height: tableVirtualState.bottomPadding, padding: 0, border: 'none' }} />
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {viewMode !== 'split' && (
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                  <div>
                    عرض{' '}
                    <span className="font-bold text-slate-800 dark:text-white">
                      {displayedSlice.length}
                    </span>{' '}
                    من{' '}
                    <span className="font-bold text-slate-800 dark:text-white">
                      {filteredRows.length}
                    </span>{' '}
                    سطر مفصل
                  </div>
                  <div className="flex items-center gap-1 font-bold">
                    <button
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1 px-2.5 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span>السابق</span>
                    </button>
                    <span className="px-2">
                      صفحة {currentPage} من {maxPages}
                    </span>
                    <button
                      disabled={currentPage >= maxPages}
                      onClick={() => setCurrentPage((p) => Math.min(maxPages, p + 1))}
                      className="p-1 px-2.5 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                    >
                      <span>التالي</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: Audit & Conflict Inspection */}
        {currentTab === 6 && (
          <AuditConflictsTab
            duplicates={duplicates}
            irregulars={irregulars}
            onFilterDuplicates={() => {
              if (duplicates.length > 0) {
                setSearchQuery(duplicates[0].machine);
                setCurrentFilter('all');
                setCurrentTab(5);
                showToast(`🔍 تم تصفية الماكينة المكررة: ${duplicates[0].machine}`);
              }
            }}
            onFilterIrregulars={() => {
              if (irregulars.length > 0) {
                setSearchQuery(irregulars[0].account);
                setCurrentFilter('all');
                setCurrentTab(5);
                showToast(`🔍 تم تصفية الحساب الشاذ: ${irregulars[0].account}`);
              }
            }}
          />
        )}

        {/* TAB 7: Standalone Desktop App & HTML Exporter */}
        {currentTab === 7 && (
          <DesktopAppTab
            sheet1={sheet1}
            sheet2={sheet2}
            expandedRows={expandedRows}
            machinesResults={machinesResults}
            onOpenManualEditor={(mode) => {
              setEditorInitialMode(mode);
              setIsManualEditorOpen(true);
            }}
          />
        )}

        {/* TAB 8: Dedicated Rep & Machine Direct Inquiry Hub */}
        {currentTab === 8 && (
          <div className="space-y-4">
            <InstantRepInquiry
              sheet2Count={effectiveSheet2Count}
              sheet3Count={effectiveSheet3Count}
              sheet2FileName={sheet2FileName}
              sheet3FileName={sheet3FileName}
              colM2={colM2}
              colAcc={colAcc}
              colRep={colRep}
              colM3={colM3}
              colCashAcc={colCashAcc}
              colCashRep={colCashRep}
              onOpenFullLookup={(query) => {
                setRepLookupQuery(query || '');
                setIsRepLookupOpen(true);
              }}
              onClearInquirySheets={handleClearInquirySheets}
              showToast={showToast}
              isStandaloneTab={true}
            />
          </div>
        )}
      </main>

      {/* Bulk Floating Action Bar */}
      <BulkActionBar
        selectedCount={selectedMachines.size}
        onClearSelection={() => setSelectedMachines(new Set())}
        onReassign={handleBulkReassign}
        onMarkVacant={handleBulkMarkVacant}
      />

      {/* Interactive Progress Modal matching screenshot */}
      <ProgressModal
        isOpen={progressState.isOpen}
        onClose={() => {
          setProgressState((p) => ({ ...p, isOpen: false }));
        }}
        onConfirm={handleProgressModalConfirm}
        title={progressState.title}
        fileName={progressState.fileName}
        subtitle={progressState.subtitle}
        percent={progressState.percent}
        statusText={progressState.statusText}
        uploadedSheetType={progressState.uploadedSheetType}
        onNavigateToSheet={(type) => {
          if (type === 'sheet1') setCurrentTab(1);
          else if (type === 'sheet2') setCurrentTab(2);
          else if (type === 'sheet3') setCurrentTab(3);
        }}
      />

      {/* Big File Splitter Modal */}
      <BigFileSplitterModal
        isOpen={isSplitterOpen}
        onClose={() => setIsSplitterOpen(false)}
        defaultSheetType={splitterDefaultType}
        onApplyToSheet={async (rows, fileName, sheetType) => {
          setIsSplitterOpen(false);
          const targetUploadedType = sheetType === 'payments' ? 'sheet2' : 'sheet3';
          const targetTitle = sheetType === 'payments' ? 'اعتماد شيت المدفوعات' : 'اعتماد شيت أجهزة الكاش';

          // 1. Show loading screen immediately with fast responsive progress
          setProgressState({
            isOpen: true,
            title: targetTitle,
            fileName: fileName,
            subtitle: `جاري اعتماد وتفريغ بيانات شيت ${sheetType === 'payments' ? 'المدفوعات' : 'الكاش'} في المسار الخلفي المعزول...`,
            percent: 15,
            statusText: 'بدء اعتماد وتثبيت السجلات في مسار Web Worker المعزول دون تجميد...',
            uploadedSheetType: targetUploadedType,
          });

          try {
            const res = await approveSheetWithWorker(
              rows,
              sheetType,
              sheet1.length,
              (pct, text) => {
                setProgressState((prev) => ({
                  ...prev,
                  percent: pct,
                  statusText: text || 'اعتماد وتثبيت البيانات...',
                }));
              }
            );

            // 2. Save full records in high-speed memory cache (Zero UI freeze)
            chunkCache.setRows(targetUploadedType, rows);

            // 3. Set preview rows (50 records) and total count in React state
            if (sheetType === 'payments') {
              setSheet2(res.previewRows);
              setSheet2TotalCount(res.totalCount);
              setSheet2FileName(fileName);
              if (res.detectedCols.activeM) setColM2(res.detectedCols.activeM);
              if (res.detectedCols.activeAcc) setColAcc(res.detectedCols.activeAcc);
              if (res.detectedCols.activeRep) setColRep(res.detectedCols.activeRep);
            } else {
              setSheet3(res.previewRows);
              setSheet3TotalCount(res.totalCount);
              setSheet3FileName(fileName);
              if (res.detectedCols.activeM) setColM3(res.detectedCols.activeM);
              if (res.detectedCols.activeAcc) setColCashAcc(res.detectedCols.activeAcc);
              if (res.detectedCols.activeRep) setColCashRep(res.detectedCols.activeRep);
            }

            setProgressState((prev) => ({
              ...prev,
              percent: 100,
              statusText: `✅ تم اكتمال الاعتماد بنجاح! تم حفظ وتثبيت ${rows.length.toLocaleString('ar-EG')} سجل بالكامل في الذاكرة الذكية، وعرض عينة معاينة لأول 50 سجل.`,
            }));
            showToast(`✅ تم اكتمال الاعتماد بنجاح: تم رفع شيت ${sheetType === 'payments' ? 'المدفوعات' : 'الكاش'} (${rows.length.toLocaleString('ar-EG')} سجل)`);
          } catch (err: any) {
            console.error('Approval failed:', err);
            setProgressState((p) => ({ ...p, isOpen: false }));
            showToast(`❌ تعذر اعتماد الشيت: ${err?.message || 'يرجى المحاولة مجدداً.'}`);
          }
        }}
      />

      {/* App-level Zip File Picker Modal */}
      <ZipFilePickerModal
        isOpen={appZipPicker.isOpen}
        zipFile={appZipPicker.zipFile}
        files={appZipPicker.files}
        targetSheetLabel={
          appZipPicker.target === 'sheet1'
            ? 'شيت الماكينات'
            : appZipPicker.target === 'sheet2'
            ? 'شيت المدفوعات'
            : 'شيت الكاش'
        }
        onSelectFile={(extractedFile) => {
          const target = appZipPicker.target;
          setAppZipPicker({ isOpen: false, zipFile: null, files: [], target: 'sheet2' });
          if (target === 'sheet1') handleSheet1Upload(extractedFile);
          else if (target === 'sheet2') handleSheet2Upload(extractedFile);
          else if (target === 'sheet3') handleSheet3Upload(extractedFile);
        }}
        onClose={() => {
          setAppZipPicker({ isOpen: false, zipFile: null, files: [], target: 'sheet2' });
          setIsSheet1Loading(false);
          setIsSheet2Loading(false);
          setIsSheet3Loading(false);
        }}
      />

      {/* Compression Guidance & Tips Modal */}
      <CompressionTipsModal
        isOpen={isCompressionTipsOpen}
        onClose={() => setIsCompressionTipsOpen(false)}
      />
    </div>
  );
}
