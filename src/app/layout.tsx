import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { Inter, Roboto, Playfair_Display, Montserrat, Merriweather, Open_Sans, Lato, Libre_Baskerville, Source_Sans_3, Noto_Sans, Noto_Serif } from 'next/font/google';
import "./globals.css";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const roboto = Roboto({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-roboto', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat', display: 'swap' })
const merriweather = Merriweather({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-merriweather', display: 'swap' })
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans', display: 'swap' })
const lato = Lato({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-lato', display: 'swap' })
const libreBaskerville = Libre_Baskerville({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-libre', display: 'swap' })
const sourceSans = Source_Sans_3({ subsets: ['latin'], variable: '--font-source-sans', display: 'swap' })
const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-noto-sans', display: 'swap' })
const notoSerif = Noto_Serif({ subsets: ['latin'], variable: '--font-noto-serif', display: 'swap' })

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
    <html lang="en" className={`dark ${inter.variable} ${roboto.variable} ${playfair.variable} ${montserrat.variable} ${merriweather.variable} ${openSans.variable} ${lato.variable} ${libreBaskerville.variable} ${sourceSans.variable} ${notoSans.variable} ${notoSerif.variable}`}>
      <body className="antialiased bg-black text-white selection:bg-blue-600 selection:text-white">
        {children}
        <Toaster position="bottom-right" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
      </body>
    </html>
  );
}
