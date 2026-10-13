import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { SheetRow } from '../types';

// Robust helper matching functions for target columns (handles Arabic & English variations)
const isAcceptorMatch = (h: string) =>
  /^(acceptor1|acceptor2|acceptor_1|acceptor_2|acceptor 1|acceptor 2|acceptor)$/i.test(h) ||
  /^(رقم ماكينه الكاش|ماكينه الكاش|ماكينة الكاش|ماكينة المدفوعات|ماكينه المدفوعات|رقم الماكينة|رقم الماكينه|ماكينة|ماكينه|الجهاز|جهاز)$/i.test(h) ||
  /(acceptor.*[12]|^acceptor$|ماكين.*كاش|ماكين.*مدفوعات)/i.test(h) ||
  /^(pos|terminal|machine|sn|machine_id|terminal_id)$/i.test(h);

const isDonerMatch = (h: string) =>
  /^(doner1|doner2|donor1|donor2|doner_1|doner_2|donor_1|donor_2|doner 1|doner 2|donor 1|donor 2|doner|donor)$/i.test(h) ||
  /^(رقم المندوب الكاش|رقم الكاش المدفوعات|رقم الكاش|حساب الكاش|رقم حساب المدفوعات|حساب المدفوعات|رقم المندوب|كود المندوب|حساب المندوب|رقم الحساب|الحساب|كود|مندوب)$/i.test(h) ||
  /(doner.*[12]|donor.*[12]|^doner$|^donor$|كاش.*مدفوعات|رقم.*الكاش|حساب.*الكاش|رقم.*مندوب|كود.*مندوب|حساب.*مدفوعات)/i.test(h) ||
  /^(account|acc|rep_code|agent_code|rep_id|agent_id|wallet|code)$/i.test(h);

const isRepNameMatch = (h: string) =>
  /^(اسم المندوب|اسم العميل|اسم المستخدم|اسم المسؤول|اسم|مندوب|الاسم)$/i.test(h) ||
  /(اسم.*مندوب|اسم.*عميل|اسم.*مستخدم|rep.*name|agent.*name|^name$)/i.test(h);

function selectColumnsToKeep(
  rawHeaders: string[],
  targetType?: 'machines' | 'payments' | 'cash'
): { indices: number[]; headers: string[] } {
  if (!rawHeaders || rawHeaders.length === 0) {
    return { indices: [], headers: [] };
  }

  const normalizedHeaders = rawHeaders.map((h) => h.replace(/^\uFEFF/, '').trim());

  // 1. Payments sheet: acceptor and doner / rep
  if (targetType === 'payments') {
    const keep: { idx: number; name: string }[] = [];
    const accIdx = normalizedHeaders.findIndex((h) => /^(acceptor1|acceptor_1|acceptor 1)$/i.test(h)) !== -1
      ? normalizedHeaders.findIndex((h) => /^(acceptor1|acceptor_1|acceptor 1)$/i.test(h))
      : normalizedHeaders.findIndex(isAcceptorMatch);

    const donerIdx = normalizedHeaders.findIndex((h) => /^(doner1|donor1|doner_1|donor_1|doner 1|donor 1)$/i.test(h)) !== -1
      ? normalizedHeaders.findIndex((h) => /^(doner1|donor1|doner_1|donor_1|doner 1|donor 1)$/i.test(h))
      : normalizedHeaders.findIndex((h, idx) => idx !== accIdx && isDonerMatch(h));

    const nameIdx = normalizedHeaders.findIndex((h, idx) => idx !== accIdx && idx !== donerIdx && isRepNameMatch(h));

    if (accIdx !== -1) keep.push({ idx: accIdx, name: normalizedHeaders[accIdx] });
    if (donerIdx !== -1 && donerIdx !== accIdx) keep.push({ idx: donerIdx, name: normalizedHeaders[donerIdx] });
    if (nameIdx !== -1) keep.push({ idx: nameIdx, name: normalizedHeaders[nameIdx] });

    // SAFETY NET: If specific target columns weren't isolated, preserve ALL columns so data is never destroyed!
    if (keep.length === 0) {
      return {
        indices: normalizedHeaders.map((_, i) => i),
        headers: normalizedHeaders,
      };
    }
    return { indices: keep.map((k) => k.idx), headers: keep.map((k) => k.name) };
  }

  // 2. Cash sheet: acceptor and doner / cash rep
  if (targetType === 'cash') {
    const keep: { idx: number; name: string }[] = [];
    const accIdx = normalizedHeaders.findIndex((h) => /^(acceptor2|acceptor_2|acceptor 2)$/i.test(h)) !== -1
      ? normalizedHeaders.findIndex((h) => /^(acceptor2|acceptor_2|acceptor 2)$/i.test(h))
      : normalizedHeaders.findIndex(isAcceptorMatch);

    const donerIdx = normalizedHeaders.findIndex((h) => /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2|رقم المندوب الكاش)$/i.test(h)) !== -1
      ? normalizedHeaders.findIndex((h) => /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2|رقم المندوب الكاش)$/i.test(h))
      : normalizedHeaders.findIndex((h, idx) => idx !== accIdx && isDonerMatch(h));

    const nameIdx = normalizedHeaders.findIndex((h, idx) => idx !== accIdx && idx !== donerIdx && isRepNameMatch(h));

    if (accIdx !== -1) keep.push({ idx: accIdx, name: normalizedHeaders[accIdx] });
    if (donerIdx !== -1 && donerIdx !== accIdx) {
      keep.push({ idx: donerIdx, name: 'رقم المندوب الكاش' });
    }
    if (nameIdx !== -1) keep.push({ idx: nameIdx, name: normalizedHeaders[nameIdx] });

    // SAFETY NET: If specific target columns weren't isolated, preserve ALL columns!
    if (keep.length === 0) {
      return {
        indices: normalizedHeaders.map((_, i) => i),
        headers: normalizedHeaders,
      };
    }
    return { indices: keep.map((k) => k.idx), headers: keep.map((k) => k.name) };
  }

  // 3. Machines sheet:
  if (targetType === 'machines') {
    const mIdx = normalizedHeaders.findIndex((h) => /^(ماكينة|رقم الماكينة|جهاز|pos|machine|sn|id)$/i.test(h));
    const resolvedMIdx = mIdx !== -1 ? mIdx : normalizedHeaders.findIndex(isAcceptorMatch);
    if (resolvedMIdx !== -1) {
      const keep: { idx: number; name: string }[] = [{ idx: resolvedMIdx, name: normalizedHeaders[resolvedMIdx] }];
      normalizedHeaders.forEach((h, idx) => {
        if (idx !== resolvedMIdx && /فرع|منطقة|محافظة|نوع|تبويب|تصنيف|قسم|حالة|branch|area|type|category/i.test(h)) {
          keep.push({ idx, name: h });
        }
      });
      return { indices: keep.map((k) => k.idx), headers: keep.map((k) => k.name) };
    }
  }

  // Fallback: Return all headers to avoid dropping user data
  return {
    indices: normalizedHeaders.map((_, i) => i),
    headers: normalizedHeaders,
  };
}

function detectDelimiter(line: string): string {
  const commas = (line.match(/,/g) || []).length;
  const semicolons = (line.match(/;/g) || []).length;
  const tabs = (line.match(/\t/g) || []).length;
  const pipes = (line.match(/\|/g) || []).length;
  if (tabs > commas && tabs > semicolons && tabs > pipes) return '\t';
  if (semicolons > commas && semicolons > pipes) return ';';
  if (pipes > commas && pipes > semicolons) return '|';
  return ',';
}

function parseCsvLineFast(line: string, delim = ','): string[] {
  if (!line.includes('"')) {
    return line.split(delim);
  }
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  const len = line.length;

  for (let i = 0; i < len; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delim && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, id, payload } = e.data;

  try {
    if (type === 'PARSE_FILE') {
      const { fileBuffer, fileName, targetType } = payload;
      await handleParseFile(id, fileBuffer, fileName, targetType);
    } else if (type === 'APPROVE_SHEET') {
      const { rows, sheetType, existingSheet1Count } = payload;
      await handleApproveSheet(id, rows, sheetType, existingSheet1Count);
    } else if (type === 'INSPECT_ZIP') {
      const { fileBuffer } = payload;
      await handleInspectZip(id, fileBuffer);
    } else if (type === 'EXTRACT_ZIP_FILE') {
      const { fileBuffer, relativePath } = payload;
      await handleExtractZipFile(id, fileBuffer, relativePath);
    }
  } catch (err: any) {
    self.postMessage({
      type: 'ERROR',
      id,
      error: err?.message || 'حدث خطأ غير متوقع أثناء معالجة الملف في مسار الخلفية.',
    });
  }
};

function sendProgress(id: string, percent: number, stepText: string) {
  self.postMessage({
    type: 'PROGRESS',
    id,
    percent,
    stepText,
  });
}

async function handleParseFile(
  id: string,
  buffer: ArrayBuffer,
  fileName: string,
  targetType?: 'machines' | 'payments' | 'cash'
) {
  let activeBuffer = buffer;
  let activeName = fileName;

  // 1. Check if the buffer is an actual ZIP archive (must not be an Excel/CSV spreadsheet)
  const lowerName = (activeName || '').toLowerCase().trim();
  const isDirectSpreadsheet =
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.xlsm') ||
    lowerName.endsWith('.xlsb') ||
    lowerName.endsWith('.tsv') ||
    lowerName.endsWith('.txt');

  // ONLY treat as a ZIP archive if it explicitly ends with .zip/.zipx AND is NOT a direct spreadsheet
  let isZip = !isDirectSpreadsheet && (lowerName.endsWith('.zip') || lowerName.endsWith('.zipx'));

  if (isZip) {
    sendProgress(id, 8, 'فك ضغط الأرشيف (ZIP) في المسار الخلفي المعزول...');
    const zip = await JSZip.loadAsync(activeBuffer);

    // If this archive contains xl/workbook.xml or [Content_Types].xml, it is an Excel XLSX workbook directly!
    const isDirectXlsx = !!(zip.file('xl/workbook.xml') || zip.file('[Content_Types].xml'));

    if (isDirectXlsx) {
      // It is an Excel workbook, proceed directly to Excel reading
      isZip = false;
      if (!lowerName.endsWith('.xlsx')) {
        activeName = activeName.replace(/\.zip$/i, '') + '.xlsx';
      }
    } else {
      const validEntries: { path: string; name: string }[] = [];

      zip.forEach((relPath, entry) => {
        if (entry.dir) return;
        const parts = relPath.split('/');
        const leaf = parts[parts.length - 1];
        if (!leaf || leaf.startsWith('.') || relPath.includes('__MACOSX/')) return;
        const ext = leaf.split('.').pop()?.toLowerCase();
        if (['csv', 'xlsx', 'xls', 'xlsm', 'xlsb', 'tsv', 'txt'].includes(ext || '')) {
          validEntries.push({ path: relPath, name: leaf });
        }
      });

      if (validEntries.length === 0) {
        throw new Error('لم يتم العثور على أي ملفات جداول CSV أو Excel متوافقة داخل أرشيف ZIP.');
      }

      sendProgress(id, 15, `استخراج ملف (${validEntries[0].name}) من الأرشيف دون تجميد...`);
      const zipEntry = zip.file(validEntries[0].path);
      if (!zipEntry) throw new Error('تعذر قراءة محتوى الملف من الأرشيف.');

      activeBuffer = await zipEntry.async('arraybuffer');
      activeName = validEntries[0].name;
    }
  }

  const isCsv = activeName.toLowerCase().endsWith('.csv');

  // 2. High-speed CSV parsing in Web Worker
  if (isCsv) {
    sendProgress(id, 20, 'تحليل أسطر ملف CSV في المسار الخلفي المعزول...');
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(activeBuffer);

    sendProgress(id, 30, 'استخراج الترويسات وتحديد الأعمدة المعتمدة...');
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) {
      self.postMessage({ type: 'DONE', id, rows: [], fileName: activeName });
      return;
    }

    let headerRowIdx = -1;
    let headers: string[] = [];
    let delim = ',';

    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      const detected = detectDelimiter(line);
      const cols = parseCsvLineFast(line, detected).map((c) => c.trim());
      if (cols.some((c) => /ماكينة|جهاز|pos|machine|sn|id|كود|حساب|مندوب|اسم|فرع|code|acc|name|acceptor|doner|donor/i.test(c))) {
        headerRowIdx = i;
        headers = cols;
        delim = detected;
        break;
      }
    }

    if (headerRowIdx === -1 && lines.length > 0) {
      headerRowIdx = 0;
      const fallbackLine = lines[0]?.trim() || '';
      delim = detectDelimiter(fallbackLine);
      headers = parseCsvLineFast(fallbackLine, delim).map((c, colIdx) => c.trim() || `عمود_${colIdx + 1}`);
    }

    // Apply strict column filtering
    const { indices: keepIndices, headers: keepHeaders } = selectColumnsToKeep(headers, targetType);

    const rows: SheetRow[] = [];
    const totalDataRows = lines.length - (headerRowIdx + 1);
    const CHUNK_SIZE = 15000;

    for (let i = headerRowIdx + 1; i < lines.length; i++) {
      if ((i - headerRowIdx) % CHUNK_SIZE === 0) {
        const pct = Math.min(96, 30 + Math.round(((i - headerRowIdx) / (totalDataRows || 1)) * 65));
        sendProgress(
          id,
          pct,
          `معالجة السجلات في الخلفية (${(i - headerRowIdx).toLocaleString('ar-EG')} من ${totalDataRows.toLocaleString('ar-EG')})...`
        );
        // Small pause to yield in worker loop
        await new Promise((r) => setTimeout(r, 0));
      }

      const line = lines[i]?.trim();
      if (!line) continue;

      const cols = parseCsvLineFast(line, delim);
      const rowObj: SheetRow = targetType ? { _tabType: targetType } : {};
      let hasData = false;

      for (let k = 0; k < keepIndices.length; k++) {
        const c = keepIndices[k];
        const raw = cols[c];
        if (raw !== undefined && raw !== '') {
          const val = raw.trim();
          if (val !== '') {
            rowObj[keepHeaders[k]] = val;
            hasData = true;
          }
        }
      }

      if (hasData) rows.push(rowObj);
    }

    sendProgress(id, 100, `اكتمل استخراج ${rows.length.toLocaleString('ar-EG')} سجل بنجاح!`);
    self.postMessage({ type: 'DONE', id, rows, fileName: activeName });
    return;
  }

  // 3. High-speed XLSX reading in Web Worker
  sendProgress(id, 25, 'تحليل مصنف Excel وفك هياكل البيانات في الخلفية...');
  let workbook: XLSX.WorkBook | null = null;

  try {
    workbook = XLSX.read(activeBuffer, {
      type: 'array',
      codepage: 65001,
      cellDates: false,
      cellStyles: false,
      cellFormula: false,
      cellHTML: false,
      cellText: false,
      sheetStubs: false,
      dense: true,
    });
  } catch (err1) {
    const text = new TextDecoder('utf-8').decode(activeBuffer);
    workbook = XLSX.read(text, {
      type: 'string',
      cellDates: false,
      cellStyles: false,
      cellFormula: false,
      cellHTML: false,
      cellText: false,
      sheetStubs: false,
      dense: true,
    });
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    self.postMessage({ type: 'DONE', id, rows: [], fileName: activeName });
    return;
  }

  sendProgress(id, 55, 'استخراج صفوف الجدول من كافة أوراق العمل (التبويبات)...');
  const resultRows: SheetRow[] = [];
  const sheetNames = workbook.SheetNames || [];
  const totalSheets = sheetNames.length;

  // Track progress across sheets
  for (let sIdx = 0; sIdx < totalSheets; sIdx++) {
    const sName = sheetNames[sIdx];
    const ws = workbook.Sheets[sName];
    if (!ws || !ws['!ref']) continue;

    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: true });
    if (!aoa || aoa.length === 0) continue;

    // Detect if this specific sheet is Cash or Payments by worksheet name
    const sNameLower = sName.toLowerCase().trim();
    const isSheetCash = /كاش|cash/i.test(sNameLower);
    const isSheetPay = /مدفوع|payment/i.test(sNameLower);

    let defaultSheetTabType: 'cash' | 'payments' | undefined = undefined;
    if (isSheetCash) {
      defaultSheetTabType = 'cash';
    } else if (isSheetPay) {
      defaultSheetTabType = 'payments';
    } else if (targetType === 'cash') {
      defaultSheetTabType = 'cash';
    } else if (targetType === 'payments') {
      defaultSheetTabType = 'payments';
    }

    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(aoa.length, 12); r++) {
      const row = aoa[r];
      if (!Array.isArray(row)) continue;
      const nonEmptyCells = row.map((c) => String(c ?? '').trim()).filter((c) => c !== '');
      if (nonEmptyCells.length >= 1) {
        const hasKnown = nonEmptyCells.some((c) =>
          /ماكينة|جهاز|pos|machine|sn|id|كود|حساب|مندوب|اسم|فرع|code|acc|name|acceptor|doner|donor/i.test(c)
        );
        if (hasKnown) {
          headerRowIdx = r;
          break;
        }
        if (headerRowIdx === -1 && nonEmptyCells.length >= 2) {
          headerRowIdx = r;
        }
      }
    }

    if (headerRowIdx === -1) headerRowIdx = 0;

    const rawHeaders = (aoa[headerRowIdx] || []).map((h, colIdx) => {
      const cleanH = String(h ?? '').replace(/^\uFEFF/, '').trim();
      return cleanH || `عمود_${colIdx + 1}`;
    });

    const { indices: keepIndices, headers: keepHeaders } = selectColumnsToKeep(rawHeaders, targetType);
    const totalDataRows = aoa.length - (headerRowIdx + 1);
    const CHUNK_SIZE = 10000;

    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      if ((r - headerRowIdx) % CHUNK_SIZE === 0 && (r - headerRowIdx) > 0) {
        const sheetPct = Math.round(((r - headerRowIdx) / (totalDataRows || 1)) * (35 / totalSheets));
        const currentPct = Math.min(96, 55 + Math.round((sIdx / totalSheets) * 35) + sheetPct);
        sendProgress(
          id,
          currentPct,
          `استخراج البيانات من تبويبة «${sName}» (${(r - headerRowIdx).toLocaleString('ar-EG')} من ${totalDataRows.toLocaleString('ar-EG')})...`
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const row = aoa[r];
      if (!Array.isArray(row)) continue;
      const rowObj: SheetRow = {};
      let hasData = false;

      for (let k = 0; k < keepIndices.length; k++) {
        const c = keepIndices[k];
        const raw = row[c];
        if (raw !== undefined && raw !== null && raw !== '') {
          const cellVal = typeof raw === 'string' ? raw.trim() : String(raw).trim();
          if (cellVal !== '') {
            rowObj[keepHeaders[k]] = cellVal;
            hasData = true;
          }
        }
      }

      if (hasData) {
        // Tag tab type
        if (defaultSheetTabType) {
          rowObj._tabType = defaultSheetTabType;
        } else if (targetType === 'machines') {
          // Check machine value or row content
          const firstVal = String(Object.values(rowObj)[0] ?? '').trim();
          if (firstVal.startsWith('7-') || firstVal.startsWith('٧-')) {
            rowObj._tabType = 'cash';
          } else {
            // Check if any value mentions cash
            const hasCashKeyword = Object.values(rowObj).some((v) => /كاش|cash/i.test(String(v)));
            rowObj._tabType = hasCashKeyword ? 'cash' : 'payments';
          }
        } else if (targetType) {
          rowObj._tabType = targetType;
        }

        resultRows.push(rowObj);
      }
    }
  }

  sendProgress(id, 100, `اكتمل التحميل والمعالجة بنجاح! (${resultRows.length.toLocaleString('ar-EG')} سجل)`);
  self.postMessage({ type: 'DONE', id, rows: resultRows, fileName: activeName });
}

async function handleInspectZip(id: string, buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);

  // If this archive contains xl/workbook.xml or [Content_Types].xml, it is an Excel XLSX workbook directly!
  if (zip.file('xl/workbook.xml') || zip.file('[Content_Types].xml')) {
    self.postMessage({
      type: 'ZIP_INSPECTED',
      id,
      items: [
        {
          path: '__DIRECT_XLSX__',
          name: 'sheet.xlsx',
          size: buffer.byteLength,
          date: new Date(),
          extension: 'xlsx',
          isSupportedSheet: true,
        },
      ],
    });
    return;
  }

  const items: any[] = [];

  zip.forEach((relPath, entry) => {
    if (entry.dir) return;
    const parts = relPath.split('/');
    const leaf = parts[parts.length - 1];
    if (!leaf || leaf.startsWith('.') || relPath.includes('__MACOSX/')) return;

    const extMatch = leaf.match(/\.([^.]+)$/);
    const extension = extMatch ? extMatch[1].toLowerCase() : '';
    const isSupportedSheet = ['csv', 'xlsx', 'xls', 'xlsm', 'xlsb', 'tsv', 'txt'].includes(extension);

    const size = (entry as any)._data?.uncompressedSize || 0;

    items.push({
      path: relPath,
      name: leaf,
      size,
      date: entry.date || new Date(),
      extension,
      isSupportedSheet,
    });
  });

  items.sort((a, b) => {
    if (a.isSupportedSheet && !b.isSupportedSheet) return -1;
    if (!a.isSupportedSheet && b.isSupportedSheet) return 1;
    return b.size - a.size;
  });

  self.postMessage({ type: 'ZIP_INSPECTED', id, items });
}

async function handleExtractZipFile(id: string, buffer: ArrayBuffer, relativePath: string) {
  if (relativePath === '__DIRECT_XLSX__') {
    self.postMessage({
      type: 'ZIP_EXTRACTED',
      id,
      buffer,
      fileName: 'sheet.xlsx',
    });
    return;
  }

  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file(relativePath);
  if (!entry) throw new Error(`الملف المطلوب (${relativePath}) غير موجود في الأرشيف.`);

  const fileData = await entry.async('arraybuffer');
  const leaf = relativePath.split('/').pop() || 'extracted.csv';

  self.postMessage({
    type: 'ZIP_EXTRACTED',
    id,
    buffer: fileData,
    fileName: leaf,
  });
}

async function handleApproveSheet(
  id: string,
  rows: SheetRow[],
  sheetType: 'payments' | 'cash',
  existingSheet1Count: number
) {
  if (!rows || rows.length === 0) {
    self.postMessage({
      type: 'SHEET_APPROVED',
      id,
      totalCount: 0,
      previewRows: [],
      columns: [],
      detectedCols: {},
      autoSheet1: [],
      autoSheet1Counts: { total: 0, cash: 0, payments: 0 },
      rows: [],
    });
    return;
  }

  sendProgress(id, 15, `فحص وتعيين أعمدة شيت ${sheetType === 'payments' ? 'المدفوعات' : 'الكاش'} في مسار الخلفية...`);

  const cols = Object.keys(rows[0] || {}).filter((c) => !c.startsWith('_'));
  let activeM = '';
  let activeAcc = '';
  let activeRep = '';

  if (sheetType === 'payments') {
    activeM =
      cols.find((c) => /^(acceptor1|acceptor_1|acceptor 1|acceptor)$/i.test(c)) ||
      cols.find((c) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(c)) ||
      cols[0] ||
      '';
    activeAcc =
      cols.find((c) => /^(doner1|donor1|doner_1|donor_1|doner 1|donor 1|doner|donor|رقم حساب المدفوعات|حساب المدفوعات)$/i.test(c)) ||
      cols.find((c) => /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2)$/i.test(c)) ||
      cols.find((c) => /حساب|كود|رقم.*مندوب|account|acc|code|doner|donor/i.test(c)) ||
      cols.find((c) => c !== activeM) ||
      cols[1] ||
      cols[0] ||
      '';
    if (activeAcc === activeM && cols.length > 1) {
      activeAcc = cols.find((c) => c !== activeM) || activeAcc;
    }
    activeRep =
      cols.find((c) => /اسم.*مندوب|اسم.*العميل|اسم.*المستخدم|اسم|rep.*name|agent.*name|name/i.test(c)) ||
      activeAcc;
  } else {
    activeM =
      cols.find((c) => /^(acceptor2|acceptor_2|acceptor 2|رقم ماكينه الكاش|ماكينه الكاش|ماكينة الكاش)$/i.test(c)) ||
      cols.find((c) => /^(acceptor1|acceptor_1|acceptor 1|acceptor)$/i.test(c)) ||
      cols.find((c) => /ماكينة|جهاز|pos|machine|sn|acceptor/i.test(c)) ||
      cols[0] ||
      '';
    activeAcc =
      cols.find((c) => /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2|رقم الكاش المدفوعات|رقم الكاش|حساب الكاش|رقم المندوب الكاش)$/i.test(c)) ||
      cols.find((c) => /^(doner1|donor1|doner_1|donor_1|doner 1|donor 1|doner|donor)$/i.test(c)) ||
      cols.find((c) => /حساب|كود|account|acc|code|doner|donor/i.test(c)) ||
      cols.find((c) => c !== activeM) ||
      cols[1] ||
      cols[0] ||
      '';
    if (activeAcc === activeM && cols.length > 1) {
      activeAcc = cols.find((c) => c !== activeM) || activeAcc;
    }
    activeRep =
      cols.find((c) => /^(doner2|donor2|doner_2|donor_2|doner 2|donor 2|رقم المندوب الكاش)$/i.test(c)) ||
      cols.find((c) => /اسم.*مندوب|اسم.*العميل|اسم.*المستخدم|اسم|rep.*name|agent.*name|name/i.test(c)) ||
      activeAcc;
  }

  // Auto-generate Sheet 1 (Machines) in worker if Sheet 1 does not exist yet!
  let autoSheet1: SheetRow[] = [];
  let autoSheet1Counts = { total: 0, cash: 0, payments: 0 };

  if (existingSheet1Count === 0 && activeM) {
    sendProgress(id, 40, `استخراج وحصر الماكينات الفريدة (${rows.length.toLocaleString('ar-EG')} سجل) في الخلفية...`);
    const machineMap = new Map<string, SheetRow>();
    const CHUNK_SIZE = 50000;

    for (let i = 0; i < rows.length; i++) {
      if (i > 0 && i % CHUNK_SIZE === 0) {
        const pct = Math.min(85, 40 + Math.round((i / rows.length) * 45));
        sendProgress(
          id,
          pct,
          `جاري حصر الماكينات الفريدة (${i.toLocaleString('ar-EG')} من ${rows.length.toLocaleString('ar-EG')})...`
        );
        await new Promise((res) => setTimeout(res, 0));
      }

      const r = rows[i];
      const mVal = r[activeM];
      if (mVal !== undefined && mVal !== null) {
        const mStr = String(mVal).trim();
        if (mStr && !machineMap.has(mStr)) {
          const isCash = mStr.startsWith('7-') || mStr.startsWith('٧-') || sheetType === 'cash';
          machineMap.set(mStr, {
            'رقم الماكينة': mStr,
            _tabType: isCash ? 'cash' : 'payments',
          });
        }
      }
    }

    autoSheet1 = Array.from(machineMap.values());
    const cashCount = autoSheet1.filter((r) => r._tabType === 'cash').length;
    autoSheet1Counts = {
      total: autoSheet1.length,
      cash: cashCount,
      payments: autoSheet1.length - cashCount,
    };
  }

  sendProgress(id, 92, 'تجهيز عينة المعاينة الذكية (50 سجلاً) وحفظ البيانات الكاملة...');

  // Extract exactly 50 preview rows as required by user!
  const previewRows = rows.slice(0, 50);

  sendProgress(id, 100, `تم اعتماد وتثبيت ${rows.length.toLocaleString('ar-EG')} سجل بنجاح!`);

  self.postMessage({
    type: 'SHEET_APPROVED',
    id,
    totalCount: rows.length,
    previewRows,
    columns: cols,
    detectedCols: {
      activeM,
      activeAcc,
      activeRep,
    },
    autoSheet1,
    autoSheet1Counts,
    rows,
  });
}

