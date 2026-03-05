import pptxgen from "pptxgenjs";

interface Slide {
  title: string;
  subtitle?: string;
  content: string[];
  color: string;
}

// Map tailwind gradient classes to hex colors
const colorMap: Record<string, { bg1: string; bg2: string }> = {
  "from-blue-600 to-indigo-700": { bg1: "2563EB", bg2: "4338CA" },
  "from-emerald-600 to-teal-700": { bg1: "059669", bg2: "0F766E" },
  "from-green-600 to-emerald-700": { bg1: "16A34A", bg2: "047857" },
  "from-red-600 to-rose-700": { bg1: "DC2626", bg2: "BE123C" },
  "from-orange-600 to-amber-700": { bg1: "EA580C", bg2: "B45309" },
  "from-purple-600 to-violet-700": { bg1: "9333EA", bg2: "6D28D9" },
  "from-cyan-600 to-sky-700": { bg1: "0891B2", bg2: "0369A1" },
  "from-pink-600 to-fuchsia-700": { bg1: "DB2777", bg2: "A21CAF" },
  "from-amber-600 to-yellow-700": { bg1: "D97706", bg2: "A16207" },
  "from-indigo-600 to-blue-700": { bg1: "4F46E5", bg2: "1D4ED8" },
  "from-rose-600 to-red-700": { bg1: "E11D48", bg2: "B91C1C" },
  "from-slate-700 to-gray-900": { bg1: "334155", bg2: "111827" },
};

export function exportPPTX(slides: Slide[]) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches
  pptx.author = "الأستاذ علي مقدادي";
  pptx.title = "نظام مالية المدارس";
  pptx.subject = "شرح الحركات والمعاملات المالية";

  slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    const colors = colorMap[s.color] || { bg1: "1E293B", bg2: "0F172A" };

    slide.background = { color: colors.bg1 };

    // Slide number
    slide.addText(`${i + 1} / ${slides.length}`, {
      x: 0.3, y: 0.2, w: 1.5, h: 0.3,
      fontSize: 10, color: "FFFFFF", transparency: 50,
      fontFace: "Arial",
    });

    // Title
    slide.addText(s.title, {
      x: 0.5, y: 1.0, w: 12.3, h: 0.8,
      fontSize: 36, bold: true, color: "FFFFFF",
      align: "center", fontFace: "Traditional Arabic",
      rtlMode: true,
    });

    // Subtitle
    if (s.subtitle) {
      slide.addText(s.subtitle, {
        x: 0.5, y: 1.8, w: 12.3, h: 0.5,
        fontSize: 20, color: "FFFFFF", transparency: 20,
        align: "center", fontFace: "Traditional Arabic",
        rtlMode: true,
      });
    }

    // Content
    const startY = s.subtitle ? 2.6 : 2.2;
    const contentText = s.content.map((line) => ({
      text: line,
      options: {
        fontSize: 18,
        color: "FFFFFF" as const,
        fontFace: "Traditional Arabic",
        breakType: "none" as const,
        bullet: false,
        rtlMode: true,
        paraSpaceAfter: 8,
      },
    }));

    slide.addText(
      contentText.map((ct) => ({ text: ct.text + "\n", options: ct.options })),
      {
        x: 1.5, y: startY, w: 10.3, h: 4.5,
        valign: "top",
        rtlMode: true,
      }
    );

    // Footer on first/last
    if (i === 0 || i === slides.length - 1) {
      slide.addText("نظام مالية المدارس - الأستاذ علي مقدادي", {
        x: 2, y: 6.9, w: 9.3, h: 0.4,
        fontSize: 10, color: "FFFFFF", transparency: 60,
        align: "center", fontFace: "Traditional Arabic",
        rtlMode: true,
      });
    }
  });

  pptx.writeFile({ fileName: "عرض-مالية-المدارس-علي-مقدادي.pptx" });
}

export function exportPDF(slides: Slide[]) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const slidesHtml = slides
    .map(
      (slide, i) => {
        const colors = colorMap[slide.color] || { bg1: "1e293b", bg2: "0f172a" };
        return `
      <div style="page-break-after: always; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 60px; font-family: 'Traditional Arabic', Arial, sans-serif; direction: rtl; background: linear-gradient(135deg, #${colors.bg1}, #${colors.bg2}); color: white; position: relative;">
        <div style="position: absolute; top: 30px; left: 30px; font-size: 14px; opacity: 0.5;">${i + 1} / ${slides.length}</div>
        <h1 style="font-size: 42px; font-weight: bold; margin-bottom: 12px; text-align: center;">${slide.title}</h1>
        ${slide.subtitle ? `<h2 style="font-size: 22px; opacity: 0.8; margin-bottom: 40px; text-align: center;">${slide.subtitle}</h2>` : ""}
        <div style="max-width: 800px; width: 100%;">
          ${slide.content.map((line) => `<p style="font-size: 20px; line-height: 2; margin: 8px 0; padding-right: 10px;">${line}</p>`).join("")}
        </div>
        ${i === 0 || i === slides.length - 1 ? '<div style="position: absolute; bottom: 30px; font-size: 12px; opacity: 0.4;">نظام مالية المدارس - الأستاذ علي مقدادي</div>' : ""}
      </div>`;
      }
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <title>عرض تقديمي - مالية المدارس - الأستاذ علي مقدادي</title>
      <style>
        @page { size: landscape; margin: 0; }
        body { margin: 0; padding: 0; }
        @media print { div { page-break-after: always; } }
      </style>
    </head>
    <body>${slidesHtml}</body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}
