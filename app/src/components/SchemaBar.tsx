import { useEditor } from "../store";

export function SchemaBar() {
  const { entries, activeId, switchTo, createNew, duplicate, deleteEntry } = useEditor();
  const active = entries.find((e) => e.id === activeId);

  return (
    <div className="schemabar">
      <select value={activeId} onChange={(e) => switchTo(e.target.value)}>
        {entries.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}{e.builtin ? "（例）" : ""}
          </option>
        ))}
      </select>
      <button onClick={createNew}>新規</button>
      <button onClick={duplicate}>複製</button>
      <button onClick={() => deleteEntry(activeId)} disabled={active?.builtin}>削除</button>
    </div>
  );
}
