import { SheetRow } from '../types';
import { chunkCache } from './chunkCache';

export interface RealRepLink {
  id: string;
  sourceSheet: 'payments' | 'cash';
  sourceSheetLabel: string;
  fileRowIndex: number;
  machineId: string;
  repId: string;
  repName: string;
  isRepeated: boolean;
  repeatIndex: number;
  totalRepeatsForMachine: number;
  repeatDetails: string;
  rawColumns: Record<string, any>;
}

export interface RealRepSearchResult {
  query: string;
  searchedRepId: string;
  searchedRepName: string;
  totalRecords: number;
  uniqueMachinesCount: number;
  repeatedMachinesCount: number;
  paymentsCount: number;
  cashCount: number;
  records: RealRepLink[];
  availableRepsInSheets: Array<{ repId: string; repName: string; count: number; paymentsCount: number; cashCount: number }>;
}

export function cleanNumber(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\.0$/, '');
}

/**
 * Robustly detects machine and rep columns from actual row keys
 */
export function detectSheetColumns(
  sampleRow: Record<string, any>,
  sheetType: 'payments' | 'cash',
  userOverrides?: { mCol?: string; accCol?: string; repCol?: string }
): { mCol: string; accCol: string; repCol: string } {
  const keys = Object.keys(sampleRow || {}).filter((k) => !k.startsWith('_'));
  if (keys.length === 0) {
    return { mCol: '', accCol: '', repCol: '' };
  }

  let mCol = '';
  let accCol = '';
  let repCol = '';

  if (sheetType === 'payments') {
    // Machine column in payments
    mCol =
      (userOverrides?.mCol && keys.includes(userOverrides.mCol) ? userOverrides.mCol : '') ||
      keys.find((k) => /^(acceptor1|acceptor_1|acceptor 1|acceptor|ماكينة المدفوعات|ماكينه المدفوعات)$/i.test(k)) ||
      keys.find((k) => /(acceptor.*1|^acceptor$|ماكين.*مدفوعات)/i.test(k)) ||
      keys.find((k) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(k)) ||
      keys[0];

    // Rep account column in payments (MUST NOT EQUAL mCol!)
    accCol =
      (userOverrides?.accCol && keys.includes(userOverrides.accCol) && userOverrides.accCol !== mCol
        ? userOverrides.accCol
        : '') ||
      keys.find((k) => k !== mCol && /^(doner1|donor1|doner_1|donor_1|doner 1|donor 1|doner|donor|رقم حساب المدفوعات|حساب المدفوعات)$/i.test(k)) ||
      keys.find((k) => k !== mCol && /(doner.*1|donor.*1|^doner$|^donor$|حساب.*مدفوعات|رقم.*المدفوعات)/i.test(k)) ||
      keys.find((k) => k !== mCol && /حساب|كود|رقم.*مندوب|account|acc|code|doner|donor/i.test(k)) ||
      keys.find((k) => k !== mCol) ||
      keys[1] ||
      keys[0];

    // Rep name column
    repCol =
      (userOverrides?.repCol && keys.includes(userOverrides.repCol) ? userOverrides.repCol : '') ||
      keys.find((k) => /اسم.*مندوب|اسم.*العميل|اسم.*المستخدم|اسم|rep.*name|agent.*name|name/i.test(k)) ||
      accCol;
  } else {
    // Machine column in cash
    mCol =
      (userOverrides?.mCol && keys.includes(userOverrides.mCol) ? userOverrides.mCol : '') ||
      keys.find((k) => /^(acceptor2|acceptor_2|acceptor 2|رقم ماكينه الكاش|ماكينه الكاش|ماكينة الكاش)$/i.test(k)) ||
      keys.find((k) => /(acceptor.*2|ماكين.*كاش|ماكينة.*الكاش)/i.test(k)) ||
      keys.find((k) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(k)) ||
      keys[0];

    // Rep account column in cash (MUST NOT EQUAL mCol!)
    accCol =
      (userOverrides?.accCol && keys.includes(userOverrides.accCol) && userOverrides.accCol !== mCol
        ? userOverrides.accCol
        : '') ||
      keys.find((k) => k !== mCol && /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2|رقم الكاش المدفوعات|رقم الكاش|حساب الكاش|رقم المندوب الكاش)$/i.test(k)) ||
      keys.find((k) => k !== mCol && /(doner.*2|donor.*2|كاش.*مدفوعات|رقم.*الكاش|حساب.*الكاش)/i.test(k)) ||
      keys.find((k) => k !== mCol && /حساب|كود|رقم.*مندوب|account|acc|code|doner|donor/i.test(k)) ||
      keys.find((k) => k !== mCol) ||
      keys[1] ||
      keys[0];

    // Rep name column in cash
    repCol =
      (userOverrides?.repCol && keys.includes(userOverrides.repCol) ? userOverrides.repCol : '') ||
      keys.find((k) => /اسم.*مندوب|اسم.*العميل|اسم.*المستخدم|اسم|rep.*name|agent.*name|name/i.test(k)) ||
      accCol;
  }

  // Final safety check: if mCol and accCol are identical and sheet has > 1 column, pick another column
  if (mCol === accCol && keys.length > 1) {
    accCol = keys.find((k) => k !== mCol) || accCol;
  }

  return { mCol, accCol, repCol };
}

/**
 * Searches exclusively in Sheet 2 (Payments) and Sheet 3 (Cash)
 * Using 100% real data from uploaded sheets with ZERO fake numbers.
 */
export function executeRealRepInquiry(
  searchQuery: string,
  options?: {
    colM2?: string;
    colAcc?: string;
    colRep?: string;
    colM3?: string;
    colCashAcc?: string;
    colCashRep?: string;
    sheet2Fallback?: SheetRow[];
    sheet3Fallback?: SheetRow[];
  }
): RealRepSearchResult {
  const rawQ = (searchQuery || '').trim();
  const cleanQ = cleanNumber(rawQ).toLowerCase();

  // Retrieve actual rows from chunkCache or fallbacks
  let sheet2Rows: SheetRow[] = chunkCache.getCount('sheet2') > 0
    ? chunkCache.getRows<SheetRow>('sheet2')
    : (options?.sheet2Fallback || []);

  let sheet3Rows: SheetRow[] = chunkCache.getCount('sheet3') > 0
    ? chunkCache.getRows<SheetRow>('sheet3')
    : (options?.sheet3Fallback || []);

  // Determine actual column names for Sheet 2
  const s2Cols = sheet2Rows.length > 0
    ? detectSheetColumns(sheet2Rows[0], 'payments', {
        mCol: options?.colM2,
        accCol: options?.colAcc,
        repCol: options?.colRep,
      })
    : { mCol: '', accCol: '', repCol: '' };

  // Determine actual column names for Sheet 3
  const s3Cols = sheet3Rows.length > 0
    ? detectSheetColumns(sheet3Rows[0], 'cash', {
        mCol: options?.colM3,
        accCol: options?.colCashAcc,
        repCol: options?.colCashRep,
      })
    : { mCol: '', accCol: '', repCol: '' };

  // 1. Build a catalog of all unique reps present in the uploaded sheets
  const repCatalogMap = new Map<string, { repId: string; repName: string; count: number; paymentsCount: number; cashCount: number }>();

  const processCatalogRow = (row: SheetRow, accCol: string, repCol: string, type: 'payments' | 'cash') => {
    const rawAcc = String(row[accCol] ?? '').trim();
    const cleanAcc = cleanNumber(rawAcc);
    if (!cleanAcc) return;

    const rawRepName = String(row[repCol] ?? rawAcc).trim();
    let entry = repCatalogMap.get(cleanAcc);
    if (!entry) {
      entry = {
        repId: rawAcc,
        repName: rawRepName || rawAcc,
        count: 0,
        paymentsCount: 0,
        cashCount: 0,
      };
      repCatalogMap.set(cleanAcc, entry);
    }
    entry.count++;
    if (type === 'payments') entry.paymentsCount++;
    else entry.cashCount++;
  };

  if (s2Cols.accCol) {
    for (let i = 0; i < sheet2Rows.length; i++) {
      processCatalogRow(sheet2Rows[i], s2Cols.accCol, s2Cols.repCol, 'payments');
    }
  }

  if (s3Cols.accCol) {
    for (let i = 0; i < sheet3Rows.length; i++) {
      processCatalogRow(sheet3Rows[i], s3Cols.accCol, s3Cols.repCol, 'cash');
    }
  }

  const availableRepsInSheets = Array.from(repCatalogMap.values()).sort((a, b) => b.count - a.count);

  if (!cleanQ) {
    return {
      query: '',
      searchedRepId: '',
      searchedRepName: '',
      totalRecords: 0,
      uniqueMachinesCount: 0,
      repeatedMachinesCount: 0,
      paymentsCount: 0,
      cashCount: 0,
      records: [],
      availableRepsInSheets,
    };
  }

  // 2. Scan both sheets for matching rows based on the user's search query
  interface TempMatch {
    sourceSheet: 'payments' | 'cash';
    sourceSheetLabel: string;
    fileRowIndex: number;
    machineId: string;
    cleanMachineId: string;
    repId: string;
    cleanRepId: string;
    repName: string;
    rawRow: SheetRow;
  }

  const rawMatches: TempMatch[] = [];

  // Scan Sheet 2 (Payments)
  if (s2Cols.mCol && s2Cols.accCol) {
    for (let i = 0; i < sheet2Rows.length; i++) {
      const row = sheet2Rows[i];
      const rawM = String(row[s2Cols.mCol] ?? '').trim();
      const rawAcc = String(row[s2Cols.accCol] ?? '').trim();
      const rawRep = String(row[s2Cols.repCol] ?? rawAcc).trim();

      const cM = cleanNumber(rawM);
      const cAcc = cleanNumber(rawAcc);
      const cRep = rawRep.toLowerCase();

      // Check if this row matches query by Rep ID, Rep Name, Machine ID, or any cell
      const matchRepId = cAcc === cleanQ || cAcc.includes(cleanQ) || cleanQ.includes(cAcc);
      const matchRepName = cRep.includes(cleanQ);
      const matchMachine = cM === cleanQ || cM.includes(cleanQ);

      let matchAnyCell = false;
      if (!matchRepId && !matchRepName && !matchMachine) {
        for (const k of Object.keys(row)) {
          const valStr = cleanNumber(row[k]);
          if (valStr === cleanQ || (cleanQ.length >= 4 && valStr.includes(cleanQ))) {
            matchAnyCell = true;
            break;
          }
        }
      }

      if (matchRepId || matchRepName || matchMachine || matchAnyCell) {
        rawMatches.push({
          sourceSheet: 'payments',
          sourceSheetLabel: 'شيت المدفوعات',
          fileRowIndex: i + 1,
          machineId: rawM || 'غير مدون',
          cleanMachineId: cM,
          repId: rawAcc || 'غير مدون',
          cleanRepId: cAcc,
          repName: rawRep || rawAcc || 'غير مدون',
          rawRow: row,
        });
      }
    }
  }

  // Scan Sheet 3 (Cash)
  if (s3Cols.mCol && s3Cols.accCol) {
    for (let i = 0; i < sheet3Rows.length; i++) {
      const row = sheet3Rows[i];
      let rawM = String(row[s3Cols.mCol] ?? '').trim();
      if (rawM && !rawM.startsWith('7-') && !rawM.startsWith('٧-')) {
        rawM = `7-${rawM}`;
      }
      const rawAcc = String(row[s3Cols.accCol] ?? '').trim();
      const rawRep = String(row[s3Cols.repCol] ?? rawAcc).trim();

      const cM = cleanNumber(rawM.replace(/^7-|^٧-/, ''));
      const cAcc = cleanNumber(rawAcc);
      const cRep = rawRep.toLowerCase();

      const matchRepId = cAcc === cleanQ || cAcc.includes(cleanQ) || cleanQ.includes(cAcc);
      const matchRepName = cRep.includes(cleanQ);
      const matchMachine = cM === cleanQ || cM.includes(cleanQ);

      let matchAnyCell = false;
      if (!matchRepId && !matchRepName && !matchMachine) {
        for (const k of Object.keys(row)) {
          const valStr = cleanNumber(row[k]);
          if (valStr === cleanQ || (cleanQ.length >= 4 && valStr.includes(cleanQ))) {
            matchAnyCell = true;
            break;
          }
        }
      }

      if (matchRepId || matchRepName || matchMachine || matchAnyCell) {
        rawMatches.push({
          sourceSheet: 'cash',
          sourceSheetLabel: 'شيت الكاش',
          fileRowIndex: i + 1,
          machineId: rawM || '7-غير مدون',
          cleanMachineId: cM,
          repId: rawAcc || 'غير مدون',
          cleanRepId: cAcc,
          repName: rawRep || rawAcc || 'مسؤول كاش',
          rawRow: row,
        });
      }
    }
  }

  if (rawMatches.length === 0) {
    return {
      query: rawQ,
      searchedRepId: rawQ,
      searchedRepName: '',
      totalRecords: 0,
      uniqueMachinesCount: 0,
      repeatedMachinesCount: 0,
      paymentsCount: 0,
      cashCount: 0,
      records: [],
      availableRepsInSheets,
    };
  }

  // 3. Count machine repetitions for this representative
  // Group by (cleanRepId + cleanMachineId)
  const repetitionGroupMap = new Map<string, TempMatch[]>();
  rawMatches.forEach((m) => {
    const key = `${m.cleanRepId}___${m.cleanMachineId}`;
    let list = repetitionGroupMap.get(key);
    if (!list) {
      list = [];
      repetitionGroupMap.set(key, list);
    }
    list.push(m);
  });

  const finalRecords: RealRepLink[] = [];
  const uniqueMachinesSet = new Set<string>();
  let repeatedMachinesCount = 0;
  let paymentsCount = 0;
  let cashCount = 0;

  for (const group of repetitionGroupMap.values()) {
    const totalRepeats = group.length;
    const isRepeated = totalRepeats > 1;

    if (isRepeated) {
      repeatedMachinesCount++;
    }

    const hasPay = group.some((g) => g.sourceSheet === 'payments');
    const hasCash = group.some((g) => g.sourceSheet === 'cash');

    let repeatDetails = 'ربط فردي سليم';
    if (isRepeated) {
      if (hasPay && hasCash) {
        repeatDetails = `مشترك ومكرر بين شيت المدفوعات والكاش (${totalRepeats} مرات)`;
      } else if (hasPay) {
        repeatDetails = `مكرر الربط داخل شيت المدفوعات (${totalRepeats} مرات)`;
      } else {
        repeatDetails = `مكرر الربط داخل شيت الكاش (${totalRepeats} مرات)`;
      }
    }

    group.forEach((item, idx) => {
      uniqueMachinesSet.add(item.cleanMachineId);
      if (item.sourceSheet === 'payments') paymentsCount++;
      if (item.sourceSheet === 'cash') cashCount++;

      finalRecords.push({
        id: `${item.sourceSheet}-${item.fileRowIndex}-${idx}`,
        sourceSheet: item.sourceSheet,
        sourceSheetLabel: item.sourceSheetLabel,
        fileRowIndex: item.fileRowIndex,
        machineId: item.machineId,
        repId: item.repId,
        repName: item.repName,
        isRepeated,
        repeatIndex: idx + 1,
        totalRepeatsForMachine: totalRepeats,
        repeatDetails,
        rawColumns: item.rawRow,
      });
    });
  }

  // Sort: Repeated machines first, then alphabetically by machine ID, then by repeatIndex
  finalRecords.sort((a, b) => {
    if (a.isRepeated !== b.isRepeated) return a.isRepeated ? -1 : 1;
    if (a.machineId !== b.machineId) return a.machineId.localeCompare(b.machineId, 'ar', { numeric: true });
    return a.repeatIndex - b.repeatIndex;
  });

  const primaryMatch = rawMatches[0];

  return {
    query: rawQ,
    searchedRepId: primaryMatch?.repId || rawQ,
    searchedRepName: primaryMatch?.repName || '',
    totalRecords: finalRecords.length,
    uniqueMachinesCount: uniqueMachinesSet.size,
    repeatedMachinesCount,
    paymentsCount,
    cashCount,
    records: finalRecords,
    availableRepsInSheets,
  };
}
