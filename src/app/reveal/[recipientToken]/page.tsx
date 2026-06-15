import type { Metadata } from "next";
import RevealClient from "./RevealClient";

export const metadata: Metadata = {
  title: "Your DoodleWish",
  robots: { index: false, follow: false },
};

export default async function RevealPage({
  params,
}: {
  params: Promise<{ recipientToken: string }>;
}) {
  const { recipientToken } = await params;
  return <RevealClient recipientToken={recipientToken} />;
}
