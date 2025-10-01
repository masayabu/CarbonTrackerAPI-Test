# GetYearlyReport API 2025年テストガイド

このドキュメントでは、GetYearlyReport APIの2025年データ取得テスト（特に2025年10月）の実行方法について説明します。

## 概要

`test_yearly_report_2025.js` は、GetYearlyReport APIが2025年のデータを正しく取得できるかをテストするスクリプトです。特に2025年10月のデータに焦点を当てています。

## テスト内容

### 1. 2025年年次レポート取得テスト
- 2025年のデータが正しく取得できるか
- レスポンス形式が正しいか（12ヶ月分のデータ）
- 各月のデータ構造が正しいか
- データの合計値が正しく計算されているか

### 2. 無効な年パラメータテスト
- 無効な年パラメータ（文字列、小数、空文字など）が正しく拒否されるか
- 適切なエラーレスポンス（400 Bad Request）が返されるか

### 3. 存在しない年のテスト
- 存在しない年のリクエストが適切に処理されるか
- 空のデータ（すべて0）が返されるか

### 4. レスポンス形式検証
- 各月のデータに必須フィールドが含まれているか
- データ型が正しいか（数値型）
- 負の値が含まれていないか

### 5. 2025年10月のデータ検証
- 2025年10月に登録されたデータが正しく取得できるか
- 10月のデータが年次レポートに正しく反映されているか
- 10月のデータの詳細検証（データ型、値の妥当性）

## 実行方法

### 前提条件
1. Azure Functionsが起動していること
2. データベースに2025年のデータが存在すること（テスト用データ）
3. 2025年10月のデータが登録されていること

### テストデータの準備

#### 方法1: Pythonスクリプトを使用（推奨）
```bash
# 環境変数を設定
export AZURE_STORAGE_CONNECTION_STRING='your_connection_string'

# テストデータを作成
python scripts/test/create_test_data_2025_10.py
```

#### 方法2: 手動でデータを作成
Azure Table Storageの`ProductionTable`に以下のようなデータを手動で追加：

```json
{
  "PartitionKey": "Production",
  "RowKey": "unique-id",
  "date": "2025-10-01T09:00:00Z",
  "bambooAmount": 100.0,
  "charcoalProduced": 25.0,
  "charcoalVolume": 0.5,
  "co2Reduction": 73.5,
  "materialType": "bamboo",
  "groupId": "test-group-1",
  "userId": "test-user-1"
}
```

### テスト実行

#### 方法1: npmスクリプトを使用
```bash
npm run test:yearly-report-2025
```

#### 方法2: 直接実行
```bash
node tests/utils/run_yearly_report_test_2025.js
```

#### 方法3: テストファイルを直接実行
```bash
node tests/api/test_yearly_report_2025.js
```

## テスト結果の解釈

### 成功の場合
```
🎉 すべてのテストが成功しました！GetYearlyReport APIは2025年データを正しく処理しています。
```

### 失敗の場合
```
⚠️ 一部のテストが失敗しました。APIの実装を確認してください。
```

## 期待されるレスポンス形式

```json
[
  {
    "month": 1,
    "totalBamboo": 0,
    "charcoalProduced": 0,
    "charcoalVolume": 0,
    "totalCO2Reduction": 0
  },
  {
    "month": 2,
    "totalBamboo": 0,
    "charcoalProduced": 0,
    "charcoalVolume": 0,
    "totalCO2Reduction": 0
  },
  // ... 10月のデータ
  {
    "month": 10,
    "totalBamboo": 570.0,
    "charcoalProduced": 142.5,
    "charcoalVolume": 2.85,
    "totalCO2Reduction": 419.0
  },
  // ... 12月まで
]
```

## トラブルシューティング

### よくある問題

1. **接続エラー**
   - Azure Functionsが起動しているか確認
   - ポート7071が使用可能か確認

2. **データが見つからない**
   - データベースに2025年のデータが存在するか確認
   - 2025年10月のデータが登録されているか確認
   - テスト用データを作成する

3. **認証エラー**
   - GetYearlyReport APIは認証不要（authLevel: "anonymous"）
   - 他のAPIとの混同がないか確認

### デバッグ方法

1. ログを確認する
2. データベースの内容を確認する
3. APIの実装を確認する

## 関連ファイル

- `tests/api/test_yearly_report_2025.js` - メインテストファイル
- `tests/utils/run_yearly_report_test_2025.js` - テスト実行スクリプト
- `scripts/test/create_test_data_2025_10.py` - テストデータ作成スクリプト
- `src/functions/GetYearlyReport/index.ts` - API実装
- `package.json` - npmスクリプト設定

## 注意事項

- このテストは2025年のデータに特化しています
- 他の年のテストが必要な場合は、スクリプトを修正してください
- 本番環境でテストを実行する場合は、適切なURLに変更してください
- テストデータは本番データと混在しないよう注意してください

## 実行例

```bash
# 1. テストデータを作成
export AZURE_STORAGE_CONNECTION_STRING='your_connection_string'
python scripts/test/create_test_data_2025_10.py

# 2. Azure Functionsを起動
npm run dev

# 3. テストを実行
npm run test:yearly-report-2025
```

## 成功時の出力例

```
🚀 GetYearlyReport APIの2025年データ取得テストを開始します

📊 2025年の年次レポート取得テストを開始...
✅ 2025年の年次レポート取得成功
✅ データ形式が正しい（12ヶ月分のデータ）
✅ 全月のデータ構造が正しい
📈 2025年の合計値:
  - 竹材量: 570
  - 炭生産量: 142.5
  - CO2削減量: 419

📅 2025年10月のデータ検証テストを開始...
✅ 10月のデータが正しく取得されました
✅ 2025年10月のデータが10月の合計に反映されています
✅ 10月のデータが妥当な値です

📊 テスト結果サマリー:
2025年年次レポート取得: ✅ 成功
レスポンス形式検証: ✅ 成功
無効な年パラメータテスト: ✅ 実行済み
存在しない年のテスト: ✅ 成功
2025年10月データ検証: ✅ 成功
10月データ詳細検証: ✅ 成功

🎯 総合結果: 6/6 のテストが成功

🎉 すべてのテストが成功しました！GetYearlyReport APIは2025年データを正しく処理しています。
```
