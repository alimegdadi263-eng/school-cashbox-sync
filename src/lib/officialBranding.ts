import ExcelJS from "exceljs";
import { AlignmentType, ImageRun, Paragraph } from "docx";
import { MINISTRY_EMBLEM_BASE64 } from "@/lib/ministryEmblem";

let cachedLogo: Uint8Array | null = null;

export function getOfficialLogoBytes(): Uint8Array {
  if (cachedLogo) return cachedLogo;
  const binary = atob(MINISTRY_EMBLEM_BASE64);
  cachedLogo = Uint8Array.from(binary, char => char.charCodeAt(0));
  return cachedLogo;
}

export function officialLogoParagraph(size = 78, after = 50): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after },
    children: [new ImageRun({
      data: getOfficialLogoBytes(),
      type: "png",
      transformation: { width: size, height: size },
      altText: {
        title: "شعار المملكة الأردنية الهاشمية",
        description: "الشعار الرسمي",
        name: "الشعار الرسمي",
      },
    })],
  });
}

export function addOfficialLogoToExcel(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  col: number,
  row = 0,
  size = 78,
) {
  const imageId = wb.addImage({ base64: MINISTRY_EMBLEM_BASE64, extension: "png" });
  ws.addImage(imageId, {
    tl: { col, row } as never,
    ext: { width: size, height: size },
    editAs: "oneCell",
  });
}