import type { Schema, TreeNode } from "@tree-schema/core";
import bdd from "./schemas/bdd";
import bddSrc from "./schemas/bdd.ts?raw";
import mtgProgress from "./schemas/mtg-progress";
import mtgProgressSrc from "./schemas/mtg-progress.ts?raw";
import mtgGeneral from "./schemas/mtg-general";
import mtgGeneralSrc from "./schemas/mtg-general.ts?raw";
import agentMemory from "./schemas/agent-memory";
import agentMemorySrc from "./schemas/agent-memory.ts?raw";

export interface BuiltinSchema {
  schema: Schema;
  /** Monaco 編集用ソース（schemas/*.ts の生テキスト）。constraints の関数本体を含む。 */
  source: string;
  seed: TreeNode[];
}

/** Schema オブジェクトから Monaco 編集用の TS ソースを生成する（constraints を持たない新規スキーマ用）。 */
export function schemaToSource(schema: Schema): string {
  return `import { defineSchema } from "@tree-schema/core";\n\nexport default defineSchema(${JSON.stringify(schema, null, 2)});\n`;
}

const node = (id: string, type: string, fields: Record<string, unknown>, children: TreeNode[] = []): TreeNode => ({
  id,
  type,
  fields,
  children,
});

// --- BDD Example Mapping（経費精算の申請と承認を1ストーリーとして完成させた例） ---
// Question は Rule の部分木として解決済み（open のまま残さない＝valid forest）。
const bddSeed: TreeNode[] = [
  node("bdd-s1", "Story", {
    title: "社員は立替経費を精算する",
    asA: "社員",
    iWant: "立て替えた費用を会社から払い戻してほしい",
    soThat: "自腹の持ち出しを残さないため",
    priority: "must",
    mock: "経費精算フローのモック",
  }, [
    node("bdd-r1", "Rule", { statement: "支払いを裏づける証憑のない経費は精算できない" }, [
      node("bdd-e1", "Example", { name: "証憑あり", given: "3,000円の書籍を立て替え、領収書がある", when: "精算を申請する", then: "申請が受理される" }),
      node("bdd-e2", "Example", { name: "証憑なし", given: "領収書を紛失した経費がある", when: "精算を申請する", then: "受理されず、証憑の提出を求められる" }),
    ]),
    node("bdd-r2", "Rule", { statement: "申請者は自分の申請を承認できない（職務分掌）" }, [
      node("bdd-e3", "Example", { name: "自己承認", given: "申請者と承認者が同一人物である", when: "自分の申請を承認しようとする", then: "承認は成立しない" }),
      // 問い → それに答える Rule → Example、という解決の形をそのまま構造で残す
      node("bdd-q2", "Question", { question: "承認者が長期不在のとき、代理承認は誰がどこまで担えるか？" }, [
        node("bdd-r2a", "Rule", { statement: "承認者が長期不在のときは、同等以上の権限を持つ別の承認者が代理で承認できる" }, [
          node("bdd-e7", "Example", { name: "代理承認", given: "承認者が長期不在で、同等の権限者がいる", when: "代理の権限者が承認する", then: "承認が成立する" }),
        ]),
      ]),
    ]),
    node("bdd-r3", "Rule", { statement: "承認できる金額には役職ごとに上限があり、超える分は上位者が承認する" }, [
      node("bdd-e4", "Example", { name: "上限内", given: "5万円の経費。上長の承認上限は10万円", when: "上長が承認する", then: "承認が成立する" }),
      node("bdd-e5", "Example", { name: "上限超過", given: "30万円の経費。上長の承認上限は10万円", when: "上長だけが承認する", then: "成立せず、さらに上位の承認が要る" }),
    ]),
    node("bdd-r4", "Rule", { statement: "経費が属する会計期間の締切を過ぎた申請は受け付けない" }, [
      node("bdd-e6", "Example", { name: "締切後", given: "3月度の経費。3月度の締切は4月5日", when: "4月10日に申請する", then: "当該期間の精算としては受け付けられない" }),
    ]),
    node("bdd-q1", "Question", { question: "外貨で支払った経費は、いつ時点のレートで円に換算するか？" }, [
      node("bdd-r1c", "Rule", { statement: "外貨で支払った経費は、支払日の為替レートで円に換算する" }, [
        node("bdd-e8", "Example", { name: "外貨換算", given: "外貨建ての経費があり、支払日のレートが定まっている", when: "精算額を確定する", then: "支払日のレートで換算した円額が精算額になる" }),
      ]),
    ]),
  ]),
];

// --- 進捗タスク確認MTG議事録 ---
const mtgProgressSeed: TreeNode[] = [
  node("mp-m1", "Meeting", { title: "スプリント12 進捗確認", date: "2026-06-19", facilitator: "スクラムマスター", attendees: "開発チーム / プロダクトオーナー" }, [
    node("mp-t1", "Task", { name: "ログインの実装", owner: "担当A", status: "順調" }, [
      node("mp-d1", "Decision", { decided: "外部アカウント連携は次スプリントへ分離する" }),
    ]),
    node("mp-t2", "Task", { name: "検索の性能改善", owner: "担当B", status: "停滞" }, [
      node("mp-b1", "Blocker", { what: "本番に近い件数のデータが用意できていない", needsHelpFrom: "インフラ担当" }),
      node("mp-a1", "Action", { action: "計測用のデータセットを用意する", owner: "担当C", due: "2026-06-25" }),
    ]),
    node("mp-t3", "Task", { name: "請求書の発行", owner: "担当A", status: "要注意" }, [
      node("mp-a2", "Action", { action: "端数処理の仕様を関係者に確認する", owner: "担当A", due: "2026-06-23" }),
    ]),
  ]),
];

// --- 汎用議事録 ---
const mtgGeneralSeed: TreeNode[] = [
  node("mg-m1", "Meeting", { title: "月次プロダクト定例", date: "2026-06-18", purpose: "今月のリリース範囲と主要な課題を合意する", attendees: "プロダクトオーナー / デザイナー / 開発 / QA" }, [
    node("mg-a1", "Agenda", { topic: "今月のリリース範囲" }, [
      node("mg-d1", "Decision", { decided: "機能Aを今月、機能Bを来月に回す" }),
      node("mg-ac1", "Action", { action: "リリース告知の下書きを作る", owner: "担当A", due: "2026-06-26" }),
    ]),
    node("mg-a2", "Agenda", { topic: "利用者からの不具合報告" }, [
      node("mg-n1", "Note", { note: "特定の条件でのみ再現するらしい" }),
      node("mg-q1", "Question", { question: "再現条件の情報が足りない。どう集める？", status: "open", answer: "" }),
    ]),
  ]),
];

// --- Memory for Coding Agent ---
const agentMemorySeed: TreeNode[] = [
  node("am-m1", "Memory", { project: "acme-web（例）" }, [
    node("am-area1", "Area", { name: "ビルドとツール" }, [
      node("am-f1", "Fact", { summary: "パッケージマネージャは pnpm", detail: "npm/yarn と混在すると lockfile が競合する", kind: "convention", source: "user-told", confidence: "high", url: "", lastChecked: "2026-06-15" }),
      node("am-f2", "Fact", { summary: "テストは vitest（watch は test:watch）", detail: "", kind: "convention", source: "inferred-from-code", confidence: "high", url: "", lastChecked: "2026-06-15" }),
    ]),
    node("am-area2", "Area", { name: "コード規約" }, [
      node("am-f3", "Fact", { summary: "日時は UTC で保持し、表示時に変換する", detail: "保存層にローカル時刻を入れない", kind: "convention", source: "docs", confidence: "medium", url: "", lastChecked: "2026-06-10" }),
    ]),
    node("am-area3", "Area", { name: "落とし穴" }, [
      node("am-f4", "Fact", { summary: "日時を含むテストは時刻を固定注入する", detail: "現在時刻に依存するとCIで時々落ちる（フレーキー）", kind: "pitfall", source: "user-told", confidence: "high", url: "", lastChecked: "2026-06-12" }),
    ]),
    node("am-area4", "Area", { name: "参照" }, [
      node("am-f5", "Fact", { summary: "アーキテクチャ概要図", detail: "全体構成と主要な境界", kind: "reference", source: "docs", confidence: "high", url: "https://example.com/architecture", lastChecked: "2026-06-01" }),
    ]),
  ]),
];

export const BUILTINS: BuiltinSchema[] = [
  { schema: bdd, source: bddSrc, seed: bddSeed },
  { schema: mtgProgress, source: mtgProgressSrc, seed: mtgProgressSeed },
  { schema: mtgGeneral, source: mtgGeneralSrc, seed: mtgGeneralSeed },
  { schema: agentMemory, source: agentMemorySrc, seed: agentMemorySeed },
];

export const DEFAULT_BUILTIN = BUILTINS[0]!;
