import { redirect } from "next/navigation";

// /admin/update was removed. Redirect any stale links back to the admin home.
export default function RemovedUpdatePage() {
  redirect("/admin");
}
