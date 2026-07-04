# 設計依存検知ベンチ結果

データ: 73 件（設計依存=41 / 非依存=32）。日本語の要件文。
スコア = cos(text, designCentroid) − cos(text, bizCentroid)。

| 手法 | thr | Precision | Recall | F1 | Accuracy | TP/FP/FN/TN | load | /text |
|---|---|---|---|---|---|---|---|---|
| regex (現行) | - | 100.0% | 34.1% | 50.9% | 63.0% | 14/0/27/32 | 0.0s | 0.0ms |
| multilingual-e5-small @thr=0.005 | 0.005 | 100.0% | 92.7% | 96.2% | 95.9% | 38/0/3/32 | 0.8s | 1.7ms |
| multilingual-e5-small @best | -0.009 | 97.6% | 97.6% | 97.6% | 97.3% | 40/1/1/31 | 0.8s | 1.7ms |
| multilingual-e5-base @thr=0.005 | 0.005 | 100.0% | 97.6% | 98.8% | 98.6% | 40/0/1/32 | 1.1s | 3.8ms |
| multilingual-e5-base @best | -0.019 | 97.6% | 100.0% | 98.8% | 98.6% | 41/1/0/31 | 1.1s | 3.8ms |
