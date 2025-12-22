// app/gems/page.jsx
// Redirect to the gems page in features folder, preserving query params
import { redirect } from "next/navigation";

export default function GemsRedirectPage({ searchParams }) {
  const conversationId = searchParams?.conversationId;
  const targetUrl = conversationId
    ? `/features/gems?conversationId=${conversationId}`
    : "/features/gems";
  redirect(targetUrl);
}
