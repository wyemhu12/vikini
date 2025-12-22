// app/page.jsx
// Redirect to the main chat page
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/features/chat");
}
