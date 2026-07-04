# tree-schema

型付き木エディタ。スキーマ（typed node + constraints）が、編集できる木の構造と妥当性を強制する。

- 公開アプリ: https://voidkyun.github.io/tree-schema/
- 配布ライブラリ `@tree-schema/core`: スキーマを TypeScript で書くための型とグラフユーティリティ（ランタイム依存ゼロ）

## 構成

pnpm モノレポ。

- リポジトリのルート = 配布ライブラリ `@tree-schema/core`
- `app/` = Vite + React の Web アプリ（`@tree-schema/core` を使う）

## スキーマを書く

main の HEAD を直接参照する（バージョニングはしない）。

```bash
npm i github:voidkyun/tree-schema
```

```ts
import { defineSchema } from "@tree-schema/core";

export default defineSchema({
  id: "example",
  name: "例",
  rootTypes: ["Root"],
  nodeTypes: {
    Root: { label: "Root", color: "#c3ccd5", terminal: false, children: ["Leaf"],
            fields: [{ key: "name", label: "名前", type: "text" }] },
    Leaf: { label: "Leaf", color: "#99e0a2", terminal: true, children: [],
            fields: [{ key: "value", label: "値", type: "text" }] },
  },
  invariants: { leafMustBeTerminal: true },
});
```

`children` / `rootTypes` に未定義の型名を書くと即座に型エラーになる（補完も効く）。`defineSchema` の全項目（field の型・constraints 等）は `@tree-schema/core` の型定義で確認できる。

## 開発

```bash
corepack enable
pnpm install
pnpm build          # 配布ライブラリを dist/ にビルド
pnpm test           # 単体テスト
pnpm app:dev        # Web アプリを起動
```
