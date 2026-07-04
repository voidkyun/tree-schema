import type { Schema, TreeNode } from "@tree-schema/core";

/**
 * localStorage 上のスキーマエントリ。source が真実。
 * schema は構造の即時描画用キャッシュ（JSON 化で constraints 関数は落ちる）。
 * js は import 剥がし済みの実行可能テキストで、読込時に再評価して constraints 関数つき
 * の生 schema を復元するために使う（builtin は同梱コードが真実なので持たない）。
 */
export interface SchemaEntry {
  id: string;
  name: string;
  source: string;
  builtin: boolean;
  schema: Schema;
  js?: string;
}

const K_ENTRIES = "tse:v1:entries"; // ユーザー作成エントリのみ（builtin は同梱コードが真実）
const K_ACTIVE = "tse:v1:active";
const treeKey = (id: string) => `tse:v1:tree:${id}`;

function read<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s == null ? fallback : (JSON.parse(s) as T);
  } catch {
    return fallback;
  }
}

export function loadUserEntries(): SchemaEntry[] {
  return read<SchemaEntry[]>(K_ENTRIES, []);
}
export function saveUserEntries(entries: SchemaEntry[]): void {
  localStorage.setItem(K_ENTRIES, JSON.stringify(entries));
}

export function loadActiveId(): string | null {
  return localStorage.getItem(K_ACTIVE);
}
export function saveActiveId(id: string): void {
  localStorage.setItem(K_ACTIVE, id);
}

const K_DESIGN = "tse:v1:designcheck";
export function loadDesignEnabled(): boolean {
  return localStorage.getItem(K_DESIGN) === "1";
}
export function saveDesignEnabled(v: boolean): void {
  if (v) localStorage.setItem(K_DESIGN, "1");
  else localStorage.removeItem(K_DESIGN);
}

export function loadTree(id: string): TreeNode[] | null {
  return read<TreeNode[] | null>(treeKey(id), null);
}
export function saveTree(id: string, roots: TreeNode[]): void {
  localStorage.setItem(treeKey(id), JSON.stringify(roots));
}
export function clearTree(id: string): void {
  localStorage.removeItem(treeKey(id));
}
