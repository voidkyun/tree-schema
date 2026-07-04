import { coerceFieldValue, type Field } from "@tree-schema/core";

interface Props {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** FieldType ごとの入力 UI。値は coerceFieldValue で内部表現に正規化して返す。 */
export function FieldInput({ field, value, onChange }: Props) {
  const emit = (raw: unknown) => onChange(coerceFieldValue(field, raw));
  const v = value ?? "";

  switch (field.type) {
    case "text":
      return <textarea value={String(v)} onChange={(e) => emit(e.target.value)} rows={2} />;
    case "varchar":
      return <input type="text" value={String(v)} maxLength={field.maxLength} onChange={(e) => emit(e.target.value)} />;
    case "integer":
      return <input type="number" step={1} value={v === null ? "" : String(v)} onChange={(e) => emit(e.target.value)} />;
    case "bigint":
      return <input type="text" inputMode="numeric" value={v === null ? "" : String(v)} onChange={(e) => emit(e.target.value)} />;
    case "numeric":
      return <input type="number" step="any" value={v === null ? "" : String(v)} onChange={(e) => emit(e.target.value)} />;
    case "boolean":
      return (
        <label className="bool">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => emit(e.target.checked)} />
          <span>{value ? "true" : "false"}</span>
        </label>
      );
    case "date":
      return <input type="date" value={String(v)} onChange={(e) => emit(e.target.value)} />;
    case "timestamp":
      return <input type="datetime-local" value={String(v)} onChange={(e) => emit(e.target.value)} />;
    case "enum":
      return (
        <select value={String(v)} onChange={(e) => emit(e.target.value)}>
          {field.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    case "json":
      return (
        <textarea
          value={typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2)}
          onChange={(e) => emit(e.target.value)}
          rows={4}
          spellCheck={false}
        />
      );
  }
}
