import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { verifySession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { getKpis, getFunnel, getTrend, getRealtime } from "@/lib/ga";
import KpiCard from "@/components/admin/KpiCard";
import Funnel from "@/components/admin/Funnel";
import TrendChart from "@/components/admin/TrendChart";
import EventsTable from "@/components/admin/EventsTable";
import LogoutButton from "./LogoutButton";
import RangePicker from "./RangePicker";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect("/admin/login");
  }

  const { range = "7" } = await searchParams;
  const days = Math.min(Math.max(Number(range), 1), 90);

  let kpis, funnel, trend, realtime;
  try {
    [kpis, funnel, trend, realtime] = await Promise.all([
      getKpis(days),
      getFunnel(days),
      getTrend(days, "gift_created"),
      getRealtime(),
    ]);
  } catch (e) {
    return (
      <main className="min-h-dvh bg-dw-bg p-6">
        <h1 className="text-[24px] font-bold mb-2">Admin</h1>
        <div className="bg-dw-card rounded-card p-4 text-[14px] text-dw-fg">
          Could not load GA data:{" "}
          <span className="text-red-500">
            {e instanceof Error ? e.message : "unknown error"}
          </span>
          <p className="text-dw-gray mt-2">
            Make sure GA_PROPERTY_ID, GA_SERVICE_ACCOUNT_EMAIL and
            GA_SERVICE_ACCOUNT_PRIVATE_KEY are set, and that the service
            account has Viewer access on the GA4 property.
          </p>
        </div>
      </main>
    );
  }

  const find = (n: string) => kpis.find((k) => k.metric === n)?.value ?? 0;
  const users = find("active_users");
  const created = find("gift_created");
  const sent = find("gift_sent");
  const opened = find("gift_opened");
  const exported = find("export_saved");
  const submitted = find("frame_submitted");
  const pv = find("page_view");
  const activation = pv > 0 ? Math.round((created / pv) * 100) : 0;
  const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
  const framesPerGift = sent > 0 ? (submitted / sent).toFixed(1) : "0";

  return (
    <main className="min-h-dvh bg-dw-bg p-6 max-w-[1280px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-dw-fg">DoodleWish Admin</h1>
          <p className="text-[12px] text-dw-gray">Last {days} days</p>
        </div>
        <div className="flex items-center gap-3">
          <RangePicker current={days} />
          <a
            href={`https://analytics.google.com/analytics/web/#/p${process.env.GA_PROPERTY_ID}/reports`}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] underline text-dw-fg"
          >
            Open in GA4 →
          </a>
          <LogoutButton />
        </div>
      </div>

      <div className="bg-dw-card rounded-card p-4 mb-6 flex items-center gap-4">
        <div>
          <p className="text-[12px] text-dw-gray">Active right now</p>
          <p className="text-[32px] font-bold text-dw-fg leading-tight">
            {realtime.activeUsers}
          </p>
        </div>
        <div className="text-[12px] text-dw-gray flex flex-wrap gap-3">
          {realtime.countries.map((c) => (
            <span key={c.name}>
              {c.name}: <b className="text-dw-fg">{c.count}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Users" value={users.toLocaleString()} />
        <KpiCard label="Gifts created" value={created.toLocaleString()} />
        <KpiCard label="Gifts sent" value={sent.toLocaleString()} />
        <KpiCard label="Gifts opened" value={opened.toLocaleString()} />
        <KpiCard label="Exports saved" value={exported.toLocaleString()} />
        <KpiCard label="Frames / gift" value={framesPerGift} />
        <KpiCard label="Activation rate" value={`${activation}%`} hint="gift_created / page_view" />
        <KpiCard label="Open rate" value={`${openRate}%`} hint="opened / sent" />
      </div>

      <div className="bg-dw-card rounded-card p-4 mb-6">
        <p className="text-[13px] font-semibold text-dw-fg mb-3">
          Activation funnel
        </p>
        <Funnel steps={funnel} />
      </div>

      <div className="mb-6">
        <TrendChart data={trend} label="gift_created — daily" />
      </div>

      <EventsTable rows={kpis} />
    </main>
  );
}
