import * as XLSX from 'xlsx';
import { ExpandedRow, SheetRow } from '../types';

export async function filterRowsForTarget(
  rows: SheetRow[],
  targetType?: 'machines' | 'payments' | 'cash',
  onProgress?: (percent: number, stepText: string) => void
): Promise<SheetRow[]> {
  if (!rows || rows.length === 0) return rows;

  if (targetType) {
    const limit = Math.min(rows.length, 500);
    for (let i = 0; i < limit; i++) {
      if (!rows[i]._tabType) {
        rows[i]._tabType = targetType;
      }
    }
  }

  onProgress?.(100, 'اكتمل التحميل والمعالجة بنجاح!');
  await new Promise((resolve) => setTimeout(resolve, 0));
  return rows;
}

function detectDelimiter(line: string): string {
  const semicolons = (line.match(/;/g) || []).length;
  const tabs = (line.match(/\t/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  if (semicolons > commas && semicolons > tabs) return ';';
  if (tabs > commas && tabs > semicolons) return '\t';
  return ',';
}

function parseCsvLineFast(line: string, delim = ','): string[] {
  if (!line.includes('"') && !line.includes("'")) {
    return line.split(delim);
  }
  const cols = line.split(delim);
  for (let c = 0; c < cols.length; c++) {
    const cell = cols[c];
    if (cell.length >= 2) {
      if ((cell.startsWith('"') && cell.endsWith('"')) || (cell.startsWith("'") && cell.endsWith("'"))) {
        cols[c] = cell.substring(1, cell.length - 1);
      }
    }
  }
  return cols;
}

export async function parseExcelFile(
  file: File,
  targetType?: 'machines' | 'payments' | 'cash',
  onProgress?: (percent: number, stepText: string) => void
): Promise<SheetRow[]> {
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  onProgress?.(10, 'فتح وتحميل وقراءة الملف مباشرة...');
  await new Promise((r) => setTimeout(r, 10));

  // 1. Fast-path for CSV files
  if (isCsv) {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      if (lines.length > 0) {
        let headerRowIdx = -1;
        let headers: string[] = [];
        let delim = ',';

        for (let i = 0; i < Math.min(lines.length, 12); i++) {
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

        const rows: SheetRow[] = [];
        const numHeaders = headers.length;
        const totalRows = lines.length - (headerRowIdx + 1);

        for (let i = headerRowIdx + 1; i < lines.length; i++) {
          if (i % 12000 === 0) {
            const pct = Math.min(96, 20 + Math.round(((i - headerRowIdx) / (totalRows || 1)) * 76));
            onProgress?.(pct, `استخراج ومعالجة السجلات (${(i - headerRowIdx).toLocaleString('ar-EG')} من ${totalRows.toLocaleString('ar-EG')})...`);
            await new Promise((r) => setTimeout(r, 0));
          }

          const line = lines[i]?.trim();
          if (!line) continue;

          const cols = parseCsvLineFast(line, delim);
          const rowObj: SheetRow = targetType ? { _tabType: targetType } : {};
          let hasData = false;

          for (let c = 0; c < numHeaders; c++) {
            const raw = cols[c];
            if (raw !== undefined && raw !== '') {
              const val = raw.trim();
              if (val !== '') {
                rowObj[headers[c]] = val;
                hasData = true;
              }
            }
          }

          if (hasData) rows.push(rowObj);
        }

        if (rows.length > 0) {
          onProgress?.(100, 'اكتمل التحميل والمعالجة بنجاح!');
          await new Promise((r) => setTimeout(r, 10));
          return rows;
        }
      }
    } catch (e) {
      // Fallback to XLSX parser if text parsing encounters issues
    }
  }

  // 2. High-speed XLSX reading
  onProgress?.(25, 'قراءة الملف وتجهيز أوراق العمل...');
  await new Promise((r) => setTimeout(r, 10));

  const buffer = await file.arrayBuffer();

  onProgress?.(45, 'فك ضغط أوراق العمل واستخراج البيانات...');
  await new Promise((r) => setTimeout(r, 10));

  let workbook: XLSX.WorkBook | null = null;

  try {
    workbook = XLSX.read(buffer, {
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
    try {
      const text = new TextDecoder('utf-8').decode(buffer);
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
    } catch (err2) {
      throw new Error('تعذر قراءة صيغة الملف، يرجى التأكد من صلاحية ملف الإكسل أو CSV.');
    }
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    return [];
  }

  onProgress?.(65, 'استخراج وفرز صفوف الجدول بأقصى سرعة...');
  await new Promise((r) => setTimeout(r, 10));

  const extractRowsFromWorksheet = async (worksheet: XLSX.WorkSheet, defaultTabType?: string): Promise<SheetRow[]> => {
    if (!worksheet || !worksheet['!ref']) return [];
    const aoa = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '', raw: true });
    if (!aoa || aoa.length === 0) return [];

    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(aoa.length, 12); r++) {
      const row = aoa[r];
      if (!Array.isArray(row)) continue;
      const nonEmptyCells = row.map((c) => String(c ?? '').trim()).filter((c) => c !== '');
      if (nonEmptyCells.length >= 1) {
        const hasKnownKeywords = nonEmptyCells.some((c) =>
          /ماكينة|جهاز|pos|machine|sn|id|كود|حساب|مندوب|اسم|فرع|تاريخ|مسلسل|code|acc|name|terminal|merchant|acceptor|doner|donor/i.test(c)
        );
        if (hasKnownKeywords) {
          headerRowIdx = r;
          break;
        }
        if (headerRowIdx === -1 && nonEmptyCells.length >= 2) {
          headerRowIdx = r;
        }
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0;
    }

    const rawHeaders = (aoa[headerRowIdx] || []).map((h, colIdx) => {
      const cleanH = String(h ?? '').replace(/^\uFEFF/, '').trim();
      return cleanH || `عمود_${colIdx + 1}`;
    });

    const result: SheetRow[] = [];
    const numHeaders = rawHeaders.length;
    const totalDataRows = aoa.length - (headerRowIdx + 1);

    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      if (r > 0 && r % 12000 === 0) {
        const currentPct = Math.min(96, 65 + Math.round(((r - headerRowIdx) / (totalDataRows || 1)) * 30));
        onProgress?.(currentPct, `تحميل وتجهيز البيانات (${(r - headerRowIdx).toLocaleString('ar-EG')} من ${totalDataRows.toLocaleString('ar-EG')})...`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const row = aoa[r];
      if (!Array.isArray(row)) continue;
      const rowObj: SheetRow = defaultTabType ? { _tabType: defaultTabType } : {};
      let hasData = false;

      for (let c = 0; c < numHeaders; c++) {
        const raw = row[c];
        if (raw !== undefined && raw !== null && raw !== '') {
          const cellVal = String(raw).trim();
          if (cellVal !== '') {
            rowObj[rawHeaders[c]] = cellVal;
            hasData = true;
          }
        }
      }

      if (hasData) {
        result.push(rowObj);
      }
    }

    return result;
  };

  let targetSheetName = workbook.SheetNames[0];
  let ws = workbook.Sheets[targetSheetName];
  let bestRows = await extractRowsFromWorksheet(ws, targetType);

  if (bestRows.length === 0 && workbook.SheetNames.length > 1) {
    for (let i = 1; i < workbook.SheetNames.length; i++) {
      const sName = workbook.SheetNames[i];
      const candidateWs = workbook.Sheets[sName];
      if (!candidateWs || !candidateWs['!ref']) continue;
      const candidateRows = await extractRowsFromWorksheet(candidateWs, targetType);
      if (candidateRows.length > 0) {
        bestRows = candidateRows;
        break;
      }
    }
  }

  onProgress?.(100, 'اكتمل التحميل والمعالجة بنجاح!');
  await new Promise((r) => setTimeout(r, 10));
  return bestRows;
}

export function downloadTemplateFile(templateType: 1 | 2 | 3, format: 'xlsx' | 'csv' = 'xlsx') {
  let filename = '';
  let headers: string[] = [];
  let sampleRows: (string | number)[][] = [];

  if (templateType === 1) {
    filename = 'نموذج_شيت_الماكينات_المستهدفة';
    headers = ['رقم الماكينة', 'الفرع / المنطقة', 'ملاحظات'];
    sampleRows = [
      ['POS-1001', 'فرع المعادي - القاهرة', 'ماكينة رئيسية'],
      ['POS-1002', 'فرع المهندسين - الجيزة', ''],
      ['POS-1003', 'فرع سموحة - الإسكندرية', ''],
    ];
  } else if (templateType === 2) {
    filename = 'نموذج_شيت_المدفوعات';
    headers = ['رقم الماكينة', 'رقم حساب المدفوعات', 'اسم مسؤول المدفوعات', 'حالة الحساب'];
    sampleRows = [
      ['POS-1001', '1234', 'أحمد محمود سالم', 'نشط'],
      ['POS-1001', '456', 'محمود حسن رضوان', 'نشط'],
    ];
  } else {
    filename = 'نموذج_شيت_الكاش';
    headers = ['رقم الماكينة', 'رقم حساب الكاش', 'اسم مسؤول الكاش', 'حالة الحساب'];
    sampleRows = [
      ['7-POS-1001', '1234', 'أحمد محمود سالم (كاش)', 'نشط'],
      ['7-POS-1002', '555', 'خالد عبد الرحمن (كاش)', 'نشط'],
    ];
  }

  const fullAoa = [headers, ...sampleRows];

  if (format === 'csv') {
    const csvContent =
      '\uFEFF' +
      fullAoa
        .map((row) =>
          row
            .map((val) => `"${(val ?? '').toString().replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } else {
    const wb = XLSX.utils.book_new();
    
    if (templateType === 1) {
      const cashSampleRows = [
        ['7-POS-1001', 'فرع المعادي - القاهرة', 'ماكينة كاش'],
        ['1234', 'فرع المهندسين - الجيزة', 'ماكينة كاش تحول لـ 7-1234 تلقائياً'],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet([['رقم الماكينة', 'الفرع / المنطقة', 'ملاحظات'], ...cashSampleRows]);
      ws1['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'ماكينات الكاش');

      const ws2 = XLSX.utils.aoa_to_sheet([['رقم الماكينة', 'الفرع / المنطقة', 'ملاحظات'], ...sampleRows]);
      ws2['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'ماكينات المدفوعات');
    } else {
      const ws = XLSX.utils.aoa_to_sheet(fullAoa);
      ws['!cols'] = templateType === 2 ? [{ wch: 22 }, { wch: 24 }, { wch: 32 }, { wch: 18 }] : [{ wch: 22 }, { wch: 24 }, { wch: 32 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, 'النموذج_المعتمد');
    }
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }
}

export function exportReconciliationToExcel(rows: ExpandedRow[], fileName = 'تقرير_مطابقة_الماكينات_مدفوعات_وكاش.xlsx') {
  const wb = XLSX.utils.book_new();
  const headers = [
    'م',
    'رقم الماكينة',
    'نوع الشيت',
    'رقم الحساب',
    'اسم المسؤول / المندوب',
    'ترتيب السجل',
    'إجمالي السجلات',
    'حالة الماكينة',
  ];
  const colWidths = [
    { wch: 6 },
    { wch: 22 },
    { wch: 18 },
    { wch: 22 },
    { wch: 32 },
    { wch: 24 },
    { wch: 18 },
    { wch: 24 },
  ];

  const CHUNK_SIZE = 900000; // Under Excel's 1,048,576 limit

  if (rows.length <= CHUNK_SIZE) {
    const data: (string | number)[][] = [headers];

    for (let i = 0; i < rows.length; i++) {
      const item = rows[i];
      let st = 'شاغرة (بدون مسؤول)';
      if (item.status === 'single') st = 'مطابقة فردية';
      if (item.status === 'multi') st = `متعددة السجلات (${item.totalRepsForMachine})`;

      let orderLabel = 'غير مسند';
      if (item.status === 'single') orderLabel = 'وحيد (1 من 1)';
      if (item.status === 'multi') {
        orderLabel =
          item.repOrder === 1
            ? `الأول (1 من ${item.totalRepsForMachine})`
            : `إضافي (${item.repOrder} من ${item.totalRepsForMachine})`;
      }

      data.push([
        i + 1,
        item.machine,
        item.type === 'cash' ? '💵 كاش' : '💳 مدفوعات',
        item.account,
        item.repName,
        orderLabel,
        item.totalRepsForMachine,
        st,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, 'مدفوعات_وكاش_الماكينات');
  } else {
    // Multi-sheet automatic splitting to preserve every row in Excel
    const numSheets = Math.ceil(rows.length / CHUNK_SIZE);
    for (let part = 0; part < numSheets; part++) {
      const start = part * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, rows.length);
      const slice = rows.slice(start, end);

      const data: (string | number)[][] = [headers];
      for (let i = 0; i < slice.length; i++) {
        const item = slice[i];
        let st = 'شاغرة (بدون مسؤول)';
        if (item.status === 'single') st = 'مطابقة فردية';
        if (item.status === 'multi') st = `متعددة السجلات (${item.totalRepsForMachine})`;

        let orderLabel = 'غير مسند';
        if (item.status === 'single') orderLabel = 'وحيد (1 من 1)';
        if (item.status === 'multi') {
          orderLabel =
            item.repOrder === 1
              ? `الأول (1 من ${item.totalRepsForMachine})`
              : `إضافي (${item.repOrder} من ${item.totalRepsForMachine})`;
        }

        data.push([
          start + i + 1,
          item.machine,
          item.type === 'cash' ? '💵 كاش' : '💳 مدفوعات',
          item.account,
          item.repName,
          orderLabel,
          item.totalRepsForMachine,
          st,
        ]);
      }

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, `النتائج_جزء_${part + 1}_من_${numSheets}`);
    }
  }

  XLSX.writeFile(wb, fileName);
}

export function exportReconciliationToCsv(rows: ExpandedRow[], fileName = 'تقرير_مطابقة_الماكينات_شامل.csv') {
  const headers = [
    'م',
    'رقم الماكينة',
    'نوع الشيت',
    'رقم الحساب',
    'اسم المسؤول / المندوب',
    'ترتيب السجل',
    'إجمالي السجلات',
    'حالة الماكينة',
  ];

  const lines: string[] = [];
  lines.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    let st = 'شاغرة (بدون مسؤول)';
    if (item.status === 'single') st = 'مطابقة فردية';
    if (item.status === 'multi') st = `متعددة السجلات (${item.totalRepsForMachine})`;

    let orderLabel = 'غير مسند';
    if (item.status === 'single') orderLabel = 'وحيد (1 من 1)';
    if (item.status === 'multi') {
      orderLabel =
        item.repOrder === 1
          ? `الأول (1 من ${item.totalRepsForMachine})`
          : `إضافي (${item.repOrder} من ${item.totalRepsForMachine})`;
    }

    const row = [
      i + 1,
      item.machine,
      item.type === 'cash' ? 'كاش' : 'مدفوعات',
      item.account,
      item.repName,
      orderLabel,
      item.totalRepsForMachine,
      st,
    ];

    lines.push(
      row
        .map((val) => {
          const str = String(val ?? '').replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    );
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function exportRepStatementToExcel(
  records: Array<{
    machine: string;
    account: string;
    repName: string;
    type: 'cash' | 'pay';
    typeLabel: string;
    repOrder?: number;
    totalReps?: number;
    statusLabel?: string;
    otherReps?: string;
  }>,
  repAccount: string,
  repName = 'غير مدون',
  filename = 'كشف_سجلات_وارتباطات_المندوب_المفصلة.xlsx'
) {
  const totalLinks = records.length;
  const uniqueMachines = new Set(records.map((r) => r.machine.replace(/^7-|^٧-/, ''))).size;
  const cashCount = records.filter((r) => r.type === 'cash').length;
  const payCount = records.filter((r) => r.type === 'pay').length;

  // Count machine duplicates for this rep
  const machineMap = new Map<string, number>();
  records.forEach((r) => {
    const norm = r.machine.replace(/^7-|^٧-/, '');
    machineMap.set(norm, (machineMap.get(norm) || 0) + 1);
  });
  let dupCount = 0;
  machineMap.forEach((cnt) => {
    if (cnt > 1) dupCount += cnt;
  });

  // Top summary rows (Image 2 format)
  const aoa: (string | number)[][] = [
    ['كشف سجلات وارتباطات المندوب المفصلة (جميع الأسطر)'],
    ['اسم المندوب:', repName],
    ['رقم الحساب:', repAccount],
    ['إجمالي عدد الارتباطات والأسطر:', totalLinks],
    ['إجمالي عدد الماكينات الفريدة:', uniqueMachines],
    ['ماكينات مكررة لنفس المندوب:', dupCount],
    ['سجلات الكاش (7-):', cashCount],
    ['سجلات المدفوعات:', payCount],
    [], // empty row separator
    // Table Headers (Exact Image 2 format)
    [
      'اسم المندوب',
      'رقم حساب المندوب',
      'المناديب المشاركون على الماكينة',
      'حالة الملكية والتعدد مع الآخرين',
      'تفاصيل نوع الارتباط',
      'إجمالي تكرار الماكينة للمندوب',
      'ترتيب السجل للمندوب',
      'نوع الحساب',
      'رقم الماكينة',
    ],
  ];

  // Data rows
  const machineOccurrenceCounter = new Map<string, number>();

  records.forEach((rec) => {
    const norm = rec.machine.replace(/^7-|^٧-/, '');
    const currentOrd = (machineOccurrenceCounter.get(norm) || 0) + 1;
    machineOccurrenceCounter.set(norm, currentOrd);
    const totalOccForMachine = machineMap.get(norm) || 1;

    let orderStr = `${currentOrd} من ${totalOccForMachine}`;
    if (totalOccForMachine === 1) orderStr = 'وحيد (1 من 1)';

    let ownershipStr = 'مطابقة فردية للمندوب';
    if (totalOccForMachine > 1) {
      ownershipStr = `مكررة لنفس المندوب (${totalOccForMachine} أسطر)`;
    }

    aoa.push([
      rec.repName || repName,
      rec.account || repAccount,
      rec.otherReps || 'لا يوجد مشاركون آخرون',
      ownershipStr,
      rec.type === 'cash' ? 'حساب أجهزة الكاش (7-)' : 'حساب المدفوعات العامة',
      totalOccForMachine,
      orderStr,
      rec.typeLabel || (rec.type === 'cash' ? 'كاش' : 'مدفوعات'),
      rec.machine,
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws['!cols'] = [
    { wch: 25 }, // اسم المندوب
    { wch: 18 }, // رقم حساب المندوب
    { wch: 28 }, // المناديب المشاركون
    { wch: 28 }, // حالة الملكية والتعدد
    { wch: 22 }, // تفاصيل نوع الارتباط
    { wch: 24 }, // إجمالي تكرار الماكينة
    { wch: 20 }, // ترتيب السجل
    { wch: 16 }, // نوع الحساب
    { wch: 22 }, // رقم الماكينة
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'كشف_المندوب_المفصل');
  XLSX.writeFile(wb, filename);
}
