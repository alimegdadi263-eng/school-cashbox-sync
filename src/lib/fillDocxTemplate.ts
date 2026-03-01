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
  if (!response.ok) {
    throw new Error(`تعذر تحميل القالب: ${templatePath}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new PizZip(arrayBuffer);
}

function fixBrokenTags(zip: PizZip): PizZip {
  // Fix broken {{}} tags split across XML runs by Word
  const xmlFiles = ["word/document.xml", "word/header1.xml", "word/header2.xml", "word/footer1.xml", "word/footer2.xml"];
  xmlFiles.forEach((f) => {
    const file = zip.file(f);
    if (!file) return;
    let content = file.asText();

    // Step 1: Remove XML tags between {{ and }} that Word inserts
    // This handles cases like: {{<w:r><w:t>member1_name</w:t></w:r>}}
    // First, find all {{ ... }} regions and clean XML from inside them
    content = content.replace(/\{(?:<[^>]*>)*\{/g, "{{");
    content = content.replace(/\}(?:<[^>]*>)*\}/g, "}}");

    // Step 2: Clean XML tags from inside {{ }} after merging braces
    let result = "";
    let i = 0;
    while (i < content.length) {
      const openIdx = content.indexOf("{{", i);
      if (openIdx === -1) {
        result += content.slice(i);
        break;
      }
      result += content.slice(i, openIdx);
      const closeIdx = content.indexOf("}}", openIdx);
      if (closeIdx === -1) {
        // No closing found - look for single } and fix it
        const singleClose = content.indexOf("}", openIdx + 2);
        if (singleClose !== -1) {
          const tagContent = content.slice(openIdx + 2, singleClose).replace(/<[^>]*>/g, "").trim();
          result += "{{" + tagContent + "}}";
          i = singleClose + 1;
          // Skip extra } if present
          if (content[i] === "}") i++;
        } else {
          result += content.slice(openIdx);
          break;
        }
      } else {
        const tagContent = content.slice(openIdx + 2, closeIdx).replace(/<[^>]*>/g, "").trim();
        result += "{{" + tagContent + "}}";
        i = closeIdx + 2;
      }
    }

    zip.file(f, result);
  });
  return zip;
}

function createDoc(zip: PizZip): Docxtemplater {
  fixBrokenTags(zip);
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
  const zip = await loadTemplate(new URL("/templates/journal-voucher.docx", import.meta.url).href);
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

export async function fillPaymentVoucher(tx: Transaction, schoolName: string, directorateName: string, directorName?: string, member1Name?: string, member2Name?: string) {
  const zip = await loadTemplate(new URL("/templates/payment-voucher.docx", import.meta.url).href);
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
    director_name: directorName || "",
    member1_name: member1Name || "",
    member2_name: member2Name || "",
  });

  const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

  const typeLabel = tx.type === "advance_withdrawal" ? "سحب_سلفة"
    : tx.type === "advance_payment" ? "صرف_سلفة"
    : "مستند_صرف";
  saveAs(blob, `${typeLabel}_${tx.referenceNumber || tx.id}.docx`);
}
