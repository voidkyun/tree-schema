import type { TreeNode } from "@tree-schema/core";

interface Props {
  roots: TreeNode[];
  positions: Map<string, { x: number; y: number; h: number }>;
  width: number;
  height: number;
}

export function Edges({ roots, positions, width, height }: Props) {
  const paths: string[] = [];
  const walk = (n: TreeNode): void => {
    const p = positions.get(n.id);
    if (p) {
      for (const c of n.children) {
        const cp = positions.get(c.id);
        if (!cp) continue;
        const y1 = p.y + p.h;
        const my = y1 + (cp.y - y1) / 2;
        paths.push(`M${p.x},${y1} V${my} H${cp.x} V${cp.y - 8}`);
      }
    }
    n.children.forEach(walk);
  };
  roots.forEach(walk);

  return (
    <svg className="edges" width={width} height={height}>
      <defs>
        <marker id="arr" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L6,3 L0,6 Z" fill="#9aa4ad" />
        </marker>
      </defs>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#9aa4ad" strokeWidth={1.6} markerEnd="url(#arr)" />
      ))}
    </svg>
  );
}
