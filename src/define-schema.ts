import type { Schema } from "./types";

/**
 * スキーマ定義ヘルパー。実体は identity 関数だが、`const TypeName` 推論により
 * `nodeTypes` のキーから型名を確定させ、`rootTypes` / `children` が未定義の型名を
 * 参照していると型エラーになる。これが「型自体がフールプルーフ」の核で、
 * エディタ（Monaco）上でタイポが即エラー・補完候補も型名に絞られる。
 */
export function defineSchema<const TypeName extends string>(
  schema: Schema<TypeName>,
): Schema<TypeName> {
  return schema;
}
