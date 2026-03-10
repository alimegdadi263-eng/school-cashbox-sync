import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

function fixBrokenTags(zip: PizZip): PizZip {
  const xmlFiles = ["word/document.xml", "word/header1.xml", "word/header2.xml", "word/footer1.xml", "word/footer2.xml"];
  xmlFiles.forEach((f) => {
    const file = zip.file(f);
    if (!file) return;
    let content = file.asText();
    content = content.replace(/\{(?:<[^>]*>)*\{/g, "{{");
    content = content.replace(/\}(?:<[^>]*>)*\}/g, "}}");
    let result = "";
    let i = 0;
    while (i < content.length) {
      const openIdx = content.indexOf("{{", i);
      if (openIdx === -1) { result += content.slice(i); break; }
      result += content.slice(i, openIdx);
      const closeIdx = content.indexOf("}}", openIdx);
      if (closeIdx === -1) { result += content.slice(openIdx); break; }
      const tagContent = content.slice(openIdx + 2, closeIdx).replace(/<[^>]*>/g, "").trim();
      result += "{{" + tagContent + "}}";
      i = closeIdx + 2;
    }
    zip.file(f, result);
  });
  return zip;
}

async function loadTemplate(path: string): Promise<PizZip> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`تعذر تحميل القالب: ${path}`);
  const arrayBuffer = await response.arrayBuffer();
  return new PizZip(arrayBuffer);
}

function createDoc(zip: PizZip): Docxtemplater {
  fixBrokenTags(zip);
  return new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter() { return ""; },
  });
}

export interface InterrogationData {
  school: string;
  employeeName: string;
  date: string;
  subject: string;
  details: string;
  directorName: string;
}

export async function fillInterrogationForm(data: InterrogationData) {
  const zip = await loadTemplate(`${import.meta.env.BASE_URL}templates/interrogation.doc`);
  const doc = createDoc(zip);
  doc.render({
    school: data.school,
    employee_name: data.employeeName,
    date: data.date,
    subject: data.subject,
    details: data.details,
    director_name: data.directorName,
  });
  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  saveAs(blob, `استجواب_${data.employeeName}.docx`);
}

export interface CasualLeaveData {
  school: string;
  employeeName: string;
  date: string;
  reason: string;
  directorName: string;
}

export async function fillCasualLeaveForm(data: CasualLeaveData) {
  const zip = await loadTemplate(`${import.meta.env.BASE_URL}templates/casual-leave.docx`);
  const doc = createDoc(zip);
  doc.render({
    school: data.school,
    employee_name: data.employeeName,
    date: data.date,
    reason: data.reason,
    director_name: data.directorName,
  });
  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  saveAs(blob, `إجازة_عرضية_${data.employeeName}.docx`);
}

export interface NoPaymentData {
  school: string;
  employeeName: string;
  date: string;
  reason: string;
  amount: string;
  directorName: string;
}

export async function fillNoPaymentForm(data: NoPaymentData) {
  const zip = await loadTemplate(`${import.meta.env.BASE_URL}templates/no-payment.docx`);
  const doc = createDoc(zip);
  doc.render({
    school: data.school,
    employee_name: data.employeeName,
    date: data.date,
    reason: data.reason,
    amount: data.amount,
    director_name: data.directorName,
  });
  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  saveAs(blob, `عدم_صرف_${data.employeeName}.docx`);
}
