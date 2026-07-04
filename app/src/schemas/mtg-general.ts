import { defineSchema } from "@tree-schema/core";

// 汎用の会議アジェンダ／議事録。
// Agenda（議題）の下に Note / Decision / Action / Question を残す。
// 議題にしたのに何も記録が残らない、決定の担当が無い、といった「議事録としての抜け」を constraint で防ぐ。
export default defineSchema({
  id: "mtg-general",
  name: "汎用議事録",
  rootTypes: ["Meeting"],
  nodeTypes: {
    Meeting: { label: "Meeting", color: "#c9d1d9", terminal: false, children: ["Agenda"], fields: [
      { key: "title", label: "会議名", type: "varchar", maxLength: 120 },
      { key: "date", label: "日付", type: "date" },
      { key: "purpose", label: "目的", type: "text" },
      { key: "attendees", label: "出席者", type: "text" },
    ] },
    Agenda: { label: "Agenda", color: "#8ec4f0", terminal: false, children: ["Note", "Decision", "Action", "Question"], fields: [
      { key: "topic", label: "議題", type: "varchar", maxLength: 120 },
    ],
      // node scope: 議題にしたなら何か（メモ/決定/アクション/問い）を残す
      constraints: [{
        id: "agenda.hasRecord",
        message: "議題に記録（Note/Decision/Action/Question）がありません",
        check: (node) => node.children.length > 0,
      }] },
    Note: { label: "Note", color: "#d7dde3", terminal: true, children: [], fields: [
      { key: "note", label: "メモ", type: "text" },
    ] },
    Decision: { label: "Decision", color: "#c3b1e1", terminal: true, children: [], fields: [
      { key: "decided", label: "決めたこと", type: "text" },
    ] },
    Action: { label: "Action", color: "#99e0a2", terminal: true, children: [], fields: [
      { key: "action", label: "やること", type: "text" },
      { key: "owner", label: "担当", type: "varchar" },
      { key: "due", label: "期限", type: "date" },
    ],
      constraints: [{ id: "action.hasOwner", message: "Action には担当が必要です", check: (node) => String(node.fields.owner ?? "").trim() !== "" }] },
    Question: { label: "Question", color: "#ef9a9a", terminal: true, children: [], fields: [
      { key: "question", label: "問い", type: "text" },
      { key: "status", label: "状態", type: "enum", options: ["open", "answered"] },
      { key: "answer", label: "答え", type: "text" },
    ] },
  },
  invariants: { leafMustBeTerminal: true },
});
