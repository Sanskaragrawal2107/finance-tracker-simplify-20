import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { Site, Expense, Advance, FundsReceived } from '@/lib/types';

// ─── colour helpers ─────────────────────────────────────────────────────────
const YELLOW  = 'FFFFFF00'; // section 1 header  (Received from H.O.)
const GREEN   = 'FF92D050'; // section 2+3 header (Expenditure / Advance)
const HEADER_BG = 'FFD9D9D9'; // sub-column header background (light grey)
const WHITE   = 'FFFFFFFF';

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function boldCenter(cell: ExcelJS.Cell, fontSize = 10) {
  cell.font = { bold: true, size: fontSize };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

function border(cell: ExcelJS.Cell) {
  const b: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } };
  cell.border = { top: b, bottom: b, left: b, right: b };
}

function applyHeaderStyle(cell: ExcelJS.Cell, bgArgb: string) {
  cell.fill = fill(bgArgb);
  boldCenter(cell, 11);
  border(cell);
}

function applySubHeaderStyle(cell: ExcelJS.Cell) {
  cell.fill = fill(HEADER_BG);
  boldCenter(cell, 9);
  border(cell);
}

function applyDataStyle(cell: ExcelJS.Cell, alignRight = false) {
  cell.fill = fill(WHITE);
  cell.font  = { size: 9 };
  cell.alignment = { horizontal: alignRight ? 'right' : 'left', vertical: 'middle', wrapText: true };
  border(cell);
}

// ─── column layout ───────────────────────────────────────────────────────────
//  A  B  C  D  E  F  G  H   I   J   K   L   M   N   O   P   Q   R
//  [--- RECEIVED FROM H.O. ---]  sp  [-- EXPENDITURE --]  sp  [--- ADVANCE ON SITE -----------]

const COL = {
  // Section 1 – Received from H.O.
  HO_DATE1 : 1,  // A – date funds received
  HO_DESC1 : 2,  // B – "Advance received by site supervisor"
  HO_AMT1  : 3,  // C
  HO_DATE2 : 4,  // D – "Advance paid to party direct by H.O."
  HO_DESC2 : 5,  // E
  HO_AMT2  : 6,  // F
  // Section 2 – Expenditure
  EX_DATE  : 8,  // H
  EX_DESC  : 9,  // I
  EX_HEAD  : 10, // J
  EX_AMT   : 11, // K
  // Section 3 – Advance on site
  AD_DATE1 : 13, // M – sub-contractor
  AD_DESC1 : 14, // N
  AD_AMT1  : 15, // O
  AD_DATE2 : 16, // P – direct labour / worker
  AD_DESC2 : 17, // Q
  AD_AMT2  : 18, // R
} as const;

// ─── public function ─────────────────────────────────────────────────────────
export async function exportSiteExcel(
  site: Site,
  expenses: Expense[],
  advances: Advance[],
  fundsReceived: FundsReceived[],
  invoices: any[] = [],
  supervisorTransactions: any[] = [],
  siteId?: string,
) {
  const workbook  = new ExcelJS.Workbook();
  const ws        = workbook.addWorksheet('Site Report');

  // ── column widths ──────────────────────────────────────────────────────────
  ws.columns = [
    { width: 12 }, // A – HO date1
    { width: 38 }, // B – HO supervisor advance desc
    { width: 12 }, // C – HO amt1
    { width: 12 }, // D – HO date2
    { width: 38 }, // E – HO party desc
    { width: 12 }, // F – HO amt2
    { width: 3  }, // G – spacer
    { width: 12 }, // H – EX date
    { width: 35 }, // I – EX description
    { width: 28 }, // J – EX category
    { width: 12 }, // K – EX amount
    { width: 3  }, // L – spacer
    { width: 12 }, // M – AD sub-contractor date
    { width: 38 }, // N – AD sub-contractor name
    { width: 12 }, // O – AD sub-contractor amt
    { width: 12 }, // P – AD worker date
    { width: 38 }, // Q – AD worker name
    { width: 12 }, // R – AD worker amt
  ];

  // ── Row 1: MEW + Site name banner ─────────────────────────────────────────
  ws.getRow(1).height = 28;
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `MAURICE ENGINEERING WORKS  ·  ${site.name}  |  ${site.jobName}  |  Ref: MEW/${site.posNo || ''}  |  Date: ${format(new Date(), 'dd-MM-yyyy')}`;
  titleCell.font  = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill  = fill('FF1A1A1A');
  ws.mergeCells(1, 1, 1, 18);

  // ── Row 2: Section headers ─────────────────────────────────────────────────
  ws.getRow(2).height = 22;

  const hoHeader = ws.getCell(2, COL.HO_DATE1);
  hoHeader.value  = 'RECEIVED FROM H.O.';
  applyHeaderStyle(hoHeader, YELLOW);
  hoHeader.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
  ws.mergeCells(2, COL.HO_DATE1, 2, COL.HO_AMT2);

  const exHeader = ws.getCell(2, COL.EX_DATE);
  exHeader.value  = 'EXPENDITURE ON SITE BY SUPERVISOR';
  applyHeaderStyle(exHeader, GREEN);
  ws.mergeCells(2, COL.EX_DATE, 2, COL.EX_AMT);

  const adHeader = ws.getCell(2, COL.AD_DATE1);
  adHeader.value  = 'ADVANCE ON SITE';
  applyHeaderStyle(adHeader, GREEN);
  ws.mergeCells(2, COL.AD_DATE1, 2, COL.AD_AMT2);

  // ── Row 3: Sub-column headers ──────────────────────────────────────────────
  ws.getRow(3).height = 32;
  const subHeaders: [number, string][] = [
    [COL.HO_DATE1, 'DATE'],
    [COL.HO_DESC1, 'ADVANCE RECEIVED BY\nSITE SUPERVISOR'],
    [COL.HO_AMT1,  'AMOUNT'],
    [COL.HO_DATE2, 'DATE'],
    [COL.HO_DESC2, 'FUNDS RECEIVED FROM\nSUPERVISOR SITE'],
    [COL.HO_AMT2,  'AMOUNT'],
    [COL.EX_DATE,  'DATE'],
    [COL.EX_DESC,  'FOR WHAT EXPENSES'],
    [COL.EX_HEAD,  'HEAD OF EXPENSES'],
    [COL.EX_AMT,   'AMOUNT'],
    [COL.AD_DATE1, 'DATE'],
    [COL.AD_DESC1, 'ADVANCE PAID TO\nSUB-CONTRACTOR BY SUPERVISOR'],
    [COL.AD_AMT1,  'AMOUNT'],
    [COL.AD_DATE2, 'DATE'],
    [COL.AD_DESC2, 'ADVANCE PAID TO\nDIRECTLY LABOUR BY SUPERVISOR'],
    [COL.AD_AMT2,  'AMOUNT'],
  ];
  for (const [col, label] of subHeaders) {
    const c = ws.getCell(3, col);
    c.value = label;
    applySubHeaderStyle(c);
  }

  // ── Data rows ──────────────────────────────────────────────────────────────
  const fmtDate = (d: Date | string | undefined) => {
    if (!d) return '';
    try { return format(new Date(d as any), 'dd/MM/yyyy'); }
    catch { return String(d); }
  };

  // Helper: read field from either camelCase or snake_case row
  const getField = (obj: any, camel: string, snake: string) => obj[camel] ?? obj[snake];

  // Split advances into subcontractor vs direct labour / worker
  const subContrAdv = advances.filter(a => getField(a, 'recipientType', 'recipient_type') === 'subcontractor');
  const workerAdv   = advances.filter(a => {
    const t = getField(a, 'recipientType', 'recipient_type');
    return t === 'worker' || !t;
  });

  // Combine expenses + supervisor-paid invoices for the Expenditure section.
  // EXCLUDE invoices with payment_status='approved' — those are HO-bank-paid and belong
  // only in the bank payment export (exportBankPayment.ts uses payment_status='approved' as its sole criterion).
  // Only 'paid' invoices (paid directly by supervisor) should appear in the site Excel.
  const approvedInvoices = invoices.filter(inv => {
    const status = inv.payment_status || inv.paymentStatus || '';
    return status === 'paid';
  });
  const expenditureItems = [
    ...expenses.map(e => ({
      date: e.date,
      description: e.description,
      category: String(e.category).toUpperCase(),
      amount: Number(e.amount),
    })),
    ...approvedInvoices.map(inv => ({
      date: inv.date || inv.created_at,
      description: inv.party_name || inv.vendor_name || 'Invoice',
      category: 'INVOICE',
      amount: Number(inv.net_amount || inv.gross_amount || inv.amount) || 0,
    })),
  ].sort((a, b) => new Date(a.date as any).getTime() - new Date(b.date as any).getTime());

  // Supervisor outgoing payments (this site paid another site)
  const supervisorPaymentsOut = supervisorTransactions.filter(
    t => siteId && t.payer_site_id === siteId
  );
  // Supervisor incoming payments (this site received from another site)
  const supervisorPaymentsIn = supervisorTransactions.filter(
    t => siteId && t.receiver_site_id === siteId
  );

  const maxRows = Math.max(
    fundsReceived.length,
    supervisorPaymentsIn.length,
    expenditureItems.length,
    subContrAdv.length,
    workerAdv.length,
    supervisorPaymentsOut.length,
    1,
  );

  let hoTotal1 = 0, hoTotal2 = 0, exTotal = 0, adTotal1 = 0, adTotal2 = 0;

  for (let i = 0; i < maxRows; i++) {
    const rowNum = 4 + i;
    ws.getRow(rowNum).height = 16;

    // --- Section 1: Received from H.O. ------------------------------------
    const fund = fundsReceived[i];
    const c1 = ws.getCell(rowNum, COL.HO_DATE1);
    c1.value = fund ? fmtDate(fund.date) : '';
    applyDataStyle(c1);

    const c2 = ws.getCell(rowNum, COL.HO_DESC1);
    c2.value = fund ? (fund.source || fund.reference || 'Funds Received') : '';
    applyDataStyle(c2);

    const c3 = ws.getCell(rowNum, COL.HO_AMT1);
    c3.value = fund ? Number(fund.amount) : '';
    c3.numFmt = '₹#,##0.00';
    applyDataStyle(c3, true);
    if (fund) hoTotal1 += Number(fund.amount);

    // Right side of HO section: Funds received from another supervisor
    const supIn = supervisorPaymentsIn[i];
    const c4 = ws.getCell(rowNum, COL.HO_DATE2);
    c4.value = supIn ? fmtDate(supIn.date) : '';
    applyDataStyle(c4);
    const c5 = ws.getCell(rowNum, COL.HO_DESC2);
    c5.value = supIn ? `From: ${supIn.payer_site?.name || supIn.payer_site_id}` : '';
    applyDataStyle(c5);
    const c6 = ws.getCell(rowNum, COL.HO_AMT2);
    c6.value = supIn ? Number(supIn.amount) : '';
    c6.numFmt = '₹#,##0.00';
    applyDataStyle(c6, true);
    if (supIn) hoTotal2 += Number(supIn.amount);

    // --- Section 2: Expenditure (expenses + approved invoices) ------------
    const expItem = expenditureItems[i];
    const c7 = ws.getCell(rowNum, COL.EX_DATE);
    c7.value = expItem ? fmtDate(expItem.date) : '';
    applyDataStyle(c7);

    const c8 = ws.getCell(rowNum, COL.EX_DESC);
    c8.value = expItem ? expItem.description : '';
    applyDataStyle(c8);

    const c9 = ws.getCell(rowNum, COL.EX_HEAD);
    c9.value = expItem ? expItem.category : '';
    applyDataStyle(c9);

    const c10 = ws.getCell(rowNum, COL.EX_AMT);
    c10.value = expItem ? expItem.amount : '';
    c10.numFmt = '₹#,##0.00';
    applyDataStyle(c10, true);
    if (expItem) exTotal += expItem.amount;

    // --- Section 3: Advance on site (sub-contractor + worker) -------------
    const subAdv = subContrAdv[i];
    const wrkAdv = workerAdv[i];

    const c11 = ws.getCell(rowNum, COL.AD_DATE1);
    c11.value = subAdv ? fmtDate(subAdv.date) : '';
    applyDataStyle(c11);

    const c12 = ws.getCell(rowNum, COL.AD_DESC1);
    c12.value = subAdv ? (getField(subAdv, 'recipientName', 'recipient_name') || '') : '';
    applyDataStyle(c12);

    const c13 = ws.getCell(rowNum, COL.AD_AMT1);
    c13.value = subAdv ? Number(subAdv.amount) : '';
    c13.numFmt = '₹#,##0.00';
    applyDataStyle(c13, true);
    if (subAdv) adTotal1 += Number(subAdv.amount);

    const c14 = ws.getCell(rowNum, COL.AD_DATE2);
    c14.value = wrkAdv ? fmtDate(wrkAdv.date) : '';
    applyDataStyle(c14);

    const c15 = ws.getCell(rowNum, COL.AD_DESC2);
    c15.value = wrkAdv ? (getField(wrkAdv, 'recipientName', 'recipient_name') || '') : '';
    applyDataStyle(c15);

    const c16 = ws.getCell(rowNum, COL.AD_AMT2);
    c16.value = wrkAdv ? Number(wrkAdv.amount) : '';
    c16.numFmt = '₹#,##0.00';
    applyDataStyle(c16, true);
    if (wrkAdv) adTotal2 += Number(wrkAdv.amount);
  }

  // ── Totals row ─────────────────────────────────────────────────────────────
  const totalRow = 4 + maxRows;
  ws.getRow(totalRow).height = 18;

  function totalCell(row: number, col: number, value: number | string, isAmt = false) {
    const c = ws.getCell(row, col);
    c.value = value;
    c.fill  = fill(HEADER_BG);
    c.font  = { bold: true, size: 9 };
    c.alignment = { horizontal: isAmt ? 'right' : 'center', vertical: 'middle' };
    c.numFmt = isAmt ? '₹#,##0.00' : '';
    border(c);
  }

  totalCell(totalRow, COL.HO_DATE1, 'TOTAL', false);
  ws.mergeCells(totalRow, COL.HO_DATE1, totalRow, COL.HO_DESC1);
  totalCell(totalRow, COL.HO_AMT1,  hoTotal1, true);
  totalCell(totalRow, COL.HO_DATE2, '', false);
  ws.mergeCells(totalRow, COL.HO_DATE2, totalRow, COL.HO_DESC2);
  totalCell(totalRow, COL.HO_AMT2,  hoTotal2, true);

  totalCell(totalRow, COL.EX_DATE, 'TOTAL', false);
  ws.mergeCells(totalRow, COL.EX_DATE, totalRow, COL.EX_HEAD);
  totalCell(totalRow, COL.EX_AMT, exTotal, true);

  totalCell(totalRow, COL.AD_DATE1, 'TOTAL', false);
  ws.mergeCells(totalRow, COL.AD_DATE1, totalRow, COL.AD_DESC1);
  totalCell(totalRow, COL.AD_AMT1, adTotal1, true);
  totalCell(totalRow, COL.AD_DATE2, 'TOTAL', false);
  ws.mergeCells(totalRow, COL.AD_DATE2, totalRow, COL.AD_DESC2);
  totalCell(totalRow, COL.AD_AMT2, adTotal2, true);

  // ── Supervisor Payments Out summary ────────────────────────────────────────
  let supOutTotal = 0;
  let nextFreeRow = totalRow + 2;

  if (supervisorPaymentsOut.length > 0) {
    const supOutHeaderRow = nextFreeRow;
    ws.getRow(supOutHeaderRow).height = 18;
    const supHeader = ws.getCell(supOutHeaderRow, COL.AD_DATE1);
    supHeader.value = 'ADVANCE PAID TO SUPERVISOR SITES';
    supHeader.fill = fill('FFFFE0CC');
    supHeader.font = { bold: true, size: 10 };
    supHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    border(supHeader);
    ws.mergeCells(supOutHeaderRow, COL.AD_DATE1, supOutHeaderRow, COL.AD_AMT2);

    supervisorPaymentsOut.forEach((t, idx) => {
      const rn = supOutHeaderRow + 1 + idx;
      ws.getRow(rn).height = 16;
      const d = ws.getCell(rn, COL.AD_DATE1); d.value = fmtDate(t.date); applyDataStyle(d);
      const desc = ws.getCell(rn, COL.AD_DESC1);
      desc.value = `To: ${t.receiver_site?.name || t.receiver_site_id}`;
      applyDataStyle(desc);
      ws.mergeCells(rn, COL.AD_DESC1, rn, COL.AD_DATE2);
      const amt = ws.getCell(rn, COL.AD_AMT2);
      amt.value = Number(t.amount);
      amt.numFmt = '₹#,##0.00';
      applyDataStyle(amt, true);
      supOutTotal += Number(t.amount);
    });

    const supTotalRow = supOutHeaderRow + supervisorPaymentsOut.length + 1;
    ws.getRow(supTotalRow).height = 18;
    totalCell(supTotalRow, COL.AD_DATE1, 'TOTAL SUPERVISOR PAYMENTS', false);
    ws.mergeCells(supTotalRow, COL.AD_DATE1, supTotalRow, COL.AD_DATE2);
    totalCell(supTotalRow, COL.AD_AMT2, supOutTotal, true);
    nextFreeRow = supTotalRow + 2;
  }

  // ── FINANCIAL SUMMARY BLOCK ────────────────────────────────────────────────
  // Mirrors the UI "Financial Details" panel exactly.
  const summaryStartRow = nextFreeRow;
  const BLUE_DARK  = 'FF1F3864';
  const BLUE_LIGHT = 'FFD6E4F0';
  const RED_BG     = 'FFFFD7D7';
  const GREEN_BG   = 'FFD7F0DA';

  // Title banner
  ws.getRow(summaryStartRow).height = 22;
  const sumTitle = ws.getCell(summaryStartRow, COL.EX_DATE);
  sumTitle.value = 'FINANCIAL SUMMARY';
  sumTitle.fill  = fill(BLUE_DARK);
  sumTitle.font  = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  sumTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  border(sumTitle);
  ws.mergeCells(summaryStartRow, COL.EX_DATE, summaryStartRow, COL.EX_AMT);

  // Helper to write a label+value summary row
  function summaryRow(rowNum: number, label: string, value: number, bgArgb: string, isTotal = false) {
    ws.getRow(rowNum).height = 17;
    const lbl = ws.getCell(rowNum, COL.EX_DATE);
    lbl.value = label;
    lbl.fill  = fill(bgArgb);
    lbl.font  = { bold: isTotal, size: isTotal ? 11 : 10 };
    lbl.alignment = { horizontal: 'left', vertical: 'middle' };
    border(lbl);
    ws.mergeCells(rowNum, COL.EX_DATE, rowNum, COL.EX_HEAD);

    const val = ws.getCell(rowNum, COL.EX_AMT);
    val.value  = value;
    val.numFmt = '₹#,##0.00';
    val.fill   = fill(bgArgb);
    val.font   = { bold: isTotal, size: isTotal ? 11 : 10 };
    val.alignment = { horizontal: 'right', vertical: 'middle' };
    border(val);
  }

  const totalFundsFromSupervisor = hoTotal2;
  const totalFundsReceived       = hoTotal1 + hoTotal2;
  const totalAdvances            = adTotal1 + adTotal2;
  const totalOutgoing            = exTotal + totalAdvances + supOutTotal;
  const currentBalance           = totalFundsReceived - totalOutgoing;

  let sr = summaryStartRow + 1;
  summaryRow(sr++, '(+)  Funds Received from H.O.',         hoTotal1,              BLUE_LIGHT);
  summaryRow(sr++, '(+)  Funds Received from Supervisor',   totalFundsFromSupervisor, BLUE_LIGHT);
  summaryRow(sr++, '     TOTAL FUNDS RECEIVED',             totalFundsReceived,     BLUE_LIGHT, true);

  // blank spacer
  ws.getRow(sr).height = 6; sr++;

  summaryRow(sr++, '(-)  Total Expenditure (Expenses + Invoices)', exTotal,    'FFFFF2CC');
  summaryRow(sr++, '(-)  Total Advances (Sub-contractor)',   adTotal1,          'FFFFF2CC');
  summaryRow(sr++, '(-)  Total Advances (Direct Labour)',    adTotal2,          'FFFFF2CC');
  summaryRow(sr++, '(-)  Advance Paid to Supervisor Sites',  supOutTotal,       'FFFFF2CC');
  summaryRow(sr++, '     TOTAL OUTGOING',                   totalOutgoing,      'FFFFF2CC', true);

  // blank spacer
  ws.getRow(sr).height = 6; sr++;

  // Current Balance — red if negative, green if positive
  const balBg = currentBalance >= 0 ? GREEN_BG : RED_BG;
  summaryRow(sr, 'CURRENT BALANCE', currentBalance, balBg, true);

  // ── Download ───────────────────────────────────────────────────────────────
  const buffer   = await workbook.xlsx.writeBuffer();
  const blob     = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url      = URL.createObjectURL(blob);
  const anchor   = document.createElement('a');
  anchor.href    = url;
  anchor.download = `${site.name.replace(/[^a-z0-9]/gi, '_')}_report.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
