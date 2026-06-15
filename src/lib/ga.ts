import { BetaAnalyticsDataClient } from "@google-analytics/data";

let _client: BetaAnalyticsDataClient | null = null;
function client() {
  if (_client) return _client;
  const email = process.env.GA_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GA_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("GA service account env not set");
  }
  // Vercel stores envs with literal \n; replace with real newlines.
  const privateKey = rawKey.replace(/\\n/g, "\n");
  _client = new BetaAnalyticsDataClient({
    credentials: { client_email: email, private_key: privateKey },
  });
  return _client;
}

function propertyName(): string {
  const id = process.env.GA_PROPERTY_ID;
  if (!id) throw new Error("GA_PROPERTY_ID not set");
  return `properties/${id}`;
}

function rangeFor(days: number): { startDate: string; endDate: string } {
  return { startDate: `${days}daysAgo`, endDate: "today" };
}

interface KpiRow {
  metric: string;
  value: number;
}

const EVENT_NAMES = [
  "page_view",
  "gift_created",
  "link_copied",
  "gift_joined",
  "sticker_added",
  "frame_submitted",
  "gift_sent",
  "gift_opened",
  "export_started",
  "export_saved",
  "export_failed",
];

export async function getKpis(days: number): Promise<KpiRow[]> {
  const [resp] = await client().runReport({
    property: propertyName(),
    dateRanges: [rangeFor(days)],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
  });
  const map = new Map<string, number>();
  for (const row of resp.rows ?? []) {
    const name = row.dimensionValues?.[0]?.value ?? "";
    map.set(name, Number(row.metricValues?.[0]?.value ?? 0));
  }
  const [usersResp] = await client().runReport({
    property: propertyName(),
    dateRanges: [rangeFor(days)],
    metrics: [{ name: "totalUsers" }, { name: "activeUsers" }],
  });
  const totalUsers = Number(
    usersResp.rows?.[0]?.metricValues?.[0]?.value ?? 0
  );
  const activeUsers = Number(
    usersResp.rows?.[0]?.metricValues?.[1]?.value ?? 0
  );
  const out: KpiRow[] = EVENT_NAMES.map((n) => ({
    metric: n,
    value: map.get(n) ?? 0,
  }));
  out.unshift({ metric: "total_users", value: totalUsers });
  out.unshift({ metric: "active_users", value: activeUsers });
  return out;
}

export interface FunnelStep {
  name: string;
  count: number;
}

export async function getFunnel(days: number): Promise<FunnelStep[]> {
  const kpis = await getKpis(days);
  const find = (n: string) => kpis.find((k) => k.metric === n)?.value ?? 0;
  return [
    { name: "page_view", count: find("page_view") },
    { name: "gift_created", count: find("gift_created") },
    { name: "link_copied", count: find("link_copied") },
    { name: "frame_submitted", count: find("frame_submitted") },
    { name: "gift_sent", count: find("gift_sent") },
    { name: "gift_opened", count: find("gift_opened") },
    { name: "export_saved", count: find("export_saved") },
  ];
}

export interface TrendPoint {
  date: string;
  value: number;
}

export async function getTrend(days: number, eventName: string): Promise<TrendPoint[]> {
  const [resp] = await client().runReport({
    property: propertyName(),
    dateRanges: [rangeFor(days)],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: { value: eventName },
      },
    },
    orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
  });
  return (resp.rows ?? []).map((r) => {
    const d = r.dimensionValues?.[0]?.value ?? "";
    return {
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      value: Number(r.metricValues?.[0]?.value ?? 0),
    };
  });
}

export interface RealtimeSnapshot {
  activeUsers: number;
  countries: { name: string; count: number }[];
}

export async function getRealtime(): Promise<RealtimeSnapshot> {
  const [resp] = await client().runRealtimeReport({
    property: propertyName(),
    dimensions: [{ name: "country" }],
    metrics: [{ name: "activeUsers" }],
    limit: 5,
  });
  let total = 0;
  const countries = (resp.rows ?? []).map((r) => {
    const n = r.dimensionValues?.[0]?.value ?? "(unknown)";
    const c = Number(r.metricValues?.[0]?.value ?? 0);
    total += c;
    return { name: n, count: c };
  });
  return { activeUsers: total, countries };
}
