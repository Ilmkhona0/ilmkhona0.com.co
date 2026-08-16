// Google tag (gtag.js) for Google Analytics 4 and Google Ads.
//
// Two separate products, one script:
//   NEXT_PUBLIC_GA_ID         -> "G-XXXXXXXXXX"  Analytics 4 (see your traffic)
//   NEXT_PUBLIC_GOOGLE_ADS_ID -> "AW-1234567890" Google Ads (measure campaign clicks)
//
// Renders nothing if neither env var is set, so local dev and previews stay clean.
//
// Consent Mode v2, region-aware:
//   EEA + UK + Switzerland -> starts "denied". Google's certified CMP (published
//     in AdSense > Privacy & messaging) shows the consent message and calls
//     gtag("consent", "update", ...) itself.
//   Everywhere else -> starts "granted". No consent law requires a prior opt-in
//     there, and leaving it denied would silently gut Analytics and ad revenue.

import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

export default function GoogleTags() {
  const primaryId = GA_ID || ADS_ID;
  if (!primaryId) return null;

  return (
    <>
      {/* Must run before gtag.js so the defaults are respected. */}
      <Script id="gtag-consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          // EEA (27) + Iceland, Liechtenstein, Norway + UK + Switzerland.
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500,
            region: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR',
                     'HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK',
                     'SI','ES','SE','IS','LI','NO','GB','CH']
          });
          // Rest of the world.
          gtag('consent', 'default', {
            ad_storage: 'granted',
            ad_user_data: 'granted',
            ad_personalization: 'granted',
            analytics_storage: 'granted'
          });
        `}
      </Script>

      <Script
        id="gtag-js"
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${primaryId}`}
        strategy="afterInteractive"
      />

      <Script id="gtag-config" strategy="afterInteractive">
        {`
          gtag('js', new Date());
          ${GA_ID ? `gtag('config', '${GA_ID}');` : ""}
          ${ADS_ID ? `gtag('config', '${ADS_ID}');` : ""}
        `}
      </Script>
    </>
  );
}
