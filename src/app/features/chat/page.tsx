import { redirect } from "next/navigation";

interface LegacyChatPageProps {
  searchParams?: Promise<{ id?: string | string[] }>;
}

export default async function LegacyChatRedirectPage({ searchParams }: LegacyChatPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const rawId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  if (rawId && rawId.trim().length > 0) {
    redirect(`/?id=${encodeURIComponent(rawId.trim())}`);
  }
  redirect("/");
}
