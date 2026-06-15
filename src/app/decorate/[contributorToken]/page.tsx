import type { Metadata } from "next";
import DecorateClient from "./DecorateClient";

export const metadata: Metadata = {
  title: "Decorate",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DecorateClient />;
}
