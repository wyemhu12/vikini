export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handlers } from "@/lib/features/auth/auth";

export const { GET, POST } = handlers;
