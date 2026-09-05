import { handleApi } from "@/worker/api";
import { runtimeEnv } from "@/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return await handleApi(request, runtimeEnv()) ?? Response.json({ error: "not_found" }, { status: 404 });
  } catch {
    console.error("API database/request failure");
    return Response.json({ status: "unavailable", error: "service_unavailable" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
