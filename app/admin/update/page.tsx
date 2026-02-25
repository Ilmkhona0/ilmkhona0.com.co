"use client";

import { useState } from "react";

export default function UpdatePage() {
  const [data, setData] = useState("");
  const [message, setMessage] = useState("");

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/admin/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    setMessage(res.ok ? "Updated!" : "Update failed");
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Update Something</h1>

      <form onSubmit={handleUpdate}>
        <input
          type="text"
          placeholder="Enter update data"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
        <button type="submit">Update</button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}
