import GympayLogo from "@/components/branding/GympayLogo";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/layout/PageHeader";

export default function AccountPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <PageHeader title="Account" showBack />

      <div className="lg:mx-auto lg:w-full lg:max-w-lg lg:py-6">
        <div className="flex flex-col items-center px-5 pt-10">
          <GympayLogo size="lg" wordmark />
        </div>

        <div className="px-5 pt-5 text-center">
          <h2 className="break-words text-xl font-extrabold tracking-tight text-ink">
            {user?.organisation?.name ?? "My Organisation"}
          </h2>
          <p className="mt-1 break-words text-sm text-ink-secondary">{user?.email ?? ""}</p>
        </div>

        <div className="mx-auto mt-8 w-full max-w-md px-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">Details</p>

          <div className="mt-3 list-card">
            <div className="divide-y divide-border">
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <p className="shrink-0 text-xs font-bold uppercase tracking-wider text-ink-muted">Name</p>
              <p className="min-w-0 flex-1 break-words text-right text-sm text-ink">{user?.full_name ?? "—"}</p>
            </div>
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <p className="shrink-0 text-xs font-bold uppercase tracking-wider text-ink-muted">Email</p>
              <p className="min-w-0 flex-1 break-words text-right text-sm text-ink">{user?.email ?? "—"}</p>
            </div>
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <p className="shrink-0 text-xs font-bold uppercase tracking-wider text-ink-muted">Username</p>
              <p className="min-w-0 flex-1 break-words text-right text-sm text-ink">{user?.username ?? "—"}</p>
            </div>
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <p className="shrink-0 text-xs font-bold uppercase tracking-wider text-ink-muted">Organisation</p>
              <p className="min-w-0 flex-1 break-words text-right text-sm text-ink">{user?.organisation?.name ?? "—"}</p>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Role</p>
              <p className="text-sm text-ink capitalize">{user?.role ?? "—"}</p>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
