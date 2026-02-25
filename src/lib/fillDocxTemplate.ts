import PizZip from "pizzip";
import { saveAs } from "file-saver";
import { Transaction, ACCOUNT_COLUMNS } from "@/types/finance";

const splitAmount = (n: number) => {
  const dinars = Math.floor(n);
  const fils = Math.round((n - dinars) * 1000);
  return { dinars: dinars > 0 ? String(dinars) : "", fils: fils > 0 ? String(fils) : "" };
};

const getAccountDetails = (tx: Transaction) => {
  const debits: { label: string; amount: number }[] = [];
  const credits: { label: string; amount: number }[] = [];
  ACCOUNT_COLUMNS.forEach((col) => {
    if (tx.amounts[col.id]?.debit > 0) debits.push({ label: col.label, amount: tx.amounts[col.id].debit });
    if (tx.amounts[col.id]?.credit > 0) credits.push({ label: col.label, amount: tx.amounts[col.id].credit });
  });
  return { debits, credits };
};

const getTotals = (tx: Transaction) => {
  let debit = 0, credit = 0;
  ACCOUNT_COLUMNS.forEach((col) => {
    debit += tx.amounts[col.id]?.debit || 0;
    credit += tx.amounts[col.id]?.credit || 0;
  });
  return { debit, credit };
};

/**
 * Replace text across split XML runs.
 * Word often splits text across multiple <w:t> tags, so we need to handle that.
 * This function does simple text replacement on the raw XML.
 */
function replaceInXml(xml: string, search: string, replace: string): string {
  // First try direct replacement
  if (xml.includes(search)) {
    return xml.replace(search, replace);
  }
  return xml;
}

/**
 * Clean dots/periods patterns commonly used as placeholders in Arabic documents
 */
function replaceDotPatterns(xml: string, replacements: Array<{ before: string; value: string }>): string {
  let result = xml;
  for (const { before, value } of replacements) {
    // Find the pattern: "label" followed by dots
    const dotPattern = new RegExp(
      `(${escapeRegex(before)}[^<]*?)(\\.{3,}|…+)`,
      "g"
    );
    result = result.replace(dotPattern, `$1${value}`);
  }
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadTemplate(templatePath: string): Promise<PizZip> {
  const response = await fetch(templatePath);
  const arrayBuffer = await response.arrayBuffer();
  return new PizZip(arrayBuffer);
}

function getXmlContent(zip: PizZip): string {
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("document.xml not found in template");
  return file.asText();
}

function saveXmlContent(zip: PizZip, xml: string): void {
  zip.file("word/document.xml", xml);
}

export async function fillJournalVoucher(tx: Transaction, schoolName: string) {
  const zip = await loadTemplate("/templates/سند_قيد.docx");
  let xml = getXmlContent(zip);

  const accounts = getAccountDetails(tx);
  const totals = getTotals(tx);
  const debitSplit = splitAmount(totals.debit);
  const creditSplit = splitAmount(totals.credit);
  const fromAccount = accounts.debits.map(d => d.label).join("، ");
  const toAccount = accounts.credits.map(c => c.label).join("، ");

  // Replace dots after المركز and المدرسة with school name
  xml = xml.replace(/(<w:t[^>]*>المركز\s*:\s*)(\.+|…+)/g, `$1${schoolName}`);
  xml = xml.replace(/(<w:t[^>]*>المدرسة\s*:\s*)(\.+|…+)/g, `$1${schoolName}`);
  
  // Handle dots in separate w:t tags (common in Word)
  // We do a two-pass: first collect context, then replace
  const dotTagRegex = /(<w:t[^>]*>)(\.{5,}|…{3,})(<\/w:t>)/g;
  let match: RegExpExecArray | null;
  const dotReplacements: Array<{ start: number; end: number; replacement: string }> = [];
  while ((match = dotTagRegex.exec(xml)) !== null) {
    const before = xml.substring(Math.max(0, match.index - 500), match.index);
    if (before.includes("المركز") || before.includes("المدرسة")) {
      dotReplacements.push({
        start: match.index,
        end: match.index + match[0].length,
        replacement: `${match[1]}${schoolName}${match[3]}`,
      });
    }
  }
  // Apply replacements in reverse to preserve offsets
  for (let i = dotReplacements.length - 1; i >= 0; i--) {
    const r = dotReplacements[i];
    xml = xml.substring(0, r.start) + r.replacement + xml.substring(r.end);
  }

  // Replace specific field-like text patterns
  // Date
  xml = xml.replace(
    /(<w:t[^>]*>)(التاريخ\s*:\s*)(<\/w:t>)/g,
    `$1$2 ${tx.date}$3`
  );
  // Also handle case where date placeholder is in same tag
  xml = xml.replace(
    /(<w:t[^>]*>)(التاريخ\s*:\s*)(\/\s*\/?\s*)(<\/w:t>)/g,
    `$1$2${tx.date}$4`
  );

  // Reference number
  xml = xml.replace(
    /(<w:t[^>]*>)(الرقم\s*:\s*\(\s*)(\))/g,
    `$1$2${tx.referenceNumber || ""}$3`
  );

  // From account / To account
  xml = xml.replace(
    /(<w:t[^>]*>)(من حساب\s*\/?\s*)(<\/w:t>)/g,
    `$1$2 ${fromAccount}$3`
  );
  xml = xml.replace(
    /(<w:t[^>]*>)(إلى حساب\s*\/?\s*)(<\/w:t>)/g,
    `$1$2 ${toAccount}$3`
  );
  // Also handle الى
  xml = xml.replace(
    /(<w:t[^>]*>)(الى حساب\s*\/?\s*)(<\/w:t>)/g,
    `$1$2 ${toAccount}$3`
  );

  // وذلك description
  xml = xml.replace(
    /(<w:t[^>]*>)(وذلك\s*:\s*)(<\/w:t>)/g,
    `$1$2 ${tx.description}$3`
  );

  saveXmlContent(zip, xml);
  const blob = zip.generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  saveAs(blob, `سند_قيد_${tx.referenceNumber || tx.id}.docx`);
}

export async function fillPaymentVoucher(tx: Transaction, schoolName: string) {
  const zip = await loadTemplate("/templates/مستند_صرف.docx");
  let xml = getXmlContent(zip);

  const accounts = getAccountDetails(tx);
  const totalCredit = getTotals(tx).credit;
  const totalSplit = splitAmount(totalCredit);

  // Determine "مطلوب إلى"
  let requestedTo = tx.description;
  if (tx.type === "advance_withdrawal") {
    requestedTo = "سلفة يد";
  } else if (tx.type === "advance_payment") {
    requestedTo = tx.description || "مجموعة فواتير";
  }

  // Replace school name
  xml = xml.replace(
    /(<w:t[^>]*>)(مدرسة\s*:\s*)(صما الثانوية الشاملة للبنين|[^<]*)(<\/w:t>)/g,
    `$1$2${schoolName}$4`
  );

  // Reference number  
  xml = xml.replace(
    /(<w:t[^>]*>)(رقم الصرف\s*:\s*\(\s*)(\))/g,
    `$1$2${tx.referenceNumber || ""}$3`
  );
  xml = xml.replace(
    /(<w:t[^>]*>)(الصرف\s*رقم\s*\(\s*)(\))/g,
    `$1$2${tx.referenceNumber || ""}$3`
  );

  // Date
  xml = xml.replace(
    /(<w:t[^>]*>)(التاريخ\s*:\s*)(\/\s*\/?\s*\/?\s*)(<\/w:t>)/g,
    `$1$2${tx.date}$4`
  );

  // مطلوب إلى
  xml = xml.replace(
    /(<w:t[^>]*>)(مطلوب إلى\s*:\s*)(\.+|…+|[^<]{0,3})(<\/w:t>)/g,
    `$1$2${requestedTo}$4`
  );
  xml = xml.replace(
    /(<w:t[^>]*>)(إلى\s*مطلوب\s*:\s*)(\.+|…+|[^<]{0,3})(<\/w:t>)/g,
    `$1$2${requestedTo}$4`
  );

  // Check number
  if (tx.checkNumber) {
    xml = xml.replace(
      /(<w:t[^>]*>)(التحويل\s*رقم[^<]*\(\s*)(\))/g,
      `$1$2${tx.checkNumber}$3`
    );
    xml = xml.replace(
      /(<w:t[^>]*>)(الشيك\s*\)\s*:\s*\(\s*)([^<]*)(<\/w:t>)/g,
      `$1$2${tx.checkNumber}$4`
    );
  }

  saveXmlContent(zip, xml);
  const blob = zip.generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  
  const typeLabel = tx.type === "advance_withdrawal" ? "سحب_سلفة" 
    : tx.type === "advance_payment" ? "صرف_سلفة" 
    : "مستند_صرف";
  saveAs(blob, `${typeLabel}_${tx.referenceNumber || tx.id}.docx`);
}
