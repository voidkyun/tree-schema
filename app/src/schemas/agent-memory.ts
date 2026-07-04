import { defineSchema } from "@tree-schema/core";

// コーディングエージェント（Claude Code / Codex 等）のメモリを、平らな Markdown ではなく木で持つ試み。
// Memory → Area（分類）→ Fact（1事実）。型・出所・確度を構造化し、構造的に質を担保する。
// 例えば「落とし穴には理由が要る」「参照には URL が要る」「同じ分類で事実が重複しない」を constraint で守る。
export default defineSchema({
  id: "agent-memory",
  name: "Memory for Coding Agent",
  rootTypes: ["Memory"],
  nodeTypes: {
    Memory: { label: "Memory", color: "#c9d1d9", terminal: false, children: ["Area"], fields: [
      { key: "project", label: "対象（プロジェクト/リポジトリ）", type: "varchar", maxLength: 120 },
    ] },
    Area: { label: "Area", color: "#8ec4f0", terminal: false, children: ["Fact"], fields: [
      { key: "name", label: "分類", type: "varchar", maxLength: 80 },
    ] },
    Fact: { label: "Fact", color: "#99e0a2", terminal: true, children: [], fields: [
      { key: "summary", label: "要点（1行）", type: "varchar", maxLength: 140 },
      { key: "detail", label: "詳細・理由", type: "text" },
      { key: "kind", label: "種別", type: "enum", options: ["convention", "architecture", "pitfall", "preference", "reference", "glossary"] },
      { key: "source", label: "出所", type: "enum", options: ["user-told", "inferred-from-code", "docs", "web"] },
      { key: "confidence", label: "確度", type: "enum", options: ["high", "medium", "low"] },
      { key: "url", label: "URL（参照のとき）", type: "varchar" },
      { key: "lastChecked", label: "最終確認日", type: "date" },
    ],
      constraints: [
        // node scope: 落とし穴は「なぜ/どう避けるか」が無いと危険
        { id: "fact.pitfallNeedsDetail", message: "pitfall（落とし穴）には detail（理由・回避法）が必要です", check: (node) => node.fields.kind !== "pitfall" || String(node.fields.detail ?? "").trim() !== "" },
        // node scope: 参照は出所 URL を伴う
        { id: "fact.referenceNeedsUrl", message: "reference には URL が必要です", check: (node) => node.fields.kind !== "reference" || String(node.fields.url ?? "").trim() !== "" },
      ] },
  },
  constraints: {
    // tree scope: 同じ Area の中で要点が重複しない（メモの肥大・矛盾を防ぐ）
    tree: [{
      id: "area.uniqueFact",
      message: "同じ Area 内に要点(summary)が重複した Fact があります",
      check: (root) =>
        root.children
          .filter((a) => a.type === "Area")
          .every((area) => {
            const ss = area.children.map((f) => String(f.fields.summary ?? "").trim()).filter(Boolean);
            return new Set(ss).size === ss.length;
          }),
    }],
    // forest scope: メモリの対象は一意（1プロジェクト1ツリー）
    forest: [{
      id: "memory.uniqueProject",
      message: "Memory の対象（project）は一意にしてください",
      check: (roots) => {
        const ps = roots.map((r) => String(r.fields.project ?? "").trim()).filter(Boolean);
        return new Set(ps).size === ps.length;
      },
    }],
  },
  invariants: { leafMustBeTerminal: true },
});
