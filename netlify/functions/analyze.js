const SYSTEM_PROMPT = `You are a sommelier and wine value analyst. Extract BOTTLE-ONLY wines from the restaurant wine list. Return a compact JSON array sorted by value_score descending.

EXCLUDE strictly:
- Any wine in a "By the Glass", "BTG", glass pour, or half bottle / demi / 375ml section
- Any price under $40 (glass or half-bottle price)
- Any wine without a confirmed full 750ml bottle price

For each bottle return ONLY these fields:
{"name":"...","vt":"2019","mp":120,"rp":55,"mk":218,"vv":4.1,"vs":82,"t":"Red","vd":"Excellent Napa value, silky tannins","pairings":["Grilled steak","Aged cheddar"]}

Field key: name=wine name, vt=vintage or null, mp=menu bottle price integer or null, rp=estimated retail integer USD, mk=estimated markup % integer, vv=Vivino rating float 1dp, vs=value score 0-100, t=Red/White/Rose/Sparkling/Dessert, vd=verdict max 10 words no em dashes, pairings=array of 2 strings

Response must be ONLY a raw JSON array [ ... ]. No markdown, no explanation.`;

exports.handler = async function(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: { message: "API key not configured on server" } }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: { message: "Invalid JSON body" } }) };
  }

  const { text, prefs, chunkNote } = body;
  if (!text) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: { message: "No wine list text provided" } }) };
  }

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
    return { statusCode: response.status, headers, body: JSON.stringify(data) };
  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: { message: err.message } }) };
  }
};
