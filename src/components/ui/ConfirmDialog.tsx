import { useEffect, useRef } from "react";
import { btnDanger, btnPrimary, btnSecondary } from "@/lib/buttonStyles";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-50 m-auto w-[calc(100%-2.5rem)] max-w-sm rounded-3xl border border-border bg-elevated p-0 shadow-level2 backdrop:bg-black/50"
    >
      <div className="p-6">
        <h3 className="text-base font-extrabold tracking-tight text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{message}</p>
      </div>

      <div className="flex gap-3 border-t border-border p-4">
        <button type="button" onClick={onCancel} className={`${btnSecondary} flex-1`}>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={destructive ? `${btnDanger} flex-1` : `${btnPrimary} flex-1`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
