interface Props {
  label: string;
  value: number | string;
  hint?: string;
}

export default function KpiCard({ label, value, hint }: Props) {
  return (
    <div className="bg-dw-card rounded-card p-4">
      <p className="text-[12px] font-medium text-dw-gray">{label}</p>
      <p className="text-[28px] font-bold text-dw-fg leading-tight mt-1">
        {value}
      </p>
      {hint && <p className="text-[11px] text-dw-gray mt-1">{hint}</p>}
    </div>
  );
}
