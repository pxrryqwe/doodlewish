import type { Metadata } from "next";
import RecipientClient from "./RecipientClient";

export const metadata: Metadata = {
  title: "Open your gift",
  robots: { index: false, follow: false },
};

export default async function RecipientPage({
  params,
}: {
  params: Promise<{ recipientToken: string }>;
}) {
  const { recipientToken } = await params;
  return <RecipientClient recipientToken={recipientToken} />;
}
