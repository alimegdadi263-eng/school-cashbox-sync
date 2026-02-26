import { useRef } from "react";
import { Transaction, TRANSACTION_TYPE_LABELS, ACCOUNT_COLUMNS } from "@/types/finance";
import { fillJournalVoucher, fillPaymentVoucher } from "@/lib/fillDocxTemplate";
import { Download } from "lucide-react";

interface PrintVoucherProps {
  transaction: Transaction;
  schoolName: string;
  directorateName: string;
  directorName?: string;
  member1Name?: string;
  member2Name?: string;
  onClose: () => void;
}

const splitAmount = (n: number) => {
  const dinars = Math.floor(n);
  const fils = Math.round((n - dinars) * 1000);
  return { dinars: dinars || "-", fils: fils || "-" };
};

const getTotals = (tx: Transaction) => {
  let debit = 0, credit = 0;
  ACCOUNT_COLUMNS.forEach((col) => {
    debit += tx.amounts[col.id]?.debit || 0;
    credit += tx.amounts[col.id]?.credit || 0;
  });
  return { debit, credit };
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

export default function PrintVoucher({ transaction: tx, schoolName, directorateName, directorName = "", member1Name = "", member2Name = "", onClose }: PrintVoucherProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
      <head>
        <title>${TRANSACTION_TYPE_LABELS[tx.type]} - ${tx.referenceNumber}</title>
        <style>
          @media print { @page { size: A4; margin: 15mm; } }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Traditional Arabic', 'Arial', sans-serif; direction: rtl; padding: 20px; color: #000; }
          .voucher { border: 2px solid #000; padding: 20px; max-width: 700px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .header h1 { font-size: 22px; font-weight: bold; margin-bottom: 5px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #000; padding: 8px 10px; text-align: center; font-size: 13px; }
          th { background: #f0f0f0; font-weight: bold; }
          .total-row { background: #e8e8e8; font-weight: bold; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 15px; border-top: 1px solid #ccc; }
          .sig-block { text-align: center; min-width: 120px; }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const totals = getTotals(tx);
  const accounts = getAccountDetails(tx);
  const isReceipt = tx.type === "receipt";
  const isPayment = tx.type === "payment" || tx.type === "advance_withdrawal" || tx.type === "advance_payment";
  const isJournal = tx.type === "journal";

  const allAccounts = [...accounts.debits, ...accounts.credits];
  const subject = allAccounts.length > 0 ? allAccounts[0].label : "";

  let requestedTo = tx.description;
  if (tx.type === "advance_withdrawal") requestedTo = "سلفة يد";
  else if (tx.type === "advance_payment") requestedTo = tx.description || "مجموعة فواتير";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/50 sticky top-0">
          <h3 className="font-bold text-foreground">معاينة {TRANSACTION_TYPE_LABELS[tx.type]}</h3>
          <div className="flex gap-2">
            {(isJournal || isPayment) && (
              <button
                onClick={() => {
                  if (isJournal) fillJournalVoucher(tx, schoolName, directorateName);
                  else fillPaymentVoucher(tx, schoolName, directorateName, directorName, member1Name, member2Name);
                }}
                className="px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-medium hover:bg-accent/90 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                تنزيل وورد
              </button>
            )}
            <button onClick={handlePrint} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
              طباعة
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm hover:bg-muted/80">
              إغلاق
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div ref={printRef} className="p-6">
          <div style={{ border: "2px solid #000", padding: "20px", maxWidth: "700px", margin: "0 auto", fontFamily: "'Traditional Arabic', Arial, sans-serif", direction: "rtl", color: "#000" }}>
            
            {/* === سند قيد (Journal) === */}
            {isJournal && (
              <>
                <div style={{ textAlign: "center", marginBottom: "15px", borderBottom: "2px solid #000", paddingBottom: "10px" }}>
                  <p style={{ fontSize: "13px", marginBottom: "3px" }}>مديرية التربية والتعليم</p>
                  <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "8px 0" }}>سند قيد</h1>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "14px", flexWrap: "wrap", gap: "8px" }}>
                  <div><span style={{ fontWeight: "bold" }}>المادة: </span>{subject}</div>
                  <div><span style={{ fontWeight: "bold" }}>الرقم: </span>{tx.referenceNumber || "............"}</div>
                  <div><span style={{ fontWeight: "bold" }}>التاريخ: </span>{tx.date}</div>
                  <div><span style={{ fontWeight: "bold" }}>المدرسة: </span>{schoolName}</div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", margin: "15px 0" }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #000", padding: "8px", background: "#f0f0f0", textAlign: "right", minWidth: "200px" }}>البيـــــــــــــان</th>
                      <th style={{ border: "1px solid #000", padding: "8px", background: "#f0f0f0" }} colSpan={2}>منه</th>
                      <th style={{ border: "1px solid #000", padding: "8px", background: "#f0f0f0" }} colSpan={2}>له</th>
                    </tr>
                    <tr>
                      <th style={{ border: "1px solid #000", padding: "6px", background: "#f5f5f5" }}></th>
                      <th style={{ border: "1px solid #000", padding: "6px", background: "#f5f5f5", fontSize: "12px" }}>دينار</th>
                      <th style={{ border: "1px solid #000", padding: "6px", background: "#f5f5f5", fontSize: "12px" }}>فلس</th>
                      <th style={{ border: "1px solid #000", padding: "6px", background: "#f5f5f5", fontSize: "12px" }}>دينار</th>
                      <th style={{ border: "1px solid #000", padding: "6px", background: "#f5f5f5", fontSize: "12px" }}>فلس</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #000", padding: "8px", textAlign: "right" }}>
                        {accounts.debits.map((d, i) => <span key={i}>من حساب/ {d.label}<br /></span>)}
                        {accounts.credits.map((c, i) => <span key={i}>إلى حساب/ {c.label}<br /></span>)}
                        <br />
                        وذلك: {tx.description}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{splitAmount(totals.debit).dinars}</td>
                      <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{splitAmount(totals.debit).fils}</td>
                      <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{splitAmount(totals.credit).dinars}</td>
                      <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{splitAmount(totals.credit).fils}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: "flex", justifyContent: "center", marginTop: "40px", paddingTop: "15px" }}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "5px" }}>مدير المدرسة</p>
                    <p style={{ fontSize: "12px" }}>{directorName || "................"}</p>
                    <p style={{ fontSize: "12px", marginTop: "25px" }}>التوقيع: ................</p>
                  </div>
                </div>
              </>
            )}

            {/* === مستند صرف (Payment) === */}
            {isPayment && (
              <>
                <div style={{ textAlign: "center", marginBottom: "15px", borderBottom: "2px solid #000", paddingBottom: "10px" }}>
                  <p style={{ fontSize: "13px", marginBottom: "3px" }}>مديرية التربية والتعليم</p>
                  <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "8px 0" }}>مستند صرف</h1>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "14px", flexWrap: "wrap", gap: "8px" }}>
                  <div><span style={{ fontWeight: "bold" }}>المادة: </span>{subject}</div>
                  <div><span style={{ fontWeight: "bold" }}>رقم الصرف: </span>{tx.referenceNumber || "............"}</div>
                  <div><span style={{ fontWeight: "bold" }}>التاريخ: </span>{tx.date}</div>
                  <div><span style={{ fontWeight: "bold" }}>مدرسة: </span>{schoolName}</div>
                </div>
                <p style={{ fontSize: "14px", marginBottom: "10px" }}>
                  <span style={{ fontWeight: "bold" }}>مطلوب إلى: </span>
                  <span style={{ borderBottom: "1px dotted #000", display: "inline-block", minWidth: "200px" }}>{requestedTo}</span>
                </p>

                <table style={{ width: "100%", borderCollapse: "collapse", margin: "15px 0" }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #000", padding: "8px", background: "#f0f0f0" }}>تاريخ</th>
                      <th style={{ border: "1px solid #000", padding: "8px", background: "#f0f0f0" }}>رقم الفاتورة</th>
                      <th style={{ border: "1px solid #000", padding: "8px", background: "#f0f0f0" }}>قيمة دينار</th>
                      <th style={{ border: "1px solid #000", padding: "8px", background: "#f0f0f0" }}>فلس</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #000", padding: "8px" }}>{tx.date}</td>
                      <td style={{ border: "1px solid #000", padding: "8px" }}>{tx.referenceNumber}</td>
                      <td style={{ border: "1px solid #000", padding: "8px" }}>{splitAmount(totals.credit).dinars}</td>
                      <td style={{ border: "1px solid #000", padding: "8px" }}>{splitAmount(totals.credit).fils}</td>
                    </tr>
                  </tbody>
                </table>

                <p style={{ fontSize: "13px", margin: "10px 0" }}>
                  <span style={{ fontWeight: "bold" }}>البيان: </span>{tx.description}
                </p>

                <div style={{ fontSize: "14px", fontWeight: "bold", margin: "15px 0", textAlign: "center" }}>
                  المجموع: {splitAmount(totals.credit).dinars} دينار و {splitAmount(totals.credit).fils} فلس
                </div>

                <p style={{ fontSize: "12px", margin: "10px 0" }}>
                  وأشهد على صحة البيان المذكور وأصادق على التعليمات للنظام وفقا لما تم الاتفاق عليه.
                </p>

                {/* التوقيعات - 3 أعضاء */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px", paddingTop: "15px", borderTop: "1px solid #ccc" }}>
                  <div style={{ textAlign: "center", minWidth: "120px" }}>
                    <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "5px" }}>مدير المدرسة</p>
                    <p style={{ fontSize: "12px" }}>{directorName || "................"}</p>
                    <p style={{ fontSize: "12px", marginTop: "25px" }}>التوقيع: ................</p>
                    <p style={{ fontSize: "12px" }}>التاريخ: ................</p>
                  </div>
                  <div style={{ textAlign: "center", minWidth: "120px" }}>
                    <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "5px" }}>عضو لجنة التبرعات</p>
                    <p style={{ fontSize: "12px" }}>{member1Name || "................"}</p>
                    <p style={{ fontSize: "12px", marginTop: "25px" }}>التوقيع: ................</p>
                    <p style={{ fontSize: "12px" }}>التاريخ: ................</p>
                  </div>
                  <div style={{ textAlign: "center", minWidth: "120px" }}>
                    <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "5px" }}>عضو لجنة التبرعات</p>
                    <p style={{ fontSize: "12px" }}>{member2Name || "................"}</p>
                    <p style={{ fontSize: "12px", marginTop: "25px" }}>التوقيع: ................</p>
                    <p style={{ fontSize: "12px" }}>التاريخ: ................</p>
                  </div>
                </div>

                {/* الدفع نقداً */}
                <div style={{ marginTop: "20px", fontSize: "13px", borderTop: "1px solid #ccc", paddingTop: "10px" }}>
                  <p>رقم الشيك: {tx.checkNumber || "........................"}</p>
                  <p style={{ marginTop: "5px" }}>اسم المستلم: ........................</p>
                  <p style={{ marginTop: "5px" }}>التوقيع: ........................</p>
                </div>
              </>
            )}

            {/* === سند قبض (Receipt) === */}
            {isReceipt && (
              <>
                <div style={{ textAlign: "center", marginBottom: "15px", borderBottom: "2px solid #000", paddingBottom: "10px" }}>
                  <p style={{ fontSize: "13px", marginBottom: "3px" }}>مديرية التربية والتعليم</p>
                  <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "8px 0" }}>سند قبض</h1>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "14px", flexWrap: "wrap", gap: "8px" }}>
                  <div><span style={{ fontWeight: "bold" }}>الرقم: </span>{tx.referenceNumber || "............"}</div>
                  <div><span style={{ fontWeight: "bold" }}>التاريخ: </span>{tx.date}</div>
                  <div><span style={{ fontWeight: "bold" }}>المدرسة: </span>{schoolName}</div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", margin: "15px 0" }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #000", padding: "8px", background: "#f0f0f0", textAlign: "right", minWidth: "200px" }}>البيـــــــــــــان</th>
                      <th style={{ border: "1px solid #000", padding: "8px", background: "#f0f0f0" }} colSpan={2}>منه (مدين)</th>
                      <th style={{ border: "1px solid #000", padding: "8px", background: "#f0f0f0" }} colSpan={2}>له (دائن)</th>
                    </tr>
                    <tr>
                      <th style={{ border: "1px solid #000", padding: "6px", background: "#f5f5f5" }}></th>
                      <th style={{ border: "1px solid #000", padding: "6px", background: "#f5f5f5", fontSize: "12px" }}>دينار</th>
                      <th style={{ border: "1px solid #000", padding: "6px", background: "#f5f5f5", fontSize: "12px" }}>فلس</th>
                      <th style={{ border: "1px solid #000", padding: "6px", background: "#f5f5f5", fontSize: "12px" }}>دينار</th>
                      <th style={{ border: "1px solid #000", padding: "6px", background: "#f5f5f5", fontSize: "12px" }}>فلس</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #000", padding: "8px", textAlign: "right" }}>
                        {tx.description}
                        <br /><br />
                        {accounts.debits.map((d, i) => <span key={i}>من حساب/ {d.label}<br /></span>)}
                        {accounts.credits.map((c, i) => <span key={i}>إلى حساب/ {c.label}<br /></span>)}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{splitAmount(totals.debit).dinars}</td>
                      <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{splitAmount(totals.debit).fils}</td>
                      <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{splitAmount(totals.credit).dinars}</td>
                      <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{splitAmount(totals.credit).fils}</td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ fontSize: "13px", margin: "10px 0" }}>وذلك: {tx.description}</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", paddingTop: "15px", borderTop: "1px solid #ccc" }}>
                  <div style={{ textAlign: "center", minWidth: "150px" }}>
                    <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "5px" }}>مدير المدرسة</p>
                    <p style={{ fontSize: "12px" }}>{directorName || "................"}</p>
                    <p style={{ fontSize: "12px", marginTop: "25px" }}>التوقيع: ................</p>
                  </div>
                  <div style={{ textAlign: "center", minWidth: "150px" }}>
                    <p style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "5px" }}>المحاسب</p>
                    <p style={{ fontSize: "12px", marginTop: "25px" }}>التوقيع: ................</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
