import type { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ dashboardToken: string }>;
}) {
  const { dashboardToken } = await params;
  return <DashboardClient dashboardToken={dashboardToken} />;
}
