import Link from "next/link";

export const metadata = {
  title: "ilmkhona0 | Admin",
};

export default function AdminHomePage() {
  return (
    <main style={{ padding: 32, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Admin</h1>
      <p style={{ color: "#555" }}>Welcome. Pick an action below.</p>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, marginTop: 16 }}>
        <li>
          <Link href="/admin/update" style={{ display: "block", padding: "12px 16px", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, textDecoration: "none", color: "#0a2342", background: "#fff" }}>
            <strong>Update data</strong>
          </Link>
        </li>
        <li>
          <Link href="/admin/upload" style={{ display: "block", padding: "12px 16px", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, textDecoration: "none", color: "#0a2342", background: "#fff" }}>
            <strong>Upload file</strong>
            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>Currently disabled in production.</div>
          </Link>
        </li>
        <li>
          <Link href="/" style={{ display: "block", padding: "12px 16px", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, textDecoration: "none", color: "#0a2342", background: "#fff" }}>
            ← Back to site
          </Link>
        </li>
      </ul>
    </main>
  );
}