import type { Field, NodeType, Schema, TreeDoc, TreeNode } from "./types";
import {
  ancestors as _ancestors,
  buildIndex,
  descendants as _descendants,
  getParent,
  siblings as _siblings,
  type TreeIndex,
} from "./graph/relations";
import { depth as _depth, height as _height } from "./graph/metrics";
import { validateField } from "./field-types";

/**
 * 述語に渡す評価文脈。constraints は core を直接 import せずこの ctx 経由で
 * 木ユーティリティを使う。これにより Monaco 評価時に `@tree-schema/core` の
 * import を剥がしても述語が壊れない（= 任意の boolean 述語が source 上に書ける）。
 * id でもノードでも受けられるようヘルパーは両対応にしてある。
 */
export interface ConstraintCtx {
  schema: Schema;
  /** forest 全体のルート。 */
  roots: TreeNode[];
  /** forest 全体の親引き / id 引き index。 */
  index: TreeIndex;
  ancestors(x: string | TreeNode): TreeNode[];
  descendants(node: TreeNode): TreeNode[];
  children(node: TreeNode): TreeNode[];
  siblings(x: string | TreeNode): TreeNode[];
  parent(x: string | TreeNode): TreeNode | null;
  depth(x: string | TreeNode): number;
  height(node: TreeNode): number;
  /** ノードの型定義を引く。 */
  typeOf(node: TreeNode): NodeType | undefined;
  /** forest 全ノード（pre-order）。 */
  nodes(): TreeNode[];
  /** 部分木のノード（root を含む、pre-order）。tree 述語で「この木の node」を得る用途。 */
  subtreeNodes(root: TreeNode): TreeNode[];
  validateField: typeof validateField;
}

/** field 述語の文脈は対象ノードとフィールド定義を加える。 */
export interface FieldCtx extends ConstraintCtx {
  node: TreeNode;
  field: Field;
}

export type FieldCheck = (value: unknown, ctx: FieldCtx) => boolean;
export type NodeCheck = (node: TreeNode, ctx: ConstraintCtx) => boolean;
export type TreeCheck = (root: TreeNode, ctx: ConstraintCtx) => boolean;
export type ForestCheck = (roots: TreeNode[], ctx: ConstraintCtx) => boolean;

/**
 * 違反の重み。error は valid forest をブロックする（構造的・確定的な制約）。
 * advisory はフラグのみで valid forest をブロックしない（ヒューリスティック・ML など、
 * 最終判断を人に委ねる制約）。省略時は error。
 */
export type ConstraintSeverity = "error" | "advisory";

/** field の value のみを使う命題（field に attach）。 */
export interface FieldConstraint {
  id: string;
  message: string;
  /** 省略時 error。advisory はフラグのみで valid forest をブロックしない。 */
  severity?: ConstraintSeverity;
  check: FieldCheck;
}
/** node 内の field のみを使う命題（nodeType に attach）。 */
export interface NodeConstraint {
  id: string;
  message: string;
  severity?: ConstraintSeverity;
  /** 省略時は全ノード型に適用。指定時はその型のみ（schema 直下に置く場合に使う）。 */
  appliesTo?: readonly string[];
  check: NodeCheck;
}
/** tree 内の node のみを使う命題（schema 直下、ルートごとに評価）。 */
export interface TreeConstraint {
  id: string;
  message: string;
  severity?: ConstraintSeverity;
  check: TreeCheck;
}
/** forest 全体の命題（schema 直下、一度だけ評価）。 */
export interface ForestConstraint {
  id: string;
  message: string;
  severity?: ConstraintSeverity;
  check: ForestCheck;
}

export interface SchemaConstraints {
  /** schema 直下に置く node 述語（appliesTo で型を絞れる）。 */
  node?: readonly NodeConstraint[];
  tree?: readonly TreeConstraint[];
  forest?: readonly ForestConstraint[];
}

export type ConstraintScope = "field" | "node" | "tree" | "forest";

export interface ConstraintViolation {
  scope: ConstraintScope;
  constraintId: string;
  message: string;
  /** error は valid forest をブロック、advisory はフラグのみ。 */
  severity: ConstraintSeverity;
  /** field / node 違反では対象ノード、tree 違反ではルートノード。 */
  nodeId?: string;
  /** field 違反のフィールドキー。 */
  fieldKey?: string;
  /** tree 違反のルートノード id。 */
  treeRootId?: string;
  /** 述語が例外を投げ評価できなかった場合 true。 */
  errored?: boolean;
}

export interface ConstraintReport {
  /** error-severity 違反がゼロなら true（= valid forest）。advisory は影響しない。 */
  ok: boolean;
  violations: ConstraintViolation[];
  /** nodeId -> 違反（field / node スコープ）。 */
  byNode: Map<string, ConstraintViolation[]>;
  /** `${nodeId}::${fieldKey}` -> 違反（field スコープ）。 */
  byField: Map<string, ConstraintViolation[]>;
  /** ルート id -> 違反（tree スコープ）。 */
  byTree: Map<string, ConstraintViolation[]>;
  /** forest スコープ違反。 */
  forest: ConstraintViolation[];
}

export function fieldViolationKey(nodeId: string, fieldKey: string): string {
  return `${nodeId}::${fieldKey}`;
}

function makeCtx(schema: Schema, roots: TreeNode[], index: TreeIndex): ConstraintCtx {
  const idOf = (x: string | TreeNode): string => (typeof x === "string" ? x : x.id);
  const subtreeNodes = (root: TreeNode): TreeNode[] => [root, ..._descendants(root)];
  let allNodes: TreeNode[] | null = null;
  return {
    schema,
    roots,
    index,
    ancestors: (x) => _ancestors(index, idOf(x)),
    descendants: (node) => _descendants(node),
    children: (node) => node.children,
    siblings: (x) => _siblings(index, idOf(x)),
    parent: (x) => getParent(index, idOf(x)),
    depth: (x) => _depth(index, idOf(x)),
    height: (node) => _height(node),
    typeOf: (node) => schema.nodeTypes[node.type],
    nodes: () => (allNodes ??= roots.flatMap(subtreeNodes)),
    subtreeNodes,
    validateField,
  };
}

/**
 * 木全体を schema の constraints（field / node / tree / forest）に照らして評価する。
 * 各述語は true で「満たす」。false または例外で違反を記録する。
 * 構造検証（validateTree）とは独立。違反ゼロなら valid forest。
 */
export function evaluateConstraints(doc: TreeDoc, schema: Schema): ConstraintReport {
  const index = buildIndex(doc.roots);
  const ctx = makeCtx(schema, doc.roots, index);
  const violations: ConstraintViolation[] = [];

  const push = (v: ConstraintViolation): void => {
    violations.push(v);
  };

  // --- field / node スコープ（全ノード走査） ---
  const visit = (node: TreeNode): void => {
    const t = schema.nodeTypes[node.type];
    if (t) {
      // field constraints（フィールドに attach）
      for (const f of t.fields) {
        const fc = f.constraints;
        if (!fc) continue;
        const fctx: FieldCtx = { ...ctx, node, field: f };
        for (const c of fc) {
          let ok = false;
          let errored = false;
          try {
            ok = c.check(node.fields[f.key], fctx) === true;
          } catch {
            errored = true;
          }
          if (!ok) push({ scope: "field", constraintId: c.id, message: c.message, severity: c.severity ?? "error", nodeId: node.id, fieldKey: f.key, errored });
        }
      }
      // node constraints（nodeType に attach）
      if (t.constraints) {
        for (const c of t.constraints) {
          let ok = false;
          let errored = false;
          try {
            ok = c.check(node, ctx) === true;
          } catch {
            errored = true;
          }
          if (!ok) push({ scope: "node", constraintId: c.id, message: c.message, severity: c.severity ?? "error", nodeId: node.id, errored });
        }
      }
    }
    for (const c of node.children) visit(c);
  };
  for (const r of doc.roots) visit(r);

  // --- schema 直下の node constraints（appliesTo で絞れる） ---
  const schemaNode = schema.constraints?.node;
  if (schemaNode && schemaNode.length) {
    for (const node of ctx.nodes()) {
      for (const c of schemaNode) {
        if (c.appliesTo && !c.appliesTo.includes(node.type)) continue;
        let ok = false;
        let errored = false;
        try {
          ok = c.check(node, ctx) === true;
        } catch {
          errored = true;
        }
        if (!ok) push({ scope: "node", constraintId: c.id, message: c.message, severity: c.severity ?? "error", nodeId: node.id, errored });
      }
    }
  }

  // --- tree スコープ（ルートごと） ---
  const treeC = schema.constraints?.tree;
  if (treeC && treeC.length) {
    for (const r of doc.roots) {
      for (const c of treeC) {
        let ok = false;
        let errored = false;
        try {
          ok = c.check(r, ctx) === true;
        } catch {
          errored = true;
        }
        if (!ok) push({ scope: "tree", constraintId: c.id, message: c.message, severity: c.severity ?? "error", nodeId: r.id, treeRootId: r.id, errored });
      }
    }
  }

  // --- forest スコープ（一度） ---
  const forestC = schema.constraints?.forest;
  if (forestC && forestC.length) {
    for (const c of forestC) {
      let ok = false;
      let errored = false;
      try {
        ok = c.check(doc.roots, ctx) === true;
      } catch {
        errored = true;
      }
      if (!ok) push({ scope: "forest", constraintId: c.id, message: c.message, severity: c.severity ?? "error", errored });
    }
  }

  // --- 索引化 ---
  const byNode = new Map<string, ConstraintViolation[]>();
  const byField = new Map<string, ConstraintViolation[]>();
  const byTree = new Map<string, ConstraintViolation[]>();
  const forest: ConstraintViolation[] = [];
  for (const v of violations) {
    if (v.scope === "forest") {
      forest.push(v);
    } else if (v.scope === "tree") {
      const k = v.treeRootId!;
      (byTree.get(k) ?? byTree.set(k, []).get(k)!).push(v);
    } else if (v.scope === "field") {
      const k = fieldViolationKey(v.nodeId!, v.fieldKey!);
      (byField.get(k) ?? byField.set(k, []).get(k)!).push(v);
      (byNode.get(v.nodeId!) ?? byNode.set(v.nodeId!, []).get(v.nodeId!)!).push(v);
    } else {
      (byNode.get(v.nodeId!) ?? byNode.set(v.nodeId!, []).get(v.nodeId!)!).push(v);
    }
  }

  // ok（valid forest）は error-severity の違反が無いこと。advisory はフラグのみで影響しない。
  return { ok: !violations.some((v) => v.severity === "error"), violations, byNode, byField, byTree, forest };
}
