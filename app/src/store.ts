import { create } from "zustand";
import { buildIndex, defaultFieldValue, descendants, type ConstraintViolation, type Schema, type TreeNode } from "@tree-schema/core";
import { BUILTINS, schemaToSource } from "./builtins";
import { instantiateSchema } from "./lib/evaluateSchema";
import * as storage from "./storage";
import type { SchemaEntry } from "./storage";

let counter = 0;
export const newId = (): string => `n${++counter}-${Date.now().toString(36)}`;

export function makeNode(schema: Schema, type: string): TreeNode {
  const t = schema.nodeTypes[type];
  const fields: Record<string, unknown> = {};
  if (t) for (const f of t.fields) fields[f.key] = defaultFieldValue(f);
  return { id: newId(), type, fields, children: [] };
}

function builtinEntries(): SchemaEntry[] {
  return BUILTINS.map((b) => ({
    id: b.schema.id,
    name: b.schema.name,
    source: b.source,
    builtin: true,
    schema: b.schema,
  }));
}
function builtinSeed(id: string): TreeNode[] | null {
  const b = BUILTINS.find((x) => x.schema.id === id);
  return b ? structuredClone(b.seed) : null;
}
function persistUser(entries: SchemaEntry[]): void {
  storage.saveUserEntries(entries.filter((e) => !e.builtin));
}

const templateSchema: Schema = {
  id: "custom",
  name: "新しいスキーマ",
  rootTypes: ["Root"],
  nodeTypes: {
    Root: { label: "Root", color: "#c3ccd5", terminal: true, children: [], fields: [{ key: "name", label: "name", type: "text" }] },
  },
  invariants: { leafMustBeTerminal: true },
};

interface State {
  entries: SchemaEntry[];
  activeId: string;
  schema: Schema;
  source: string;
  roots: TreeNode[];
  selId: string | null;
  /** 設計依存 advisory（in-browser モデル）を有効にするか。 */
  designEnabled: boolean;
  designStatus: "off" | "loading" | "ready" | "error";
  /** 非同期に得た advisory 違反（フラグのみ）。useDesignAdvisoryEngine が更新する。 */
  advisories: ConstraintViolation[];
  setDesignEnabled: (v: boolean) => void;
  setDesignStatus: (s: "off" | "loading" | "ready" | "error") => void;
  setAdvisories: (a: ConstraintViolation[]) => void;
  init: () => void;
  switchTo: (id: string) => void;
  setSource: (source: string) => void;
  /** 評価済みスキーマと移行後の木を確定する（migration UI から呼ぶ）。 */
  commitSchema: (schema: Schema, source: string, js: string | undefined, roots: TreeNode[]) => void;
  /** バンドルから常に新規エントリとして取り込む（import 用）。 */
  importSchema: (schema: Schema, source: string, js: string | undefined, roots: TreeNode[]) => void;
  createNew: () => void;
  duplicate: () => void;
  deleteEntry: (id: string) => void;
  select: (id: string | null) => void;
  addRoot: (type: string) => void;
  addChild: (parentId: string, type: string) => void;
  updateField: (id: string, key: string, value: unknown) => void;
  /** ノードを別の親へ（newParentId=null で最上位ルートへ）移し替える。 */
  moveNode: (id: string, newParentId: string | null) => void;
  remove: (id: string) => void;
}

export const useEditor = create<State>((set, get) => ({
  entries: [],
  activeId: "",
  schema: { id: "", name: "", rootTypes: [], nodeTypes: {} },
  source: "",
  roots: [],
  selId: null,
  designEnabled: storage.loadDesignEnabled(),
  designStatus: "off",
  advisories: [],

  setDesignEnabled: (v) => {
    storage.saveDesignEnabled(v);
    set({ designEnabled: v, ...(v ? {} : { advisories: [], designStatus: "off" as const }) });
  },
  setDesignStatus: (s) => set({ designStatus: s }),
  setAdvisories: (a) => set({ advisories: a }),

  init: () => {
    const userE = storage.loadUserEntries().filter((e) => e && e.schema);
    const entries = [...builtinEntries(), ...userE];
    const activeId = storage.loadActiveId() ?? entries[0]!.id;
    const active = entries.find((e) => e.id === activeId) ?? entries[0]!;
    const roots = storage.loadTree(active.id) ?? builtinSeed(active.id) ?? [];
    set({ entries, activeId: active.id, schema: active.schema, source: active.source, roots, selId: null });
    // ユーザースキーマは js から生 schema（constraints 関数つき）へ昇格する。
    if (!active.builtin && active.js) {
      void instantiateSchema(active.js).then((res) => {
        if (res.schema && get().activeId === active.id) set({ schema: res.schema });
      });
    }
  },

  switchTo: (id) => {
    const e = get().entries.find((x) => x.id === id);
    if (!e) return;
    const roots = storage.loadTree(id) ?? builtinSeed(id) ?? [];
    storage.saveActiveId(id);
    set({ activeId: id, schema: e.schema, source: e.source, roots, selId: null });
    if (!e.builtin && e.js) {
      void instantiateSchema(e.js).then((res) => {
        if (res.schema && get().activeId === id) set({ schema: res.schema });
      });
    }
  },

  setSource: (source) => set({ source }),

  commitSchema: (schema, source, js, roots) =>
    set((s) => {
      const cur = s.entries.find((e) => e.id === s.activeId);
      let entries = s.entries;
      let activeId = s.activeId;
      if (!cur || cur.builtin) {
        // 組み込みは不変。編集適用時は新しいユーザーエントリを作る。
        activeId = `u-${Date.now().toString(36)}`;
        entries = [...s.entries, { id: activeId, name: schema.name || "編集スキーマ", source, builtin: false, schema, js }];
      } else {
        entries = s.entries.map((e) => (e.id === s.activeId ? { ...e, schema, source, js, name: schema.name || e.name } : e));
      }
      persistUser(entries);
      storage.saveActiveId(activeId);
      storage.saveTree(activeId, roots);
      return { entries, activeId, schema, source, roots, selId: null };
    }),

  importSchema: (schema, source, js, roots) =>
    set((s) => {
      const id = `u-${Date.now().toString(36)}`;
      const entry: SchemaEntry = { id, name: schema.name || "インポート", source, builtin: false, schema, js };
      const entries = [...s.entries, entry];
      persistUser(entries);
      storage.saveActiveId(id);
      storage.saveTree(id, roots);
      return { entries, activeId: id, schema, source, roots, selId: null };
    }),

  createNew: () => {
    get().commitSchema({ ...templateSchema }, schemaToSource(templateSchema), undefined, []);
  },

  duplicate: () =>
    set((s) => {
      const id = `u-${Date.now().toString(36)}`;
      const name = `${s.schema.name} (copy)`;
      const schema = { ...s.schema, name };
      const cur = s.entries.find((e) => e.id === s.activeId);
      const entries = [...s.entries, { id, name, source: s.source, builtin: false, schema, js: cur?.js }];
      const roots = structuredClone(s.roots);
      persistUser(entries);
      storage.saveActiveId(id);
      storage.saveTree(id, roots);
      return { entries, activeId: id, schema, source: s.source, roots, selId: null };
    }),

  deleteEntry: (id) =>
    set((s) => {
      const target = s.entries.find((e) => e.id === id);
      if (!target || target.builtin) return s;
      const entries = s.entries.filter((e) => e.id !== id);
      persistUser(entries);
      storage.clearTree(id);
      if (s.activeId !== id) return { entries };
      const next = entries[0]!;
      const roots = storage.loadTree(next.id) ?? builtinSeed(next.id) ?? [];
      storage.saveActiveId(next.id);
      return { entries, activeId: next.id, schema: next.schema, source: next.source, roots, selId: null };
    }),

  select: (id) => set({ selId: id }),

  addRoot: (type) =>
    set((s) => {
      const node = makeNode(s.schema, type);
      const roots = [...s.roots, node];
      storage.saveTree(s.activeId, roots);
      return { roots, selId: node.id };
    }),

  addChild: (parentId, type) =>
    set((s) => {
      const idx = buildIndex(s.roots);
      const parent = idx.byId.get(parentId);
      if (!parent) return s;
      const node = makeNode(s.schema, type);
      parent.children.push(node);
      const roots = [...s.roots];
      storage.saveTree(s.activeId, roots);
      return { roots, selId: node.id };
    }),

  updateField: (id, key, value) =>
    set((s) => {
      const idx = buildIndex(s.roots);
      const node = idx.byId.get(id);
      if (node) node.fields[key] = value;
      const roots = [...s.roots];
      storage.saveTree(s.activeId, roots);
      return { roots };
    }),

  moveNode: (id, newParentId) =>
    set((s) => {
      if (id === newParentId) return s;
      const idx = buildIndex(s.roots);
      const node = idx.byId.get(id);
      if (!node) return s;
      // 自分自身や子孫の下へは移せない
      if (newParentId) {
        const descIds = new Set([id, ...descendants(node).map((n) => n.id)]);
        if (descIds.has(newParentId)) return s;
      }
      // 現在の親（またはルート列）から取り外す
      let roots: TreeNode[];
      const pid = idx.parentOf.get(id);
      if (pid == null) {
        roots = s.roots.filter((r) => r.id !== id);
      } else {
        const parent = idx.byId.get(pid);
        if (parent) parent.children = parent.children.filter((c) => c.id !== id);
        roots = [...s.roots];
      }
      // 取り付け
      if (newParentId == null) {
        roots = [...roots, node];
      } else {
        const np = buildIndex(roots).byId.get(newParentId);
        if (!np) return s;
        np.children.push(node);
        roots = [...roots];
      }
      storage.saveTree(s.activeId, roots);
      return { roots, selId: id };
    }),

  remove: (id) =>
    set((s) => {
      let roots: TreeNode[];
      const rootIdx = s.roots.findIndex((r) => r.id === id);
      if (rootIdx >= 0) {
        roots = s.roots.slice();
        roots.splice(rootIdx, 1);
      } else {
        const idx = buildIndex(s.roots);
        const pid = idx.parentOf.get(id);
        if (pid != null) {
          const parent = idx.byId.get(pid);
          if (parent) parent.children = parent.children.filter((c) => c.id !== id);
        }
        roots = [...s.roots];
      }
      storage.saveTree(s.activeId, roots);
      return { roots, selId: null };
    }),
}));
