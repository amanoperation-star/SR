import { SheetRow, ExpandedRow } from '../types';

interface ChunkStore<T> {
  chunks: T[][];
  totalCount: number;
  chunkSize: number;
}

export interface RepLookupRecord {
  id: string;
  rowIdx: number;
  machine: string;
  normMachine: string;
  account: string;
  normAcc: string;
  repName: string;
  sheetType: 'payments' | 'cash';
  sheetTypeLabel: string;
  isRepeated: boolean;
  repeatIndex: number;
  totalRepetitions: number;
  repeatReason: string;
  rawRow: any;
}

export interface RepSearchResult {
  query: string;
  records: RepLookupRecord[];
  totalMatches: number;
  uniqueMachinesCount: number;
  repeatedMachinesCount: number;
  paymentsCount: number;
  cashCount: number;
  uniqueRepAccounts: string[];
}

interface RepIndexEntry {
  machine: string;
  normMachine: string;
  account: string;
  normAcc: string;
  repName: string;
  sheetType: 'payments' | 'cash';
  rowIdx: number;
  rawRow: any;
  allCellTokens: string[];
}

function normalizeDigits(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\.0$/, '');
}

class MemoryChunkCacheManager {
  private cache: Map<string, ChunkStore<any>> = new Map();
  private chunkSize = 50000; // 50k rows per chunk

  // Inverted Rep index: normAcc -> RepIndexEntry[]
  private repIndex: Map<string, RepIndexEntry[]> = new Map();
  // Machine index: normMachine -> RepIndexEntry[]
  private machineIndex: Map<string, RepIndexEntry[]> = new Map();
  // Flat list of all indexed entries for universal queries
  private allEntries: RepIndexEntry[] = [];
  // Dirty flag to know when to rebuild index
  private isIndexDirty = false;
  private lastIndexCols: string = '';

  constructor() {
    // Auto-cleanup on window unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.clearAll();
      });
    }
  }

  public setRows<T>(key: string, rows: T[]): void {
    if (!rows || rows.length === 0) {
      this.cache.delete(key);
      this.isIndexDirty = true;
      return;
    }

    const chunks: T[][] = [];
    for (let i = 0; i < rows.length; i += this.chunkSize) {
      chunks.push(rows.slice(i, i + this.chunkSize));
    }

    this.cache.set(key, {
      chunks,
      totalCount: rows.length,
      chunkSize: this.chunkSize,
    });

    if (key === 'sheet2' || key === 'sheet3') {
      this.isIndexDirty = true;
    }
  }

  public getRows<T>(key: string): T[] {
    const store = this.cache.get(key);
    if (!store || !store.chunks || store.chunks.length === 0) {
      return [];
    }
    const result: T[] = [];
    for (const chunk of store.chunks) {
      result.push(...chunk);
    }
    return result;
  }

  public getRowAt<T>(key: string, index: number): T | undefined {
    const store = this.cache.get(key);
    if (!store || index < 0 || index >= store.totalCount) return undefined;
    const chunkIdx = Math.floor(index / store.chunkSize);
    const itemIdx = index % store.chunkSize;
    return store.chunks[chunkIdx]?.[itemIdx];
  }

  public getCount(key: string): number {
    const store = this.cache.get(key);
    return store ? store.totalCount : 0;
  }

  public slice<T>(key: string, start: number, end: number): T[] {
    const store = this.cache.get(key);
    if (!store || store.totalCount === 0) return [];
    
    const result: T[] = [];
    const actualEnd = Math.min(end, store.totalCount);
    for (let i = Math.max(0, start); i < actualEnd; i++) {
      const item = this.getRowAt<T>(key, i);
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  public getPreview<T>(key: string, limit = 50): T[] {
    return this.slice<T>(key, 0, limit);
  }

  public filterRows<T>(key: string, predicate: (item: T) => boolean, maxResults = 200): T[] {
    const store = this.cache.get(key);
    if (!store || !store.chunks) return [];
    const matches: T[] = [];
    for (const chunk of store.chunks) {
      for (const item of chunk) {
        if (predicate(item)) {
          matches.push(item);
          if (matches.length >= maxResults) return matches;
        }
      }
    }
    return matches;
  }

  /**
   * Rebuilds fast inverted indexing for Sheet 2 (Payments) and Sheet 3 (Cash)
   */
  public rebuildRepIndex(cols?: {
    colM2?: string;
    colAcc?: string;
    colRep?: string;
    colM3?: string;
    colCashAcc?: string;
    colCashRep?: string;
  }): void {
    const colSignature = JSON.stringify(cols || {});
    if (!this.isIndexDirty && this.lastIndexCols === colSignature) {
      return;
    }

    this.repIndex.clear();
    this.machineIndex.clear();
    this.allEntries = [];

    const s2Store = this.cache.get('sheet2');
    const s3Store = this.cache.get('sheet3');

    // 1. Index Sheet 2 (Payments) if available
    if (s2Store && s2Store.chunks) {
      const sample = s2Store.chunks[0]?.[0] || {};
      const s2Keys = Object.keys(sample);

      // Ensure effectiveM2 and effectiveAcc2 are NOT the same!
      let effectiveM2 = cols?.colM2 && sample[cols.colM2] !== undefined
        ? cols.colM2
        : s2Keys.find((k) => /^(acceptor1|acceptor_1|acceptor 1|acceptor|ماكينة المدفوعات|ماكينه المدفوعات)$/i.test(k))
          || s2Keys.find((k) => /(acceptor.*1|^acceptor$|ماكين.*مدفوعات)/i.test(k))
          || s2Keys.find((k) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(k))
          || s2Keys[0] || '';

      let effectiveAcc2 = cols?.colAcc && sample[cols.colAcc] !== undefined && cols.colAcc !== effectiveM2
        ? cols.colAcc
        : s2Keys.find((k) => k !== effectiveM2 && /^(doner1|donor1|doner_1|donor_1|doner 1|donor 1|doner|donor|رقم حساب المدفوعات|حساب المدفوعات)$/i.test(k))
          || s2Keys.find((k) => k !== effectiveM2 && /(doner.*1|donor.*1|^doner$|^donor$|حساب.*مدفوعات|رقم.*المدفوعات)/i.test(k))
          || s2Keys.find((k) => k !== effectiveM2 && /حساب|كود|رقم.*مندوب|account|acc|code|doner|donor/i.test(k))
          || s2Keys.find((k) => k !== effectiveM2)
          || s2Keys[1] || s2Keys[0] || '';

      if (effectiveAcc2 === effectiveM2 && s2Keys.length > 1) {
        effectiveAcc2 = s2Keys.find((k) => k !== effectiveM2) || effectiveAcc2;
      }

      const effectiveRep2 = cols?.colRep && sample[cols.colRep] !== undefined
        ? cols.colRep
        : s2Keys.find((k) => /اسم.*مندوب|اسم.*العميل|اسم.*المستخدم|اسم|rep.*name|agent.*name|name/i.test(k))
          || effectiveAcc2;

      let globalRowIdx = 0;
      for (const chunk of s2Store.chunks) {
        for (let i = 0; i < chunk.length; i++) {
          globalRowIdx++;
          const row = chunk[i];
          const rawM = String(row[effectiveM2] ?? '').trim();
          let rawAcc = String(row[effectiveAcc2] ?? '').trim();
          
          // Fallback if rawAcc is empty: find another cell with account digits
          if (!rawAcc) {
            for (const k of s2Keys) {
              if (k !== effectiveM2 && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
                rawAcc = String(row[k]).trim();
                break;
              }
            }
          }

          const repName = String(row[effectiveRep2] ?? (rawAcc ? `مندوب (${rawAcc})` : 'غير متوفر')).trim();

          const normAcc = normalizeDigits(rawAcc);
          const normMachine = normalizeDigits(rawM.replace(/^7-|^٧-/, ''));

          // Extract all cell values for universal fallback search
          const allCellTokens: string[] = [];
          for (const k of Object.keys(row)) {
            const val = row[k];
            if (val !== undefined && val !== null && val !== '') {
              const strVal = String(val).trim().toLowerCase();
              allCellTokens.push(strVal);
              const normVal = normalizeDigits(strVal);
              if (normVal && normVal !== strVal) allCellTokens.push(normVal);
            }
          }

          if (!normAcc && !normMachine && allCellTokens.length === 0) continue;

          const entry: RepIndexEntry = {
            machine: rawM || 'غير محدد',
            normMachine,
            account: rawAcc || 'غير متوفر',
            normAcc,
            repName: repName || 'غير متوفر',
            sheetType: 'payments',
            rowIdx: globalRowIdx,
            rawRow: row,
            allCellTokens,
          };

          this.allEntries.push(entry);

          if (normAcc) {
            let list = this.repIndex.get(normAcc);
            if (!list) {
              list = [];
              this.repIndex.set(normAcc, list);
            }
            list.push(entry);
          }

          if (normMachine) {
            let list = this.machineIndex.get(normMachine);
            if (!list) {
              list = [];
              this.machineIndex.set(normMachine, list);
            }
            list.push(entry);
          }
        }
      }
    }

    // 2. Index Sheet 3 (Cash) if available
    if (s3Store && s3Store.chunks) {
      const sample = s3Store.chunks[0]?.[0] || {};
      const s3Keys = Object.keys(sample);

      let effectiveM3 = cols?.colM3 && sample[cols.colM3] !== undefined
        ? cols.colM3
        : s3Keys.find((k) => /^(acceptor2|acceptor_2|acceptor 2|رقم ماكينه الكاش|ماكينه الكاش|ماكينة الكاش)$/i.test(k))
          || s3Keys.find((k) => /(acceptor.*2|ماكين.*كاش|ماكينة.*الكاش)/i.test(k))
          || s3Keys.find((k) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(k))
          || s3Keys[0] || '';

      let effectiveAcc3 = cols?.colCashAcc && sample[cols.colCashAcc] !== undefined && cols.colCashAcc !== effectiveM3
        ? cols.colCashAcc
        : s3Keys.find((k) => k !== effectiveM3 && /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2|رقم الكاش المدفوعات|رقم الكاش|حساب الكاش|رقم المندوب الكاش)$/i.test(k))
          || s3Keys.find((k) => k !== effectiveM3 && /(doner.*2|donor.*2|كاش.*مدفوعات|رقم.*الكاش|حساب.*الكاش)/i.test(k))
          || s3Keys.find((k) => k !== effectiveM3 && /حساب|كود|رقم.*مندوب|account|acc|code|doner|donor/i.test(k))
          || s3Keys.find((k) => k !== effectiveM3)
          || s3Keys[1] || s3Keys[0] || '';

      if (effectiveAcc3 === effectiveM3 && s3Keys.length > 1) {
        effectiveAcc3 = s3Keys.find((k) => k !== effectiveM3) || effectiveAcc3;
      }

      const effectiveRep3 = cols?.colCashRep && sample[cols.colCashRep] !== undefined
        ? cols.colCashRep
        : s3Keys.find((k) => /اسم.*مندوب|اسم.*العميل|اسم.*المستخدم|اسم|rep.*name|agent.*name|name/i.test(k))
          || effectiveAcc3;

      let globalRowIdx = 0;
      for (const chunk of s3Store.chunks) {
        for (let i = 0; i < chunk.length; i++) {
          globalRowIdx++;
          const row = chunk[i];
          let rawM = String(row[effectiveM3] ?? '').trim();
          if (rawM && !rawM.startsWith('7-') && !rawM.startsWith('٧-')) {
            rawM = `7-${rawM}`;
          }
          const rawAcc = String(row[effectiveAcc3] ?? '').trim();
          const repName = String(row[effectiveRep3] ?? (rawAcc ? `مسؤول كاش (${rawAcc})` : 'غير متوفر')).trim();

          const normAcc = normalizeDigits(rawAcc);
          const normMachine = normalizeDigits(rawM.replace(/^7-|^٧-/, ''));

          // Extract all cell values for universal fallback search
          const allCellTokens: string[] = [];
          for (const k of Object.keys(row)) {
            const val = row[k];
            if (val !== undefined && val !== null && val !== '') {
              const strVal = String(val).trim().toLowerCase();
              allCellTokens.push(strVal);
              const normVal = normalizeDigits(strVal);
              if (normVal && normVal !== strVal) allCellTokens.push(normVal);
            }
          }

          if (!normAcc && !normMachine && allCellTokens.length === 0) continue;

          const entry: RepIndexEntry = {
            machine: rawM || '7-غير محدد',
            normMachine,
            account: rawAcc || 'غير متوفر',
            normAcc,
            repName: repName || 'غير متوفر',
            sheetType: 'cash',
            rowIdx: globalRowIdx,
            rawRow: row,
            allCellTokens,
          };

          this.allEntries.push(entry);

          if (normAcc) {
            let list = this.repIndex.get(normAcc);
            if (!list) {
              list = [];
              this.repIndex.set(normAcc, list);
            }
            list.push(entry);
          }

          if (normMachine) {
            let list = this.machineIndex.get(normMachine);
            if (!list) {
              list = [];
              this.machineIndex.set(normMachine, list);
            }
            list.push(entry);
          }
        }
      }
    }

    this.isIndexDirty = false;
    this.lastIndexCols = colSignature;
  }

  /**
   * Search across Sheet 2 & Sheet 3 ONLY for any representative number, name, or machine.
   * Extracts every linked machine and clearly flags and enumerates all repeated linkages!
   */
  public searchRep(
    query: string,
    cols?: {
      colM2?: string;
      colAcc?: string;
      colRep?: string;
      colM3?: string;
      colCashAcc?: string;
      colCashRep?: string;
      limit?: number;
    }
  ): RepSearchResult {
    const rawQ = (query || '').trim();
    if (!rawQ) {
      return {
        query: '',
        records: [],
        totalMatches: 0,
        uniqueMachinesCount: 0,
        repeatedMachinesCount: 0,
        paymentsCount: 0,
        cashCount: 0,
        uniqueRepAccounts: [],
      };
    }

    this.rebuildRepIndex(cols);

    const normQ = normalizeDigits(rawQ).toLowerCase();
    const isCashSpecific = rawQ.trim().startsWith('7-') || rawQ.trim().startsWith('٧-');
    const cleanMachineQ = normalizeDigits(rawQ.replace(/^7-|^٧-/, '')).toLowerCase();

    const matchedEntries: RepIndexEntry[] = [];
    const matchedRepAccounts = new Set<string>();
    const seenEntryKeys = new Set<string>();

    const addEntry = (e: RepIndexEntry) => {
      const k = `${e.sheetType}-${e.rowIdx}`;
      if (!seenEntryKeys.has(k)) {
        seenEntryKeys.add(k);
        matchedEntries.push(e);
        if (e.normAcc) matchedRepAccounts.add(e.normAcc);
      }
    };

    // 1. Direct match on Machine ID (Payments and/or 7- Cash)
    if (cleanMachineQ && this.machineIndex.has(cleanMachineQ)) {
      const list = this.machineIndex.get(cleanMachineQ)!;
      for (const e of list) {
        if (isCashSpecific) {
          if (e.sheetType === 'cash') addEntry(e);
        } else {
          addEntry(e);
        }
      }
    }

    // 2. Direct match on Representative Account
    if (this.repIndex.has(normQ)) {
      const list = this.repIndex.get(normQ)!;
      list.forEach(addEntry);
    }

    // 3. If no exact matches yet, do partial searches
    if (matchedEntries.length === 0) {
      // Partial search in rep accounts or rep names
      for (const [accKey, entries] of this.repIndex.entries()) {
        const firstEntry = entries[0];
        const matchAcc = accKey.includes(normQ) || normQ.includes(accKey);
        const matchName = firstEntry?.repName.toLowerCase().includes(normQ);

        if (matchAcc || matchName) {
          entries.forEach(addEntry);
        }
      }

      // Partial search in machine index
      for (const [mKey, entries] of this.machineIndex.entries()) {
        if (cleanMachineQ && (mKey.includes(cleanMachineQ) || cleanMachineQ.includes(mKey))) {
          for (const e of entries) {
            if (isCashSpecific) {
              if (e.sheetType === 'cash') addEntry(e);
            } else {
              addEntry(e);
            }
          }
        }
      }

      // Universal scan over all stored entries
      if (matchedEntries.length === 0) {
        for (const e of this.allEntries) {
          if (e.allCellTokens.some((t) => t === normQ || t.includes(normQ) || (cleanMachineQ && t.includes(cleanMachineQ)))) {
            addEntry(e);
          }
        }
      }
    }

    if (matchedEntries.length === 0) {
      return {
        query: rawQ,
        records: [],
        totalMatches: 0,
        uniqueMachinesCount: 0,
        repeatedMachinesCount: 0,
        paymentsCount: 0,
        cashCount: 0,
        uniqueRepAccounts: [],
      };
    }

    // Group entries per machine to calculate repetitions for this representative query
    const groupMap = new Map<string, RepIndexEntry[]>();
    matchedEntries.forEach((entry) => {
      // Group by normalized machine ID so payments + cash occurrences group together cleanly
      const key = entry.normMachine || `${entry.sheetType}_${entry.rowIdx}`;
      let list = groupMap.get(key);
      if (!list) {
        list = [];
        groupMap.set(key, list);
      }
      list.push(entry);
    });

    const uniqueMachinesSet = new Set<string>();
    let repeatedMachinesCount = 0;
    let paymentsCount = 0;
    let cashCount = 0;

    const finalRecords: RepLookupRecord[] = [];

    // Transform entries into complete RepLookupRecord items with explicit repetition flags
    for (const [key, group] of groupMap.entries()) {
      const totalRepsForMachine = group.length;
      const isRepeated = totalRepsForMachine > 1;

      if (isRepeated) {
        repeatedMachinesCount++;
      }

      const hasPay = group.some((g) => g.sheetType === 'payments');
      const hasCash = group.some((g) => g.sheetType === 'cash');

      let repeatReason = 'ربط فردي سليم';
      if (isRepeated) {
        if (hasPay && hasCash) {
          repeatReason = `تكرار مشترك بين شيت المدفوعات والكاش (${totalRepsForMachine} أسطر)`;
        } else if (hasPay) {
          repeatReason = `مكرر الربط في شيت المدفوعات (${totalRepsForMachine} أسطر)`;
        } else {
          repeatReason = `مكرر الربط في شيت الكاش (${totalRepsForMachine} أسطر)`;
        }
      }

      group.forEach((entry, idx) => {
        uniqueMachinesSet.add(entry.normMachine);
        if (entry.sheetType === 'payments') paymentsCount++;
        if (entry.sheetType === 'cash') cashCount++;

        finalRecords.push({
          id: `${entry.sheetType}-${entry.rowIdx}-${idx}`,
          rowIdx: entry.rowIdx,
          machine: entry.machine,
          normMachine: entry.normMachine,
          account: entry.account,
          normAcc: entry.normAcc,
          repName: entry.repName,
          sheetType: entry.sheetType,
          sheetTypeLabel: entry.sheetType === 'payments' ? 'شيت المدفوعات' : 'شيت الكاش',
          isRepeated,
          repeatIndex: idx + 1,
          totalRepetitions: totalRepsForMachine,
          repeatReason,
          rawRow: entry.rawRow,
        });
      });
    }

    // Sort: Repeated machines first, then by machine ID, then by repeatIndex
    finalRecords.sort((a, b) => {
      if (a.isRepeated !== b.isRepeated) return a.isRepeated ? -1 : 1;
      if (a.normMachine !== b.normMachine) return a.normMachine.localeCompare(b.normMachine, 'ar', { numeric: true });
      return a.repeatIndex - b.repeatIndex;
    });

    const maxLimit = cols?.limit || 10000;
    const limitedRecords = finalRecords.slice(0, maxLimit);

    return {
      query: rawQ,
      records: limitedRecords,
      totalMatches: finalRecords.length,
      uniqueMachinesCount: uniqueMachinesSet.size,
      repeatedMachinesCount,
      paymentsCount,
      cashCount,
      uniqueRepAccounts: Array.from(matchedRepAccounts),
    };
  }

  /**
   * Retrieves summary list of all unique reps indexed in Sheet 2 & 3
   */
  public getAllRepList(): Array<{ account: string; name: string; count: number; cashCount: number; payCount: number }> {
    this.rebuildRepIndex();
    const result: Array<{ account: string; name: string; count: number; cashCount: number; payCount: number }> = [];

    for (const [normAcc, entries] of this.repIndex.entries()) {
      if (!entries || entries.length === 0) continue;
      const first = entries[0];
      if (!first.account || first.account === 'غير متوفر' || first.account === '-') continue;
      const cashCount = entries.filter((e) => e.sheetType === 'cash').length;
      const payCount = entries.length - cashCount;

      result.push({
        account: first.account,
        name: first.repName,
        count: entries.length,
        cashCount,
        payCount,
      });
    }

    result.sort((a, b) => b.count - a.count);
    return result;
  }

  public clear(key: string): void {
    this.cache.delete(key);
    this.isIndexDirty = true;
  }

  public clearAll(): void {
    this.cache.clear();
    this.repIndex.clear();
    this.machineIndex.clear();
    this.allEntries = [];
    this.isIndexDirty = false;
  }
}

export const chunkCache = new MemoryChunkCacheManager();
