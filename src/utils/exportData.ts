import type { Member, Payment } from "@/data/types";

interface ExportRow {
  Name: string;
  Phone: string;
  "Monthly Fee": number;
  Month: string;
  Date: string;
  Amount: number;
  Status: string;
}

function buildRows(members: Member[], payments: Payment[], from: string, to: string): ExportRow[] {
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const rows: ExportRow[] = [];

  for (const p of payments) {
    if (fromDate || toDate) {
      const match = p.date.match(
        /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/,
      );
      if (match) {
        const d = new Date(match[0]);
        if (fromDate && d < fromDate) continue;
        if (toDate && d > toDate) continue;
      }
    }

    const m = memberMap.get(p.member_id);
    if (!m) continue;

    rows.push({
      Name: m.name,
      Phone: m.phone ?? "",
      "Monthly Fee": Number(m.monthly_fee),
      Month: p.month,
      Date: p.date,
      Amount: Number(p.amount),
      Status: p.status.charAt(0).toUpperCase() + p.status.slice(1),
    });
  }

  return rows;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function getXLSX() {
  return import("xlsx");
}

export async function exportCSV(members: Member[], payments: Payment[], from: string, to: string) {
  const rows = buildRows(members, payments, from, to);
  if (rows.length === 0) return false;

  const XLSX = await getXLSX();
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "gym_payments.csv");
  return true;
}

export async function exportExcel(members: Member[], payments: Payment[], from: string, to: string) {
  const rows = buildRows(members, payments, from, to);
  if (rows.length === 0) return false;

  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 22 }, { wch: 16 }, { wch: 12 },
    { wch: 16 }, { wch: 26 }, { wch: 10 }, { wch: 10 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Payments");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "gym_payments.xlsx",
  );
  return true;
}
