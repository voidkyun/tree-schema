import { defineSchema } from "@tree-schema/core";

// 「要件は設計に依存しない」は、ヘッダの「設計依存チェック」（in-browser モデル）が text フィールドを
// 判定する advisory（フラグのみ）で補う。語彙ベースの厳密な field constraint はそちらに移譲した。
//
// Question は末端になり得ない（terminal=false）。open な問いは葉として invalid になり、
// 答え＝Rule の部分木を生やして初めて解決済みになる。valid forest ⇔ 要件定義の完了。
// Rule は terminal=true（自明なルールは例を持たない葉でよい＝Example Mapping の定石）。
export default defineSchema({
  id: "bdd",
  name: "BDD Example Mapping",
  rootTypes: ["Story"],
  nodeTypes: {
    Story: { label: "Story", color: "#f4d06f", terminal: false, children: ["Rule", "Question"], fields: [
      { key: "title", label: "ストーリー", type: "varchar", maxLength: 120 },
      { key: "asA", label: "As a（誰が）", type: "varchar" },
      { key: "iWant", label: "I want（何をしたい）", type: "text" },
      { key: "soThat", label: "So that（なぜ）", type: "text" },
      { key: "priority", label: "優先度", type: "enum", options: ["must", "should", "could"] },
      { key: "mock", label: "関連モック（任意）", type: "varchar" },
    ] },
    Rule: { label: "Rule", color: "#8ec4f0", terminal: true, children: ["Example", "Question"], fields: [
      { key: "statement", label: "ルール（守るべき制約）", type: "text" },
    ] },
    Example: { label: "Example", color: "#99e0a2", terminal: true, children: [], fields: [
      { key: "name", label: "例の名前", type: "varchar", maxLength: 80 },
      { key: "given", label: "Given（前提）", type: "text" },
      { key: "when", label: "When（出来事）", type: "text" },
      { key: "then", label: "Then（結果）", type: "text" },
    ],
      // node scope: 例は「結果」まで書いて初めてルールを例示できる
      constraints: [{ id: "ex.hasThen", message: "Example には Then（期待される結果）が必要です", check: (node) => String(node.fields.then ?? "").trim() !== "" }] },
    // Question は終端になれない＝open な問いは invalid。答えは Rule（の部分木）として生やす。
    Question: { label: "Question", color: "#ef9a9a", terminal: false, children: ["Rule", "Question"], fields: [
      { key: "question", label: "問い（未解決）", type: "text" },
    ] },
  },
  constraints: {
    // tree scope: マップされた Story には受入基準（Rule）が部分木のどこかに1つ以上ある
    tree: [{ id: "story.hasRule", message: "Story には Rule（受入基準）が1つ以上必要です", check: (root, ctx) => ctx.subtreeNodes(root).some((n) => n.type === "Rule") }],
    // forest scope: 森の中で Story タイトルは一意
    forest: [{ id: "story.uniqueTitle", message: "Story タイトルは一意にしてください", check: (roots) => {
      const titles = roots.map((r) => String(r.fields.title ?? "").trim()).filter(Boolean);
      return new Set(titles).size === titles.length;
    } }],
  },
  invariants: { leafMustBeTerminal: true },
  // このスキーマを「BDD Example Mapping」としてアプリに認識させる印。これが立つスキーマでのみ
  // 設計依存 advisory（in-browser モデル）が有効になる。汎用木エディタでは無印＝機能は不可視。
  meta: { designAdvisory: true },
});
