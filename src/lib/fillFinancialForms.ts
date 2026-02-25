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

export interface FinancialClaimData {
  school: string;
  amount: number;
  recipientName: string;
  checkNumber: string;
  description: string;
}

export async function fillFinancialClaim(data: FinancialClaimData) {
  const zip = await loadTemplate("/templates/مطالبة_مالية.docx");
  const doc = createDoc(zip);
  const split = splitAmount(data.amount);

  doc.render({
    school: data.school,
    amount_dinars: split.dinars,
    amount_fils: split.fils,
    recipient_name: data.recipientName,
    check_number: data.checkNumber,
    description: data.description,
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
}

export async function fillAssignmentDecision(data: AssignmentDecisionData) {
  const zip = await loadTemplate("/templates/قرار_تكليف.docx");
  const doc = createDoc(zip);

  doc.render({
    school: data.school,
    day: data.day,
    date: data.date,
    subject: data.subject,
    person_name: data.personName,
    description: data.description,
  });

  const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  saveAs(blob, `قرار_تكليف_${data.personName || "جديد"}.docx`);
}

export interface LocalPurchaseData {
  school: string;
  supplierName: string;
  supplierAddress: string;
}

export async function fillLocalPurchase(data: LocalPurchaseData) {
  const zip = await loadTemplate("/templates/طلب_مشترى_محلي.docx");
  const doc = createDoc(zip);

  doc.render({
    school: data.school,
    supplier_name: data.supplierName,
    supplier_address: data.supplierAddress,
  });

  const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  saveAs(blob, `طلب_مشترى_محلي_${data.supplierName || "جديد"}.docx`);
}
