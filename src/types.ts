import type { FieldConstraint, NodeConstraint, SchemaConstraints } from "./constraints";

/** SQL の主要型に対応する field type。判別共用体のタグ。 */
export type FieldType =
  | "text"
  | "varchar"
  | "integer"
  | "bigint"
  | "numeric"
  | "boolean"
  | "date"
  | "timestamp"
  | "enum"
  | "json";

export interface BaseField {
  key: string;
  label: string;
  required?: boolean;
  /** この field の value のみを使う命題（field scope）。 */
  constraints?: readonly FieldConstraint[];
}

/** 可変長テキスト。varchar は maxLength を持つ想定。text は複数行。 */
export interface TextField extends BaseField {
  type: "text" | "varchar";
  maxLength?: number;
}
/** 整数 / 大整数 / 実数。bigint は精度落ち回避のため値は文字列で保持する。 */
export interface NumberField extends BaseField {
  type: "integer" | "bigint" | "numeric";
  min?: number;
  max?: number;
}
export interface BoolField extends BaseField {
  type: "boolean";
}
/** date は YYYY-MM-DD、timestamp は ISO8601 文字列。 */
export interface DateField extends BaseField {
  type: "date" | "timestamp";
}
export interface EnumField extends BaseField {
  type: "enum";
  options: readonly string[];
}
export interface JsonField extends BaseField {
  type: "json";
}

export type Field =
  | TextField
  | NumberField
  | BoolField
  | DateField
  | EnumField
  | JsonField;

export interface NodeType<C extends string = string> {
  label: string;
  /** 付箋の色（CSS color）。 */
  color: string;
  /** 末端として許される型か（要件定義完了時、葉はこれが true でなければならない）。 */
  terminal: boolean;
  /** 追加を許可する子の型。これ以外はエディタの「子を追加」に出ない。 */
  children: readonly C[];
  fields: readonly Field[];
  /** この型のノード内の field のみを使う命題（node scope）。 */
  constraints?: readonly NodeConstraint[];
}

export interface Invariants {
  /** 葉ノードは必ず terminal 型でなければならない。 */
  leafMustBeTerminal?: boolean;
}

/**
 * 木スキーマ本体。typed node（nodeTypes）と constraints（rootTypes / children / invariants）を宣言する。
 * これ自体が「要件定義の型」であり、構造を強制する。
 */
export interface Schema<TypeName extends string = string> {
  id: string;
  name: string;
  rootTypes: readonly TypeName[];
  nodeTypes: Record<TypeName, NodeType<TypeName>>;
  invariants?: Invariants;
  /** tree / forest scope と、schema 直下に置く node scope の命題。 */
  constraints?: SchemaConstraints;
  /**
   * アプリ固有のメタ情報（ライブラリは解釈しない汎用バッグ）。
   * 例: アプリ側の BDD Example Mapping ツールは `{ designAdvisory: true }` を立て、
   * そのスキーマの text フィールドでのみ設計依存 advisory を有効にする。
   */
  meta?: Record<string, unknown>;
}

/** 編集対象の木インスタンス。fields の値は FieldType に応じた型（string|number|boolean|object|null）。 */
export interface TreeNode {
  id: string;
  type: string;
  fields: Record<string, unknown>;
  children: TreeNode[];
}

export interface TreeDoc {
  schemaId: string;
  roots: TreeNode[];
}
