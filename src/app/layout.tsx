import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "视频头顶加字幕",
  description: "在浏览器本地给视频主体添加动态标签",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
