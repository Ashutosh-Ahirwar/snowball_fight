import { Metadata } from 'next';

type Props = {
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata(
  { searchParams }: Props,
): Promise<Metadata> {
  const user = (searchParams.user as string) || 'Elf';
  const mode = (searchParams.mode as string) || 'invite';
  
  // IMPORTANT: Set this env var in Vercel to your deployed domain
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const imageUrl = `${appUrl}/api/og?user=${encodeURIComponent(user)}&mode=${mode}`;

  return {
    title: 'Snowball Fight',
    openGraph: {
      title: `Snowball Fight with ${user}`,
      images: [imageUrl],
    },
    other: {
      "fc:miniapp": JSON.stringify({
        version: "1",
        imageUrl: imageUrl,
        button: {
          title: mode === 'hit' ? "❄️ Return Fire" : "🥊 Accept Challenge",
          action: {
            type: "launch_miniapp",
            name: "Snowball Fight",
            url: `${appUrl}?referrer=${user}&mode=${mode}`,
            splashImageUrl: `${appUrl}/splash.png`,
            splashBackgroundColor: "#b91c1c"
          }
        }
      })
    }
  }
}

export default function SharePage() {
  return <div>Open in Farcaster to Play! ❄️</div>;
}