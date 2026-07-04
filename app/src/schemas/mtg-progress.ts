import { defineSchema } from "@tree-schema/core";

// 進捗タスク確認 MTG の議事録。
// アジェンダとして事前に Task を並べておき、MTG で状態・障害・決定・次アクションを埋めて完成させる。
// 置ける子の型を Blocker / Decision / Action に限定することで、設計談義など「この場で議論しないもの」を
// 構造的に持ち込めないようにする（残せるものを schema が保証する）。
export default defineSchema({
  id: "mtg-progress",
  name: "進捗タスク確認MTG議事録",
  rootTypes: ["Meeting"],
  nodeTypes: {
    Meeting: { label: "Meeting", color: "#c9d1d9", terminal: false, children: ["Task"], fields: [
      { key: "title", label: "会議名", type: "varchar", maxLength: 120 },
      { key: "date", label: "日付", type: "date" },
      { key: "facilitator", label: "進行", type: "varchar" },
      { key: "attendees", label: "出席者", type: "text" },
    ] },
    Task: { label: "Task", color: "#8ec4f0", terminal: false, children: ["Blocker", "Decision", "Action"], fields: [
      { key: "name", label: "タスク", type: "varchar", maxLength: 120 },
      { key: "owner", label: "担当", type: "varchar" },
      { key: "status", label: "状態", type: "enum", options: ["順調", "要注意", "停滞", "完了"] },
    ],
      // node scope: リスク（要注意/停滞）のタスクは、障害か次アクションを伴う（放置しない）
      constraints: [{
        id: "task.riskHasFollowup",
        message: "「要注意」「停滞」のタスクは Blocker か Action を1つ以上持たせてください",
        check: (node) => {
          const risky = node.fields.status === "要注意" || node.fields.status === "停滞";
          if (!risky) return true;
          return node.children.some((c) => c.type === "Blocker" || c.type === "Action");
        },
      }] },
    Blocker: { label: "Blocker", color: "#ef9a9a", terminal: true, children: [], fields: [
      { key: "what", label: "何が止めているか", type: "text" },
      { key: "needsHelpFrom", label: "誰の助けが要るか", type: "varchar" },
    ] },
    Decision: { label: "Decision", color: "#c3b1e1", terminal: true, children: [], fields: [
      { key: "decided", label: "決めたこと", type: "text" },
    ] },
    Action: { label: "Action", color: "#99e0a2", terminal: true, children: [], fields: [
      { key: "action", label: "次にやること", type: "text" },
      { key: "owner", label: "担当", type: "varchar" },
      { key: "due", label: "期限", type: "date" },
      // node scope（field を跨がない単純例として field constraint）: 担当は必須
    ],
      constraints: [{ id: "action.ownerDue", message: "Action は担当と期限を埋めてください", check: (node) => String(node.fields.owner ?? "").trim() !== "" && String(node.fields.due ?? "").trim() !== "" }] },
  },
  constraints: {
    // tree scope: タスクには担当が要る（誰の進捗か曖昧なまま残さない）
    tree: [{
      id: "task.hasOwner",
      message: "担当が空のタスクがあります",
      check: (root, ctx) => ctx.subtreeNodes(root).filter((n) => n.type === "Task").every((t) => String(t.fields.owner ?? "").trim() !== ""),
    }],
  },
  invariants: { leafMustBeTerminal: true },
});
