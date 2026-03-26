import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { btnPrimary, btnSecondary } from "@/lib/buttonStyles";
import { supabase } from "@/lib/supabase";
import { exportCSV, exportExcel } from "@/utils/exportData";

export default function ExportDataPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exportMsg, setExportMsg] = useState("");
  const [exporting, setExporting] = useState(false);

  async function handleExport(type: "csv" | "excel") {
    setExporting(true);

    const { data: members } = await supabase.from("members").select("*");
    const { data: payments } = await supabase.from("payments").select("*");

    if (!members || !payments) {
      setExportMsg("Failed to fetch data.");
      setTimeout(() => setExportMsg(""), 3000);
      setExporting(false);
      return;
    }

    const fn = type === "csv" ? exportCSV : exportExcel;
    const ok = await fn(members, payments, from, to);
    if (!ok) {
      setExportMsg("No payment data found for the selected time frame.");
      setTimeout(() => setExportMsg(""), 3000);
    }
    setExporting(false);
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <PageHeader title="Export Data" showBack />

      <div className="lg:mx-auto lg:w-full lg:max-w-lg lg:py-6">
        <div className="flex flex-col items-center px-5 pt-10">
          <div className="flex h-16 w-16 items-center justify-center bg-ink/5 text-ink">
            <span className="material-symbols-outlined text-3xl">download</span>
          </div>
        </div>

        <div className="px-5 pt-5 text-center">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">Export Payment Data</h2>
          <p className="mt-2 text-sm text-ink-secondary">Download all member payment records as CSV or Excel.</p>
        </div>

        <div className="mx-auto mt-8 w-full max-w-md px-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">Time Frame</p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">From</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-border bg-surface px-3 text-base text-ink focus:border-ink focus:ring-0" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">To</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-border bg-surface px-3 text-base text-ink focus:border-ink focus:ring-0" />
            </label>
          </div>

          <p className="mt-2 text-[10px] text-ink-muted">Leave empty to export all available data.</p>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className={`${btnSecondary} w-full`}
            >
              <span className="material-symbols-outlined text-lg">csv</span>
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport("excel")}
              disabled={exporting}
              className={`${btnPrimary} w-full`}
            >
              <span className="material-symbols-outlined text-lg">table_view</span>
              Download Excel
            </button>
          </div>

          {exportMsg && (
            <p className="mt-4 border-l-2 border-accent-warning bg-accent-warning/5 px-3 py-2 text-xs font-medium text-accent-warning">
              {exportMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
