import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/context/AuthContext";

export default function ApiConfigPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <PageHeader title="Payment Configuration" showBack />

      <div className="lg:mx-auto lg:w-full lg:max-w-lg lg:py-6">
        <div className="flex flex-col items-center px-5 pt-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-3xl">shield_lock</span>
          </div>
        </div>

        <div className="px-5 pt-5 text-center">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">Payment Info</h2>
          <p className="mt-2 text-sm text-ink-secondary">Your organisation's payment details.</p>
        </div>

        <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-4 px-5">
          <div className="list-card">
            <div className="divide-y divide-border">
              <div className="flex items-start justify-between gap-4 px-5 py-4">
                <p className="shrink-0 text-xs font-bold uppercase tracking-wider text-ink-muted">UPI ID</p>
                <p className="min-w-0 flex-1 break-words text-right text-sm font-medium text-ink">
                  {user?.organisation?.upi_id ?? "Not set"}
                </p>
              </div>
              <div className="flex items-start justify-between gap-4 px-5 py-4">
                <p className="shrink-0 text-xs font-bold uppercase tracking-wider text-ink-muted">UPI Number</p>
                <p className="min-w-0 flex-1 break-words text-right text-sm font-medium text-ink">
                  {user?.organisation?.upi_number ?? "Not set"}
                </p>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-ink-muted">
            Contact your admin to update payment details.
          </p>
        </div>
      </div>
    </div>
  );
}
