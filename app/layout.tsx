import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. Define your app URL (Use environment variable or hardcode your Vercel URL)
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://snowball-fight-tawny.vercel.app";

// 2. Define the Mini App Embed JSON
const frameMetadata = JSON.stringify({
  version: "1",
  imageUrl: `${appUrl}/hero.png`, // Make sure you have this image in /public
  button: {
    title: "Launch Snowball Fight",
    action: {
      type: "launch_miniapp",
      name: "Snowball Fight",
      url: appUrl,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#b91c1c",
    },
  },
});

export const metadata: Metadata = {
  title: "Snowball Fight",
  description: "Throw digital snowballs at your friends!",
  // 3. Add the Farcaster Meta Tags here
  other: {
    "fc:miniapp": frameMetadata,
    "fc:frame": frameMetadata, // For backward compatibility 
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}