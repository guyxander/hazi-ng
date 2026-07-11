import { CheckCircle2 } from "lucide-react";

type SuccessAnimationProps = {
  title: string;
  message: string;
};

export function SuccessAnimation({ title, message }: SuccessAnimationProps) {
  return (
    <div className="success-animation" role="status" aria-live="polite">
      <span className="success-animation__icon">
        <CheckCircle2 size={28} />
      </span>
      <div>
        <p className="font-extrabold text-[var(--primary)]">{title}</p>
        <p className="text-sm font-semibold text-[var(--muted)]">{message}</p>
      </div>
    </div>
  );
}
