import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scriptura",
  description: "AI Church Scripture Projection System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-black text-white selection:bg-blue-600 selection:text-white">
        {children}
        <Toaster position="bottom-right" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
      </body>
    </html>
  );
}
