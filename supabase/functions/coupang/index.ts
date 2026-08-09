// 쿠팡 파트너스 중계 — API 키는 서버에만 보관, 브라우저엔 노출하지 않는다.
const AK = Deno.env.get("COUPANG_ACCESS_KEY")!;
const SK = Deno.env.get("COUPANG_SECRET_KEY")!;
const HOST = "https://api-gateway.coupang.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function auth(method: string, path: string, query: string) {
  const dt = new Date().toISOString().substr(2, 17).replace(/[:-]/g, "") + "Z";
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SK),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(dt + method + path + query));
  const sig = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `CEA algorithm=HmacSHA256, access-key=${AK}, signed-date=${dt}, signature=${sig}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const u = new URL(req.url);
    const mode = u.searchParams.get("mode") || "search";

    if (mode === "search") {
      const q = (u.searchParams.get("q") || "").trim();
      if (!q) return json({ items: [] });
      const limit = Math.min(Number(u.searchParams.get("limit") || 8), 20);
      const path = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
      const query = `keyword=${encodeURIComponent(q)}&limit=${limit}`;
      const r = await fetch(`${HOST}${path}?${query}`, {
        headers: { Authorization: await auth("GET", path, query), "Content-Type": "application/json" },
      });
      const j = await r.json();
      // 쿠팡이 키를 거부하거나 장애일 때 빈 목록으로 뭉개면 앱에서 '결과 없음'으로 보인다.
      // 재료가 없는 게 아니라 검색을 못 쓰는 상태이므로 구분해서 알려준다.
      if (j?.code === "ERROR" || (!j?.data && j?.message)) {
        return json({ items: [], error: "upstream", detail: String(j?.message || "") }, 200);
      }
      const items = (j?.data?.productData || []).map((p: Record<string, unknown>) => ({
        name: p.productName, price: p.productPrice, image: p.productImage,
        url: p.productUrl, rocket: !!p.isRocket,
      }));
      return json({ items, notice: j?.rMessage || "" });
    }

    if (mode === "deeplink") {
      const { urls } = await req.json();
      const path = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
      const body = JSON.stringify({ coupangUrls: urls });
      const r = await fetch(`${HOST}${path}`, {
        method: "POST",
        headers: { Authorization: await auth("POST", path, ""), "Content-Type": "application/json" },
        body,
      });
      const j = await r.json();
      return json({ links: (j?.data || []).map((d: Record<string, unknown>) => d.shortenUrl || d.landingUrl) });
    }

    return json({ error: "unknown mode" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
