// ตัวเลขสรุปบน Dashboard — ตัวเลขใหญ่ใช้ Barlow Condensed ตาม §8
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="panel p-4">
      <p className="text-sm text-ink/70">{label}</p>
      <p className="font-display text-3xl font-bold text-royal num mt-1">{value}</p>
      {hint && <p className="text-xs text-ink/60 mt-1">{hint}</p>}
    </div>
  );
}
