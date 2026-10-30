import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { buildGatewayMessages, extractJson, validateProposal } from "@/lib/ai-gateway";

// ─── Universal AI Gateway (PRD 5-bo'lim) ─────────────────────────────────────
// Bulut modeli (T4) — qat'iy sxemali, tipli amallar qaytaradi.
// Prompt va validatsiya src/lib/ai-gateway.ts'da — mijozdagi BYOK chaqiruvi
// bilan BIR XIL shartnoma. Xato bo'lsa mijoz T0 qoidalar dvigateliga qaytadi.

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const command: string = (body?.command ?? "").toString().slice(0, 2000);
    const lang: string = ["uz", "ru", "en"].includes(body?.lang) ? body.lang : "uz";
    const context = body?.context ?? {};

    if (!command.trim()) {
      return NextResponse.json({ ok: false, error: "empty_command" }, { status: 400 });
    }

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: buildGatewayMessages(command, lang, {
        today: String(context.today ?? ""),
        now: String(context.now ?? ""),
        tasks: Array.isArray(context.tasks) ? context.tasks : [],
        habits: Array.isArray(context.habits) ? context.habits : [],
        goals: Array.isArray(context.goals) ? context.goals : [],
      }),
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJson(raw);
    const proposal = parsed ? validateProposal(parsed, "cloud-t4") : null;
    if (!proposal) {
      return NextResponse.json({ ok: false, error: "bad_json", raw: raw.slice(0, 500) });
    }

    return NextResponse.json({ ok: true, proposal });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 200 });
  }
}
