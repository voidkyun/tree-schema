import { useState } from "react";

interface Snippet {
  title: string;
  code: string;
}

const SNIPPETS: Snippet[] = [
  {
    title: "field constraint（value のみ）",
    code: `constraints: [
  { id: "name.snake", message: "snake_case", check: (v) => /^[a-z][a-z0-9_]*$/.test(String(v ?? "")) },
]`,
  },
  {
    title: "node constraint（node 内の field）",
    code: `constraints: [
  { id: "pk.notnull", message: "主キーは NOT NULL", check: (node) => !(node.fields.pk === true && node.fields.nullable === true) },
]`,
  },
  {
    title: "tree constraint（tree 内の node）",
    code: `constraints: {
  tree: [
    { id: "one.pk", message: "主キーは1つ",
      check: (root, ctx) => ctx.descendants(root).filter((n) => n.fields.pk === true).length === 1 },
  ],
}`,
  },
  {
    title: "forest constraint（全体）",
    code: `constraints: {
  forest: [
    { id: "uniq", message: "名前は一意",
      check: (roots) => new Set(roots.map((r) => r.fields.name)).size === roots.length },
  ],
}`,
  },
];

const CTX = [
  ["ancestors(id｜node)", "自分→root の祖先（自分を含まない）"],
  ["descendants(node)", "全子孫（pre-order）"],
  ["children(node)", "直接の子"],
  ["siblings(id｜node)", "兄弟（自分を含まない）"],
  ["parent(id｜node)", "親（無ければ null）"],
  ["depth(id｜node)", "root からの深さ（root=0）"],
  ["height(node)", "部分木の高さ（葉=0）"],
  ["typeOf(node)", "node の型定義（NodeType）"],
  ["nodes()", "forest 全ノード"],
  ["subtreeNodes(root)", "その木の node（root を含む）"],
  ["roots / index / schema", "forest のルート / 親引き index / スキーマ"],
];

/** スキーマエディタ右の折り畳みリファレンス。constraints の述語 API と ctx を一覧する。 */
export function SchemaReference() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="se-ref closed">
        <button className="reftoggle" onClick={() => setOpen(true)} title="リファレンスを開く">
          ◀ ref
        </button>
      </div>
    );
  }

  return (
    <div className="se-ref">
      <div className="refhead">
        <b>constraints リファレンス</b>
        <button className="reftoggle" onClick={() => setOpen(false)} title="閉じる">
          ▶
        </button>
      </div>
      <div className="refbody">
        <div className="refsect">スコープ別スニペット</div>
        {SNIPPETS.map((s) => (
          <div className="refsnip" key={s.title}>
            <div className="refsniptitle">{s.title}</div>
            <pre>{s.code}</pre>
          </div>
        ))}
        <div className="refsect">ctx ユーティリティ（述語の第2引数）</div>
        <table className="reftable">
          <tbody>
            {CTX.map(([sig, desc]) => (
              <tr key={sig}>
                <td><code>{sig}</code></td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">true で満たす、false / 例外で違反。</p>
      </div>
    </div>
  );
}
