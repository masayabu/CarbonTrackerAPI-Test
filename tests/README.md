# テストディレクトリ

このディレクトリには、CarbonTrackerAPIのテストファイルが含まれています。

## ディレクトリ構造

```
tests/
├── api/                    # APIテストファイル
│   ├── test_auth.js        # 認証システムテスト
│   └── test_yearly_report_2023.js  # 年次レポートAPIテスト
├── utils/                  # テストユーティリティ
│   └── run_yearly_report_test.js   # 年次レポートテスト実行スクリプト
└── README.md               # このファイル
```

## テストの実行方法

### 認証システムテスト
```bash
npm run test:auth
```

### 年次レポートAPIテスト
```bash
npm run test:yearly-report
```

### 個別テストの実行
```bash
# 認証テスト
node tests/api/test_auth.js

# 年次レポートテスト
node tests/utils/run_yearly_report_test.js
```

## テストファイルの説明

### APIテスト (`tests/api/`)

- **`test_auth.js`**: JWT認証システムのテスト
  - ログイン機能のテスト
  - 認証が必要なAPIのテスト
  - 認証なしアクセスのテスト

- **`test_yearly_report_2023.js`**: GetYearlyReport APIのテスト
  - 2023年データの取得テスト
  - 無効なパラメータのテスト
  - レスポンス形式の検証

### テストユーティリティ (`tests/utils/`)

- **`run_yearly_report_test.js`**: 年次レポートテストの実行スクリプト
  - テストの実行とエラーハンドリング
  - 適切な終了コードの設定

## テストの前提条件

1. Azure Functionsが起動していること
2. 必要なデータがデータベースに存在すること
3. 適切な環境設定が完了していること

## トラブルシューティング

### よくある問題

1. **接続エラー**
   - Azure Functionsが起動しているか確認
   - ポート設定を確認

2. **データが見つからない**
   - テスト用データが作成されているか確認
   - データベース接続を確認

3. **認証エラー**
   - テストユーザーが作成されているか確認
   - JWT設定を確認

## 新しいテストの追加

新しいAPIテストを追加する場合は、以下の構造に従ってください：

1. `tests/api/` にテストファイルを配置
2. 必要に応じて `tests/utils/` に実行スクリプトを配置
3. `package.json` にnpmスクリプトを追加
4. 適切なドキュメントを作成

## 関連ドキュメント

- [年次レポートテスト詳細](../docs/tests/YEARLY_REPORT_TEST_README.md)
- [認証システムテスト詳細](../docs/tests/AUTH_TEST_README.md) (作成予定)
