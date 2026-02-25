"use client";

import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();

    if (!file) {
      setMessage("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData,
    });

    setMessage(res.ok ? "Uploaded!" : "Upload failed");
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Upload File</h1>

      <form onSubmit={handleUpload}>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button type="submit">Upload</button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}
