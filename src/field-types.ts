import type { Field } from "./types";

export interface FieldIssue {
  code: "FIELD_TYPE" | "REQUIRED_MISSING";
  message: string;
}

/** 新規ノード作成時の field 初期値（型に応じる）。 */
export function defaultFieldValue(field: Field): unknown {
  switch (field.type) {
    case "text":
    case "varchar":
    case "date":
    case "timestamp":
      return "";
    case "integer":
    case "bigint":
    case "numeric":
      return null;
    case "boolean":
      return false;
    case "enum":
      return field.options[0] ?? "";
    case "json":
      return null;
  }
}

/** 入力 UI からの生値を内部表現へ正規化する。 */
export function coerceFieldValue(field: Field, raw: unknown): unknown {
  switch (field.type) {
    case "integer":
    case "numeric":
      return raw === "" || raw == null ? null : Number(raw);
    case "bigint":
      return raw === "" || raw == null ? null : String(raw);
    case "boolean":
      return Boolean(raw);
    case "json":
      if (typeof raw === "object" || raw == null) return raw;
      try {
        return JSON.parse(String(raw));
      } catch {
        return raw;
      }
    default:
      return raw == null ? "" : String(raw);
  }
}

/** 単一 field の値が型的に妥当か検証する。妥当なら null。 */
export function validateField(field: Field, value: unknown): FieldIssue | null {
  const empty = value === "" || value === null || value === undefined;
  if (field.required && empty) {
    return { code: "REQUIRED_MISSING", message: `${field.label} は必須です` };
  }
  if (empty) return null;

  switch (field.type) {
    case "text":
    case "varchar": {
      if (typeof value !== "string") return { code: "FIELD_TYPE", message: `${field.label} は文字列です` };
      if (field.maxLength != null && value.length > field.maxLength)
        return { code: "FIELD_TYPE", message: `${field.label} は ${field.maxLength} 文字以内です` };
      return null;
    }
    case "integer": {
      const n = Number(value);
      if (!Number.isInteger(n)) return { code: "FIELD_TYPE", message: `${field.label} は整数です` };
      if (field.min != null && n < field.min) return { code: "FIELD_TYPE", message: `${field.label} は ${field.min} 以上です` };
      if (field.max != null && n > field.max) return { code: "FIELD_TYPE", message: `${field.label} は ${field.max} 以下です` };
      return null;
    }
    case "bigint": {
      try {
        BigInt(String(value));
      } catch {
        return { code: "FIELD_TYPE", message: `${field.label} は整数です` };
      }
      return null;
    }
    case "numeric": {
      const n = Number(value);
      if (Number.isNaN(n)) return { code: "FIELD_TYPE", message: `${field.label} は数値です` };
      if (field.min != null && n < field.min) return { code: "FIELD_TYPE", message: `${field.label} は ${field.min} 以上です` };
      if (field.max != null && n > field.max) return { code: "FIELD_TYPE", message: `${field.label} は ${field.max} 以下です` };
      return null;
    }
    case "boolean":
      return typeof value === "boolean" ? null : { code: "FIELD_TYPE", message: `${field.label} は真偽値です` };
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(Date.parse(String(value)))
        ? null
        : { code: "FIELD_TYPE", message: `${field.label} は日付(YYYY-MM-DD)です` };
    case "timestamp":
      return Number.isNaN(Date.parse(String(value)))
        ? { code: "FIELD_TYPE", message: `${field.label} は日時です` }
        : null;
    case "enum":
      return field.options.includes(String(value))
        ? null
        : { code: "FIELD_TYPE", message: `${field.label} は選択肢のいずれかです` };
    case "json": {
      if (typeof value === "object") return null;
      try {
        JSON.parse(String(value));
        return null;
      } catch {
        return { code: "FIELD_TYPE", message: `${field.label} は有効な JSON です` };
      }
    }
  }
}
