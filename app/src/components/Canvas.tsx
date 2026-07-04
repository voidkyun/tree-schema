import { useCallback, useMemo, useState } from "react";
import { layoutTree, validateTree, type TreeNode } from "@tree-schema/core";
import { useEditor } from "../store";
import { useConstraintReport } from "../lib/useConstraints";
import { Edges } from "./Edges";
import { NodeCard } from "./NodeCard";

export function Canvas() {
  const { schema, roots, selId, select } = useEditor();
  const report = useConstraintReport();

  // 実測ノード高さ。NodeCard が報告 → レイアウト再計算（任意フィールド数で崩れない）。
  const [heights, setHeights] = useState<Map<string, number>>(new Map());
  const onMeasure = useCallback((id: string, h: number) => {
    setHeights((prev) => {
      if (prev.get(id) === h) return prev;
      const next = new Map(prev);
      next.set(id, h);
      return next;
    });
  }, []);

  const { positions, width, height } = useMemo(() => layoutTree(roots, { heights }), [roots, heights]);

  const leafBad = useMemo(() => {
    const issues = validateTree({ schemaId: schema.id, roots }, schema);
    return new Set(issues.filter((i) => i.code === "LEAF_NOT_TERMINAL").map((i) => i.nodeId));
  }, [roots, schema]);

  const all: TreeNode[] = [];
  const flatten = (n: TreeNode) => {
    all.push(n);
    n.children.forEach(flatten);
  };
  roots.forEach(flatten);

  return (
    <div className="stage" onClick={() => select(null)}>
      <div className="canvas" style={{ width, height }}>
        <Edges roots={roots} positions={positions} width={width} height={height} />
        {all.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          return (
            <NodeCard
              key={n.id}
              node={n}
              schema={schema}
              x={p.x}
              y={p.y}
              selected={n.id === selId}
              leafBad={leafBad.has(n.id)}
              violations={report.byNode.get(n.id) ?? []}
              treeViolations={report.byTree.get(n.id) ?? []}
              onMeasure={onMeasure}
              onClick={() => select(n.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
