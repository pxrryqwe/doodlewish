import type { Metadata } from "next";
import GiftClient from "./GiftClient";

export const metadata: Metadata = {
  title: "Join this gift",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <GiftClient />;
}
