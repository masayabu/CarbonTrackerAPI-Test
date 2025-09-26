# CreateProductionSum API テスト

このテストは、CreateProductionSum APIの機能を検証します。

## テスト内容

### 1. 基本機能テスト
- ProductionTableからデータを取得
- 年、groupId、materialTypeでグループ化
- 指定された項目の合計計算

### 2. 計算ロジックテスト
- **carbonContent量の計算**: `charcoalProduced * carbonContentFactors[materialType]`
- **co2Reduction量の計算**: `carbonContent * co2ConversionFactor`
- **ipccLongTerm量の計算**: `co2Reduction * ipccLongTermFactors[materialType]`

### 3. データ処理テスト
- テーブルの自動作成
- 既存データの洗い替え
- 新しいデータの保存

## テストデータ

### Productionデータ
- 2025年のbamboo、pruning、herbaceous材料
- 2024年のherbaceous材料（年跨ぎテスト）
- 異なるgroupIdでのデータ

### 計算設定
```json
{
  "carbonContentFactors": {
    "bamboo": 0.8,
    "pruning": 0.8,
    "herbaceous": 0.65,
    "other": 0.8
  },
  "co2ConversionFactor": 3.67,
  "ipccLongTermFactors": {
    "bamboo": 0.8,
    "pruning": 0.8,
    "herbaceous": 0.65,
    "other": 0.8
  }
}
```

## 実行方法

### 環境変数の設定
```bash
export API_BASE_URL="http://localhost:7071/api"
export TEST_USER_EMAIL="test@example.com"
export TEST_USER_PASSWORD="password123"
export TEST_GROUP_ID="test-group-123"
```

### テスト実行
```bash
cd /Users/yama/code/CarbonTrackerAPI-Test/scripts/test
node test_create_production_sum.js
```

## 期待される結果

### 1. グループ化結果
- 年ごと、groupIdごと、materialTypeごとにグループ化
- 各グループでmaterialAmount、charcoalProduced、charcoalVolumeの合計

### 2. 計算結果の例
**bamboo材料（charcoalProduced: 110）の場合:**
- carbonContent = 110 * 0.8 = 88
- co2Reduction = 88 * 3.67 = 322.96
- ipccLongTerm = 322.96 * 0.8 = 258.368

**herbaceous材料（charcoalProduced: 30）の場合:**
- carbonContent = 30 * 0.65 = 19.5
- co2Reduction = 19.5 * 3.67 = 71.565
- ipccLongTerm = 71.565 * 0.65 = 46.51725

## 検証項目

1. **認証**: JWTトークンの取得と使用
2. **データ作成**: テスト用Productionデータの作成
3. **設定アップロード**: 計算設定のアップロード
4. **API実行**: CreateProductionSum APIの実行
5. **結果検証**: 計算結果の正確性チェック
6. **エラーハンドリング**: 異常系の処理確認

## トラブルシューティング

### よくある問題
1. **認証エラー**: テストユーザーの作成とパスワード確認
2. **データベースエラー**: Azure Storage接続の確認
3. **計算エラー**: 設定ファイルの形式確認

### ログ確認
テスト実行時の詳細ログを確認して、どの段階でエラーが発生しているかを特定してください。

## 注意事項

- テスト実行前に、テスト用のユーザーとグループが作成されている必要があります
- テスト実行後、ProductionTableにテストデータが残る可能性があります
- 本番環境では絶対に実行しないでください
