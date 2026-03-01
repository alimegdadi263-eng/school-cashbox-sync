import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

const splitAmount = (n: number) => {
  const dinars = Math.floor(n);
  const fils = Math.round((n - dinars) * 1000);
  return { dinars: dinars > 0 ? String(dinars) : "", fils: fils > 0 ? String(fils) : "" };
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
  const xmlFiles = ["word/document.xml", "word/header1.xml", "word/header2.xml", "word/footer1.xml", "word/footer2.xml"];
  xmlFiles.forEach((f) => {
    const file = zip.file(f);
    if (!file) return;
    let content = file.asText();
    // Fix braces split by XML tags or whitespace
    content = content.replace(/\{(?:<[^>]*>|\s)*\{/g, "{{");
    content = content.replace(/\}(?:<[^>]*>|\s)*\}/g, "}}");
    // Also fix cases where }} has spaces: } } or }  }
    content = content.replace(/\}\s+\}/g, "}}");

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
        const singleClose = content.indexOf("}", openIdx + 2);
        if (singleClose !== -1) {
          const tagContent = content.slice(openIdx + 2, singleClose).replace(/<[^>]*>/g, "").trim();
          result += "{{" + tagContent + "}}";
          i = singleClose + 1;
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

export interface FinancialClaimData {
  school: string;
  amount: number;
  recipientName: string;
  checkNumber: string;
  description: string;
  directorName: string;
  member1Name: string;
  member2Name: string;
}

export async function fillFinancialClaim(data: FinancialClaimData) {
  const zip = await loadTemplate("/templates/financial-claim.docx");
  const doc = createDoc(zip);
  const split = splitAmount(data.amount);

  doc.render({
    school: data.school,
    amount_dinars: split.dinars,
    amount_fils: split.fils,
    recipient_name: data.recipientName,
    check_number: data.checkNumber,
    description: data.description,
    director_name: data.directorName,
    member1_name: data.member1Name,
    member2_name: data.member2Name,
  });

  const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  saveAs(blob, `مطالبة_مالية_${data.recipientName || "جديد"}.docx`);
}

export interface AssignmentDecisionData {
  school: string;
  day: string;
  date: string;
  subject: string;
  personName: string;
  description: string;
  directorName: string;
}

export async function fillAssignmentDecision(data: AssignmentDecisionData) {
  const zip = await loadTemplate("/templates/assignment-decision.docx");
  const doc = createDoc(zip);

  doc.render({
    school: data.school,
    day: data.day,
    date: data.date,
    subject: data.subject,
    person_name: data.personName,
    description: data.description,
    director_name: data.directorName,
  });

  const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  saveAs(blob, `قرار_تكليف_${data.personName || "جديد"}.docx`);
}

export interface PurchaseItem {
  itemNumber: number;
  itemDescription: string;
  quantity: string;
  unitPriceDinars: string;
  unitPriceFils: string;
  totalPriceDinars: string;
  totalPriceFils: string;
  chapterAndSubject: string;
  notes: string;
}

export interface LocalPurchaseData {
  school: string;
  supplierName: string;
  supplierAddress: string;
  items: PurchaseItem[];
}

export async function fillLocalPurchase(data: LocalPurchaseData) {
  const zip = await loadTemplate("/templates/local-purchase.docx");
  const doc = createDoc(zip);

  const items = data.items.map((item, idx) => ({
    item_no: idx + 1,
    item_desc: item.itemDescription,
    item_qty: item.quantity,
    unit_dinars: item.unitPriceDinars,
    unit_fils: item.unitPriceFils,
    total_dinars: item.totalPriceDinars,
    total_fils: item.totalPriceFils,
    chapter_subject: item.chapterAndSubject,
    notes_: item.notes,
  }));

  // Calculate grand totals
  let grandDinars = 0;
  let grandFils = 0;
  data.items.forEach((item) => {
    grandDinars += parseInt(item.totalPriceDinars) || 0;
    grandFils += parseInt(item.totalPriceFils) || 0;
  });
  grandDinars += Math.floor(grandFils / 1000);
  grandFils = grandFils % 1000;

  doc.render({
    school: data.school,
    supplier_name: data.supplierName,
    supplier_address: data.supplierAddress,
    items: items,
    grand_total: grandDinars > 0 ? String(grandDinars) : "",
    total_fils_: grandFils > 0 ? String(grandFils) : "",
  });

  const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  saveAs(blob, `طلب_مشترى_محلي_${data.supplierName || "جديد"}.docx`);
}
