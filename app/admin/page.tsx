// Admin dashboard page - requires admin rank
import { redirect } from "next/navigation";
import { auth } from "@/lib/features/auth/auth";
import AdminDashboard from "./components/AdminDashboard";

export default async function AdminPage() {
  const session = await auth();

  // Auth guard: must be logged in and have admin rank
  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.rank !== "admin") {
    redirect("/");
  }

  return <AdminDashboard />;
}
