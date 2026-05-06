import Link from "next/link";

export const metadata = {
  title: "ilmkhona0 | Admin",
};

export default function AdminHomePage() {
  return (
    <main className="admin-home">
      <div className="admin-home-card">
        <Link href="/" className="admin-home-back"><i className="fas fa-arrow-left" /> Site</Link>
        <h1>Admin</h1>
        <p>Pick an action below.</p>
        <div className="admin-home-grid">
          <Link href="/admin/upload" className="admin-tile">
            <i className="fas fa-cloud-arrow-up" />
            <strong>Upload file</strong>
            <span>Drop in a new image, video, app or game.</span>
          </Link>
          <Link href="/admin/files" className="admin-tile">
            <i className="fas fa-folder-tree" />
            <strong>Manage files</strong>
            <span>Rename, delete, search across every folder.</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
