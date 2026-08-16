// Serves /ads.txt so Google can verify you own this AdSense inventory.
// The publisher id is derived from NEXT_PUBLIC_ADSENSE_CLIENT, so you only set
// it in one place. Returns an empty file until that env var is set.

export const dynamic = "force-static";

export function GET() {
  const client = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "").trim();
  // data-ad-client is "ca-pub-XXXX"; ads.txt wants "pub-XXXX".
  const pub = client.replace(/^ca-/, "");
  const body = pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : "";
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
