/**
 * exportBankPayment.ts
 * Generates a bank-upload-ready Excel file from approved site invoices.
 * Column order, validations, and formatting strictly follow HDFC/SBI NEFT upload spec.
 */

import ExcelJS from 'exceljs';
import { format } from 'date-fns';

// ─── colour palette (matches bank template) ─────────────────────────────────
const C_ORANGE  = 'FFFF6600'; // mandatory column header
const C_WHITE   = 'FFFFFFFF'; // blank column header
const C_GREEN   = 'FF92D050'; // optional column header
const C_TEXT_MANDATORY = 'FFCC0000'; // red text for "Mandatory" row
const C_TEXT_BLANK     = 'FF808080'; // grey text for "Blank" row
const C_TEXT_OPTIONAL  = 'FF007700'; // dark green for "Optional"
const C_HEADER_BG      = 'FFD9D9D9'; // light grey for the constraints row
const C_EXAMPLE_BG     = 'FFFFF2CC'; // pale yellow for examples row
const C_DATA_ODD       = 'FFFFFFFF';
const C_DATA_EVEN      = 'FFEFF7FF';

// ─── column definitions ──────────────────────────────────────────────────────
interface ColDef {
  header: string;
  status: 'Mandatory' | 'Blank' | 'Optional';
  constraint: string; // character limit or format note
  example: string;
  width: number;
}

const COLUMNS: ColDef[] = [
  { header: 'Transaction Type',              status: 'Mandatory', constraint: '',         example: 'N = NEFT\nI = Internal',       width: 14 },
  { header: 'Beneficiary Code',              status: 'Blank',     constraint: '',         example: '',                             width: 14 },
  { header: 'Beneficiary Account Number',    status: 'Mandatory', constraint: 'Max 25',   example: '43101000003200',               width: 22 },
  { header: 'Instrument Amount',             status: 'Mandatory', constraint: '17,2 fmt', example: '3000.00',                      width: 16 },
  { header: 'Beneficiary Name',              status: 'Mandatory', constraint: 'Max 40',   example: 'SANJAY PANERI',                width: 22 },
  { header: 'Drawee Location',               status: 'Blank',     constraint: '',         example: '',                             width: 14 },
  { header: 'Print Location',                status: 'Blank',     constraint: '',         example: '',                             width: 14 },
  { header: 'Beneficiary Address 1',         status: 'Blank',     constraint: '',         example: '',                             width: 14 },
  { header: 'Beneficiary Address 2',         status: 'Blank',     constraint: '',         example: '',                             width: 14 },
  { header: 'Beneficiary Address 3',         status: 'Blank',     constraint: '',         example: '',                             width: 14 },
  { header: 'Beneficiary Address 4',         status: 'Blank',     constraint: '',         example: '',                             width: 14 },
  { header: 'Beneficiary Address 5',         status: 'Blank',     constraint: '',         example: '',                             width: 14 },
  { header: 'Instruction Reference Number',  status: 'Mandatory', constraint: 'Max 20',   example: 'SANJAY PANERI',                width: 22 },
  { header: 'Customer Reference Number',     status: 'Mandatory', constraint: 'Max 20',   example: 'SANJAY PANERI',                width: 22 },
  { header: 'Payment Details 1',             status: 'Optional',  constraint: 'Max 30',   example: 'TRAVELLING EXPENSES',          width: 24 },
  { header: 'Payment Details 2',             status: 'Optional',  constraint: 'Max 30',   example: '',                             width: 16 },
  { header: 'Payment Details 3',             status: 'Optional',  constraint: 'Max 30',   example: '',                             width: 16 },
  { header: 'Payment Details 4',             status: 'Optional',  constraint: 'Max 30',   example: '',                             width: 16 },
  { header: 'Payment Details 5',             status: 'Optional',  constraint: 'Max 30',   example: '',                             width: 16 },
  { header: 'Payment Details 6',             status: 'Optional',  constraint: 'Max 30',   example: '',                             width: 16 },
  { header: 'Payment Details 7',             status: 'Optional',  constraint: 'Max 30',   example: '',                             width: 16 },
  { header: 'Cheque Number',                 status: 'Optional',  constraint: 'Max 12',   example: '',                             width: 14 },
  { header: 'Cheque / Transaction Date',     status: 'Mandatory', constraint: 'DD/MM/YYYY', example: '08/01/2025',                 width: 20 },
  { header: 'MICR Number',                   status: 'Blank',     constraint: '',         example: '',                             width: 14 },
  { header: 'IFSC Code',                     status: 'Mandatory', constraint: 'Max 15',   example: 'HDFC0000629',                  width: 16 },
  { header: 'Beneficiary Bank Name',         status: 'Mandatory', constraint: 'Max 40',   example: 'HDFC BANK LTD',                width: 22 },
  { header: 'Beneficiary Bank Branch Name',  status: 'Optional',  constraint: 'Max 40',   example: 'MARIN POINT',                  width: 22 },
  { header: 'Beneficiary Email ID',          status: 'Mandatory', constraint: 'Max 100',  example: 'vendor@example.com',           width: 30 },
];

// ─── helpers ─────────────────────────────────────────────────────────────────
function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function thin(): ExcelJS.Border {
  return { style: 'thin', color: { argb: 'FF000000' } };
}

function allBorders(cell: ExcelJS.Cell) {
  cell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };
}

function headerBg(status: 'Mandatory' | 'Blank' | 'Optional'): string {
  if (status === 'Mandatory') return C_ORANGE;
  if (status === 'Blank')     return C_WHITE;
  return C_GREEN;
}

function statusTextColor(status: 'Mandatory' | 'Blank' | 'Optional'): string {
  if (status === 'Mandatory') return C_TEXT_MANDATORY;
  if (status === 'Blank')     return C_TEXT_BLANK;
  return C_TEXT_OPTIONAL;
}

/** Parse bank_details JSON stored as a string in Supabase */
function parseBankDetails(raw: any): {
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  email: string;
  mobile?: string;
} {
  if (!raw) return { accountNumber: '', bankName: '', ifscCode: '', email: '' };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      accountNumber: parsed.accountNumber || parsed.account_number || '',
      bankName:      parsed.bankName      || parsed.bank_name      || '',
      ifscCode:      parsed.ifscCode      || parsed.ifsc_code      || '',
      email:         parsed.email         || '',
      mobile:        parsed.mobile        || '',
    };
  } catch {
    return { accountNumber: '', bankName: '', ifscCode: '', email: '' };
  }
}

/** Determine Transaction Type: I for HDFC (internal), N for all others */
function transactionType(bankName: string): 'I' | 'N' {
  return bankName.toUpperCase().includes('HDFC') ? 'I' : 'N';
}

/** Format amount to 17,2 spec: 2 decimal places always */
function formatAmount(amount: number): string {
  return Number(amount).toFixed(2);
}

// ─── main export function ─────────────────────────────────────────────────────
/**
 * @param invoices - Raw Supabase rows from site_invoices (already filtered to approved status)
 * @param siteName - Optional site name for the filename
 */
export async function exportBankPayment(invoices: any[], siteName = 'Site') {
  const approvedInvoices = invoices.filter(
    (inv) => inv.payment_status === 'approved' || inv.paymentStatus === 'approved'
  );

  if (approvedInvoices.length === 0) {
    throw new Error('No approved invoices to export.');
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Maurice Engineering Works';
  wb.created = new Date();

  const ws = wb.addWorksheet('Bank Payment Upload', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // set column widths
  ws.columns = COLUMNS.map((col, i) => ({
    key: `col${i + 1}`,
    width: col.width,
  }));

  // ── ROW 1 : Column header labels ──────────────────────────────────────────
  const row1 = ws.addRow(COLUMNS.map((c) => c.header));
  row1.height = 30;
  row1.eachCell((cell, colNum) => {
    const col = COLUMNS[colNum - 1];
    cell.fill = fill(headerBg(col.status));
    cell.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    allBorders(cell);
  });

  // ── ROW 2 : Mandatory / Blank / Optional ─────────────────────────────────
  const row2 = ws.addRow(COLUMNS.map((c) => c.status));
  row2.height = 18;
  row2.eachCell((cell, colNum) => {
    const col = COLUMNS[colNum - 1];
    cell.fill  = fill('FFF0F0F0');
    cell.font  = { bold: true, size: 8, color: { argb: statusTextColor(col.status) } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    allBorders(cell);
  });

  // ── ROW 3 : Constraints / format ─────────────────────────────────────────
  const row3 = ws.addRow(COLUMNS.map((c) => c.constraint));
  row3.height = 16;
  row3.eachCell((cell) => {
    cell.fill = fill(C_HEADER_BG);
    cell.font = { size: 8, italic: true, color: { argb: 'FF444444' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    allBorders(cell);
  });

  // ── ROW 4 : Examples ─────────────────────────────────────────────────────
  const row4 = ws.addRow(COLUMNS.map((c) => c.example));
  row4.height = 18;
  row4.eachCell((cell) => {
    cell.fill = fill(C_EXAMPLE_BG);
    cell.font = { size: 8, color: { argb: 'FF555500' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    allBorders(cell);
  });

  // ── DATA ROWS ─────────────────────────────────────────────────────────────
  approvedInvoices.forEach((inv, idx) => {
    const bd = parseBankDetails(inv.bank_details || inv.bankDetails);
    const beneficiaryName  = String(inv.party_name   || inv.partyName   || '').slice(0, 40).toUpperCase();
    const instrRef         = beneficiaryName.slice(0, 20);
    const customerRef      = beneficiaryName.slice(0, 20);
    const amount           = formatAmount(Number(inv.net_amount || inv.netAmount || 0));
    const txDate           = format(new Date(inv.date), 'dd/MM/yyyy');
    const payDetails1      = String(inv.material || '').slice(0, 30).toUpperCase();
    const txType           = transactionType(bd.bankName);

    const rowData = [
      txType,                                          //  1 Transaction Type
      '',                                              //  2 Beneficiary Code (blank)
      bd.accountNumber.replace(/\D/g, '').slice(0, 25), //  3 Account Number
      amount,                                          //  4 Instrument Amount
      beneficiaryName,                                 //  5 Beneficiary Name
      '',                                              //  6 Drawee Location
      '',                                              //  7 Print Location
      '',                                              //  8 Bene Address 1
      '',                                              //  9 Bene Address 2
      '',                                              // 10 Bene Address 3
      '',                                              // 11 Bene Address 4
      '',                                              // 12 Bene Address 5
      instrRef,                                        // 13 Instruction Reference Number
      customerRef,                                     // 14 Customer Reference Number
      payDetails1,                                     // 15 Payment Details 1
      '',                                              // 16 Payment Details 2
      '',                                              // 17 Payment Details 3
      '',                                              // 18 Payment Details 4
      '',                                              // 19 Payment Details 5
      '',                                              // 20 Payment Details 6
      '',                                              // 21 Payment Details 7
      '',                                              // 22 Cheque Number
      txDate,                                          // 23 Cheque/Transaction Date
      '',                                              // 24 MICR Number
      bd.ifscCode.toUpperCase().slice(0, 15),          // 25 IFSC Code
      bd.bankName.toUpperCase().slice(0, 40),          // 26 Beneficiary Bank Name
      '',                                              // 27 Branch Name (blank optional)
      bd.email.slice(0, 100),                          // 28 Beneficiary Email ID
    ];

    const dataRow = ws.addRow(rowData);
    dataRow.height = 16;
    const bgArgb = idx % 2 === 0 ? C_DATA_ODD : C_DATA_EVEN;
    dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = fill(bgArgb);
      cell.font = { size: 9 };
      cell.alignment = {
        horizontal: colNum === 4 ? 'right' : 'left', // amount right-aligned
        vertical: 'middle',
      };
      allBorders(cell);
    });

    // Amount: keep as number with 2 decimals for bank processing
    const amtCell = dataRow.getCell(4);
    amtCell.value = parseFloat(amount);
    amtCell.numFmt = '#,##0.00';
  });

  // ── TOTAL ROW ─────────────────────────────────────────────────────────────
  const totalRow = ws.addRow([]);
  const totalAmount = approvedInvoices.reduce(
    (sum, inv) => sum + Number(inv.net_amount || inv.netAmount || 0),
    0
  );

  const totalBoldCell = totalRow.getCell(3);
  totalBoldCell.value = 'TOTAL';
  totalBoldCell.font  = { bold: true, size: 9 };
  totalBoldCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalBoldCell.fill = fill('FFDDDDDD');

  const totalAmtCell = totalRow.getCell(4);
  totalAmtCell.value = totalAmount;
  totalAmtCell.numFmt = '#,##0.00';
  totalAmtCell.font   = { bold: true, size: 9 };
  totalAmtCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalAmtCell.fill  = fill('FFDDDDDD');
  allBorders(totalBoldCell);
  allBorders(totalAmtCell);
  totalRow.height = 18;

  // ── download ──────────────────────────────────────────────────────────────
  const safeDate = format(new Date(), 'ddMMMyyyy');
  const safeSite = siteName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const fileName = `BankPayment_${safeSite}_${safeDate}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
