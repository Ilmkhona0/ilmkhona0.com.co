import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How ilmkhona0 collects, uses, and protects your information, including cookies and Google AdSense advertising.",
  alternates: { canonical: "/privacy" },
};

// Last updated — change this date whenever you edit the policy.
const LAST_UPDATED = "July 29, 2026";
const CONTACT_EMAIL = "ilmkhona@gmail.com";
const SITE = "ilmkhona0.com.co";

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "48px 20px 80px",
        lineHeight: 1.7,
        fontSize: 16,
      }}
    >
      <p style={{ marginBottom: 8 }}>
        <Link href="/">&larr; Back to ilmkhona0</Link>
      </p>

      <h1 style={{ fontSize: 32, fontWeight: 800, margin: "8px 0 4px" }}>Privacy Policy</h1>
      <p style={{ color: "#667", marginTop: 0 }}>Last updated: {LAST_UPDATED}</p>

      <p>
        This Privacy Policy explains how <strong>ilmkhona0</strong> (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;, or &ldquo;our&rdquo;), operating the website{" "}
        <strong>{SITE}</strong>, collects, uses, and protects your information when you visit
        or use the site. By using ilmkhona0, you agree to the practices described here.
      </p>

      <h2 style={h2}>Information we collect</h2>
      <p>We collect only what we need to run the site:</p>
      <ul style={ul}>
        <li>
          <strong>Account information.</strong> If you sign in with Google, GitHub, or email,
          we receive basic details such as your name, email address, username, and profile
          image, so we can create and identify your account.
        </li>
        <li>
          <strong>Content you submit.</strong> Comments, replies, chat messages to the AI
          assistant, and any files you upload are stored so the site can display and manage
          them.
        </li>
        <li>
          <strong>Usage and device data.</strong> Like most websites, our servers and service
          providers may automatically log information such as your IP address, browser type,
          pages visited, and timestamps, for security and to keep the service working.
        </li>
      </ul>

      <h2 style={h2}>How we use your information</h2>
      <ul style={ul}>
        <li>To provide and maintain the site and your account.</li>
        <li>To display your comments, uploads, and other content you choose to post.</li>
        <li>To protect the site against abuse, spam, and unauthorized access.</li>
        <li>To measure and improve how the site performs.</li>
      </ul>

      <h2 style={h2}>Cookies and similar technologies</h2>
      <p>
        We use cookies and similar technologies to keep you signed in, remember your
        preferences, and understand how the site is used. You can control or delete cookies
        through your browser settings; note that some features (such as staying logged in) may
        not work properly without them.
      </p>

      <h2 style={h2}>Advertising and Google AdSense</h2>
      <p>
        We may display advertising through <strong>Google AdSense</strong>. In connection with
        this:
      </p>
      <ul style={ul}>
        <li>
          Third-party vendors, including Google, use cookies to serve ads based on your prior
          visits to this and other websites.
        </li>
        <li>
          Google&rsquo;s use of advertising cookies enables it and its partners to serve ads to
          you based on your visits to our site and/or other sites on the Internet.
        </li>
        <li>
          You may opt out of personalized advertising by visiting{" "}
          <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer">
            Google Ads Settings
          </a>
          . You can also opt out of some third-party vendors&rsquo; use of cookies for
          personalized advertising at{" "}
          <a href="https://www.aboutads.info/choices/" target="_blank" rel="noreferrer">
            aboutads.info/choices
          </a>
          .
        </li>
      </ul>

      <h2 style={h2}>How your information is shared</h2>
      <p>
        We do not sell your personal information. We share data only with the service providers
        that make the site work &mdash; for example, our hosting provider, our database
        provider, our email provider, and advertising or authentication providers named above
        &mdash; and only as needed to operate the service, or where required by law.
      </p>

      <h2 style={h2}>Data retention</h2>
      <p>
        We keep your information for as long as your account is active or as needed to provide
        the service. You may request deletion of your account and associated content by
        contacting us at the address below.
      </p>

      <h2 style={h2}>Your choices and rights</h2>
      <ul style={ul}>
        <li>You can edit or delete comments and content you have posted where the site allows.</li>
        <li>You can request access to, correction of, or deletion of your personal data.</li>
        <li>You can control cookies and ad personalization as described above.</li>
      </ul>

      <h2 style={h2}>Children&rsquo;s privacy</h2>
      <p>
        ilmkhona0 is not directed to children under 13, and we do not knowingly collect
        personal information from them. If you believe a child has provided us information,
        please contact us and we will remove it.
      </p>

      <h2 style={h2}>Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we do, we will revise the
        &ldquo;Last updated&rdquo; date at the top of this page.
      </p>

      <h2 style={h2}>Contact us</h2>
      <p>
        If you have any questions about this Privacy Policy, contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </main>
  );
}

const h2: React.CSSProperties = { fontSize: 22, fontWeight: 700, margin: "28px 0 6px" };
const ul: React.CSSProperties = { paddingLeft: 22, margin: "6px 0" };
