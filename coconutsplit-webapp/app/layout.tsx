import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoconutSplit",
  description: "Split expenses with friends",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-gray-900">
      <body className="bg-gray-900 text-gray-100 min-h-screen w-full pb-20">
          {children}
      </body>
    </html>
  );
}
