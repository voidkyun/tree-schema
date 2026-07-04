import cfg from "../designModel.json";

export interface JudgeResult {
  /** 設計依存の疑いがあるか。 */
  flagged: boolean;
  /** cos(text, 設計重心) − cos(text, 業務重心)。大きいほど設計依存寄り。 */
  score: number;
}

/** 設計依存の判定器。in-browser local（既定）と、将来差し替える remote provider が同じ口を実装する。 */
export interface DesignJudge {
  classify(texts: string[]): Promise<JudgeResult[]>;
}

const cos = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + x * b[i]!, 0);
/** いずれかのアンカーへの最大類似度。重心平均より signal が薄まらず margin が厚い。 */
const maxSim = (v: number[], anchors: number[][]): number => Math.max(...anchors.map((a) => cos(v, a)));

let judgeP: Promise<DesignJudge> | null = null;

/** 既定の判定器（in-browser）。初回呼び出しでモデルを遅延ロードする。 */
export function getDesignJudge(): Promise<DesignJudge> {
  return (judgeP ??= createLocalJudge());
}

/**
 * transformers.js（multilingual-e5-small）で文埋め込みを作り、
 * 設計アンカー重心と業務アンカー重心への近さの差をスコアにする。
 * モデルは HF Hub から初回 DL（量子化 ONNX 約120MB）→以後キャッシュ。bench/ で精度を計測済み。
 */
async function createLocalJudge(): Promise<DesignJudge> {
  const { pipeline } = await import("@huggingface/transformers");
  const extractor = await pipeline("feature-extraction", cfg.model);

  const embed = async (arr: string[]): Promise<number[][]> => {
    const out = await extractor(arr.map((t) => cfg.queryPrefix + t), { pooling: "mean", normalize: true });
    return out.tolist() as number[][];
  };

  const dV = await embed(cfg.designAnchors);
  const bV = await embed(cfg.bizAnchors);
  const cache = new Map<string, JudgeResult>();

  return {
    async classify(texts) {
      const miss = [...new Set(texts.filter((t) => t.trim() !== "" && !cache.has(t)))];
      if (miss.length) {
        const vs = await embed(miss);
        miss.forEach((t, i) => {
          const score = maxSim(vs[i]!, dV) - maxSim(vs[i]!, bV);
          if ((globalThis as { __designDebug?: boolean }).__designDebug) console.log(`[judge] ${score.toFixed(3)}  ${t.slice(0, 30)}`);
          cache.set(t, { flagged: score > cfg.threshold, score });
        });
      }
      return texts.map((t) => (t.trim() === "" ? { flagged: false, score: 0 } : cache.get(t)!));
    },
  };
}
