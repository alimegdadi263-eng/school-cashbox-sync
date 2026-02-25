import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
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

async function loadTemplate(templatePath: string): Promise<PizZip> {
  const response = await fetch(templatePath);
  const arrayBuffer = await response.arrayBuffer();
  return new PizZip(arrayBuffer);
}

function createDoc(zip: PizZip): Docxtemplater {
  return new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter() {
      return "";
    },
  });
}

export async function fillJournalVoucher(tx: Transaction, schoolName: string, directorateName: string) {
  const zip = await loadTemplate("/templates/سند_قيد.docx");
  const doc = createDoc(zip);

  const accounts = getAccountDetails(tx);
  const totals = getTotals(tx);
  const debitSplit = splitAmount(totals.debit);
  const creditSplit = splitAmount(totals.credit);
  const fromAccount = accounts.debits.map(d => d.label).join("، ");
  const toAccount = accounts.credits.map(c => c.label).join("، ");

  // Determine subject from affected accounts
  const allAccounts = [...accounts.debits, ...accounts.credits];
  const subject = allAccounts.length > 0 ? allAccounts[0].label : "";

  doc.render({
    school: schoolName,
    directorate: directorateName,
    ref: tx.referenceNumber || "",
    date: tx.date,
    subject: subject,
    from_account: fromAccount,
    to_account: toAccount,
    description: tx.description,
    debit_dinar: debitSplit.dinars,
    debit_fil: debitSplit.fils,
    credit_dinar: creditSplit.dinars,
    credit_fil: creditSplit.fils,
    s: "",
  });

  const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  saveAs(blob, `سند_قيد_${tx.referenceNumber || tx.id}.docx`);
}

export async function fillPaymentVoucher(tx: Transaction, schoolName: string, directorateName: string) {
  const zip = await loadTemplate("/templates/مستند_صرف.docx");
  const doc = createDoc(zip);

  const accounts = getAccountDetails(tx);
  const totalCredit = getTotals(tx).credit;
  const totalSplit = splitAmount(totalCredit);

  // Determine subject
  const allAccounts = [...accounts.debits, ...accounts.credits];
  const subject = allAccounts.length > 0 ? allAccounts[0].label : "";

  // Determine "مطلوب إلى"
  let requestedTo = tx.description;
  if (tx.type === "advance_withdrawal") {
    requestedTo = "سلفة يد";
  } else if (tx.type === "advance_payment") {
    requestedTo = tx.description || "مجموعة فواتير";
  }

  doc.render({
    school: schoolName,
    subject: subject,
    ref: tx.referenceNumber || "",
    date: tx.date,
    requested_to: requestedTo,
    description: tx.description,
    amount_dinars: totalSplit.dinars,
    amount_fils: totalSplit.fils,
    check_number: tx.checkNumber || "",
  });

  const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

  const typeLabel = tx.type === "advance_withdrawal" ? "سحب_سلفة"
    : tx.type === "advance_payment" ? "صرف_سلفة"
    : "مستند_صرف";
  saveAs(blob, `${typeLabel}_${tx.referenceNumber || tx.id}.docx`);
}
