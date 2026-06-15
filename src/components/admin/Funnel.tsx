interface Step {
  name: string;
  count: number;
}

export default function Funnel({ steps }: { steps: Step[] }) {
  const max = Math.max(...steps.map((s) => s.count), 1);
  return (
    <div className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const pct = (s.count / max) * 100;
        const prev = i > 0 ? steps[i - 1].count : null;
        const drop =
          prev && prev > 0
            ? Math.round(((prev - s.count) / prev) * 100)
            : null;
        return (
          <div key={s.name} className="flex flex-col gap-1">
            <div className="flex justify-between text-[13px] text-dw-fg">
              <span className="font-medium">{s.name}</span>
              <span className="text-dw-gray">
                {s.count.toLocaleString()}
                {drop !== null && drop > 0 && (
                  <span className="text-red-400 ml-2">−{drop}%</span>
                )}
              </span>
            </div>
            <div className="h-3 bg-dw-tray rounded-full overflow-hidden">
              <div
                className="h-full bg-dw-fg"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
