interface Row {
  metric: string;
  value: number;
}

export default function EventsTable({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  return (
    <div className="bg-dw-card rounded-card p-4">
      <p className="text-[13px] font-semibold text-dw-fg mb-3">All events</p>
      <table className="w-full text-[13px]">
        <thead className="text-dw-gray text-left">
          <tr>
            <th className="font-medium py-1">Event</th>
            <th className="font-medium py-1 text-right">Count</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.metric} className="border-t border-dw-fg/10">
              <td className="py-1 text-dw-fg">{r.metric}</td>
              <td className="py-1 text-right text-dw-fg font-medium">
                {r.value.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
