import { useNavigate } from "react-router-dom";

interface Props {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

export default function PageHeader({ title, showBack = false, right }: Props) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-surface/90 pt-safe backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-5">
        <div className="flex w-10 shrink-0 items-center">
          {showBack && (
            <button onClick={() => navigate(-1)} className="text-ink hover:text-primary">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
        </div>
        <h2 className="flex-1 text-center text-base font-bold tracking-tight text-ink">{title}</h2>
        <div className="flex w-10 items-center justify-end">{right}</div>
      </div>
    </div>
  );
}
