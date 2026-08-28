import { AntdRegistry } from "@ant-design/nextjs-registry";
import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = { title: { default: "ZunDB Cloud", template: "%s | ZunDB" }, description: "Cloud database infrastructure control plane" };

const quicksand = Quicksand({
  subsets: ["latin", "vietnamese"],
  variable: "--font-quicksand",
  display: "swap",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={quicksand.variable}><body><AntdRegistry><Providers>{children}</Providers></AntdRegistry></body></html>;
}
