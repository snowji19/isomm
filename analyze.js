export default async (request, context) => {
  // Only allow POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { text, prefs, chunkNote } = body;
  if (!text) {
    return new Response(JSON.stringify({ error: "No wine list text provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const SYSTEM_PROMPT = `You are a sommelier and wine value analyst. Extract BOTTLE-ONLY wines from the restaurant wine list. Return a compact JSON array sorted by value_score descending.

EXCLUDE strictly:
- Any wine in a "By the Glass", "BTG", glass pour, or half bottle / demi / 375ml section
- Any price under $40 (glass or half-bottle price)
- Any wine without a confirmed full 750ml bottle price

For each bottle return ONLY these fields:
{"name":"...","vt":"2019","mp":120,"rp":55,"mk":218,"vv":4.1,"vs":82,"t":"Red","vd":"Excellent Napa value, silky tannins","pairings":["Grilled steak","Aged cheddar"]}

Field key: name=wine name, vt=vintage or null, mp=menu bottle price integer or null, rp=estimated retail integer USD, mk=estimated markup % integer, vv=Vivino rating float 1dp, vs=value score 0-100, t=Red/White/Rose/Sparkling/Dessert, vd=verdict max 10 words no em dashes, pairings=array of 2 strings

Response must be ONLY a raw JSON array [ ... ]. No markdown, no explanation.`;

  const prefStr = prefs && prefs.length ? ` Preferences: ${prefs.join(", ")}.` : "";
  const userMessage = `Analyze this wine list (${chunkNote || "full list"}). Return BOTTLE wines only.${prefStr}\n\nWine list:\n${text}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/api/analyze" };
