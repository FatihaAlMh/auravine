import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auravine — Send an Eternal Particle Bloom",
  description:
    "Create, customize, and send a personalized, interactive 3D particle flower to someone you love.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#03030c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="auravine-bg min-h-screen text-[#e6dcff] selection:bg-purple-500/30 selection:text-purple-100">
        {children}
      </body>
    </html>
  );
}
