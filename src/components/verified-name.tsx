import { BadgeCheck } from "lucide-react";

type VerifiedNameProps = {
  name: string;
  verificationStatus?: string | null;
  className?: string;
};

export function VerifiedName({ name, verificationStatus, className }: VerifiedNameProps) {
  const isVerified = verificationStatus === "verified";

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <span>{name}</span>
      {isVerified ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f7ee] px-2 py-0.5 text-xs font-extrabold text-[#027a48]" title="Verified user">
          <BadgeCheck size={13} />
          Verified
        </span>
      ) : null}
    </span>
  );
}
