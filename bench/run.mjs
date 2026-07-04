// 設計依存検知のベンチ。regex / 小モデル(multilingual-e5-small) / 大モデル(multilingual-e5-base) を
// 同じデータセットで比較し、provider 差し替え（より大きなモデル/リモート）が要るかを判断する。
// 実行: NODE_PATH=<transformers の node_modules> node bench/run.mjs  （README 参照）
import { pipeline } from "@huggingface/transformers";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(here, "../app/src/designModel.json"), "utf8"));
const data = readFileSync(join(here, "dataset.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const texts = data.map((d) => d.text);
const labels = data.map((d) => d.label);

// 現行の regex ベースライン（bdd.ts の IMPL と同じ）
const IMPL = /(画面|ボタン|クリック|押下|タップ|スワイプ|モーダル|ダイアログ|ポップアップ|フォーム|プルダウン|ドロップダウン|チェックボックス|ラジオボタン|API|エンドポイント|データベース|テーブル|カラム|レコード|SQL|JSON|リクエスト|レスポンス|HTTP|URL|セッション|トークン|キャッシュ|バッチ|フロントエンド|バックエンド|サーバ|デプロイ|React|Vue)/i;

function metrics(preds) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  preds.forEach((p, i) => {
    const y = labels[i];
    if (p && y) tp++; else if (p && !y) fp++; else if (!p && y) fn++; else tn++;
  });
  const prec = tp / (tp + fp || 1), rec = tp / (tp + fn || 1);
  const f1 = (2 * prec * rec) / (prec + rec || 1), acc = (tp + tn) / preds.length;
  return { tp, fp, fn, tn, prec, rec, f1, acc };
}
const pct = (x) => (100 * x).toFixed(1);
const cos = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
// 最大類似度差: いずれかのアンカーへの最大 cos の差。重心差より margin が厚い。
const maxsim = (v, anchors) => Math.max(...anchors.map((a) => cos(v, a)));

const DTYPE = process.env.DTYPE || "q8"; // browser 既定に合わせる（量子化込みで honest に測る）
async function scoreModel(model) {
  const t0 = Date.now();
  const ex = await pipeline("feature-extraction", model, { dtype: DTYPE });
  const loadMs = Date.now() - t0;
  const embed = async (arr) => (await ex(arr.map((t) => cfg.queryPrefix + t), { pooling: "mean", normalize: true })).tolist();
  const dV = await embed(cfg.designAnchors);
  const bV = await embed(cfg.bizAnchors);
  const t1 = Date.now();
  const vecs = await embed(texts);
  const inferMs = Date.now() - t1;
  const scores = vecs.map((v) => maxsim(v, dV) - maxsim(v, bV));
  return { scores, loadMs, perTextMs: inferMs / texts.length };
}

// 閾値スイープで best F1 を探す
function sweep(scores) {
  let best = { thr: 0, f1: -1, m: null };
  const cands = [...new Set(scores.map((s) => Math.round(s * 1000) / 1000))].sort((a, b) => a - b);
  for (const thr of [-0.05, ...cands, 0.05]) {
    const m = metrics(scores.map((s) => s > thr));
    if (m.f1 > best.f1) best = { thr, f1: m.f1, m };
  }
  return best;
}

const rows = [];
// regex
{
  const m = metrics(texts.map((t) => IMPL.test(t)));
  rows.push({ name: "regex (現行)", thr: "-", ...m, loadMs: 0, perTextMs: 0 });
}
// 小・大モデル
for (const model of ["Xenova/multilingual-e5-small", "Xenova/multilingual-e5-base"]) {
  process.stderr.write(`\n[${model}] loading...\n`);
  try {
    const { scores, loadMs, perTextMs } = await scoreModel(model);
    const atDefault = metrics(scores.map((s) => s > cfg.threshold));
    const best = sweep(scores);
    if (model.includes("small")) {
      process.stderr.write("\n[e5-small 閾値スイープ]\n");
      for (const thr of [-0.01, 0, 0.005, 0.01, 0.015, 0.02, 0.025, 0.03]) {
        const m = metrics(scores.map((s) => s > thr));
        process.stderr.write(`  thr=${thr.toFixed(3)}  P=${pct(m.prec)} R=${pct(m.rec)} F1=${pct(m.f1)} FP=${m.fp} FN=${m.fn}\n`);
      }
    }
    rows.push({ name: `${model.split("/")[1]} @thr=${cfg.threshold}`, thr: cfg.threshold, ...atDefault, loadMs, perTextMs });
    rows.push({ name: `${model.split("/")[1]} @best`, thr: best.thr, ...best.m, loadMs, perTextMs });
  } catch (e) {
    rows.push({ name: model + " (失敗)", thr: "-", tp: 0, fp: 0, fn: 0, tn: 0, prec: 0, rec: 0, f1: 0, acc: 0, loadMs: 0, perTextMs: 0, err: String(e).slice(0, 120) });
  }
}

const N = data.length, pos = labels.filter((x) => x).length;
let md = `# 設計依存検知ベンチ結果\n\nデータ: ${N} 件（設計依存=${pos} / 非依存=${N - pos}）。日本語の要件文。\n`;
md += `スコア = cos(text, designCentroid) − cos(text, bizCentroid)。\n\n`;
md += `| 手法 | thr | Precision | Recall | F1 | Accuracy | TP/FP/FN/TN | load | /text |\n`;
md += `|---|---|---|---|---|---|---|---|---|\n`;
for (const r of rows) {
  md += `| ${r.name} | ${r.thr} | ${pct(r.prec)}% | ${pct(r.rec)}% | ${pct(r.f1)}% | ${pct(r.acc)}% | ${r.tp}/${r.fp}/${r.fn}/${r.tn} | ${(r.loadMs / 1000).toFixed(1)}s | ${r.perTextMs.toFixed(1)}ms |${r.err ? " " + r.err : ""}\n`;
}
console.log("\n" + md);
writeFileSync(join(here, "RESULTS.md"), md);
console.log("wrote bench/RESULTS.md");
