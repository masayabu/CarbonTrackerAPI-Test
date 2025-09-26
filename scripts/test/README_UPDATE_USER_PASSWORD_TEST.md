# UpdateUserPassword API テスト

このドキュメントは、UpdateUserPassword APIのテスト方法について説明します。

## 概要

UpdateUserPassword APIは、ユーザーのパスワードを安全に更新するためのAPIです。以下の機能をテストします：

- 自分のパスワード更新（正常ケース）
- 管理者による他ユーザーのパスワード更新
- バリデーション機能
- 認証・認可機能
- エラーハンドリング

## テストファイル

- `test_update_user_password.js` - メインテストファイル

## 前提条件

### 1. 環境設定

以下の環境変数を設定してください：

```bash
export API_BASE_URL="http://localhost:7071/api"
export TEST_USER_EMAIL="test@example.com"
export TEST_USER_PASSWORD="testpassword"
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="adminpassword"
```

### 2. テストユーザーの準備

テストを実行する前に、以下のユーザーがデータベースに存在する必要があります：

- **テストユーザー**: `test@example.com` (パスワード: `testpassword`, 権限: `user`)
- **管理者ユーザー**: `admin@example.com` (パスワード: `adminpassword`, 権限: `admin`)

これらのユーザーは `create_test_user.py` スクリプトで作成できます。

### 3. Azure Functions の起動

ローカル開発環境でAzure Functionsを起動してください：

```bash
func start
```

## テストの実行

### 基本的な実行方法

```bash
cd /Users/yama/code/CarbonTrackerAPI-Test/scripts/test
node test_update_user_password.js
```

### 環境変数を指定して実行

```bash
API_BASE_URL="http://localhost:7071/api" \
TEST_USER_EMAIL="test@example.com" \
TEST_USER_PASSWORD="testpassword" \
ADMIN_EMAIL="admin@example.com" \
ADMIN_PASSWORD="adminpassword" \
node test_update_user_password.js
```

## テストケース

### 1. 正常ケース

#### 1.1 自分のパスワード更新
- **テスト内容**: ユーザーが自分のパスワードを更新
- **リクエスト**: 
  ```json
  {
    "currentPassword": "testpassword",
    "newPassword": "newtestpassword123"
  }
  ```
- **期待結果**: 200 OK - パスワード更新成功

#### 1.2 新しいパスワードでログイン
- **テスト内容**: 更新されたパスワードでログイン
- **期待結果**: 200 OK - ログイン成功

#### 1.3 管理者による他ユーザーのパスワード更新
- **テスト内容**: 管理者が他ユーザーのパスワードを更新
- **リクエスト**:
  ```json
  {
    "newPassword": "adminupdatedpassword123"
  }
  ```
- **期待結果**: 200 OK - パスワード更新成功

#### 1.4 管理者が更新したパスワードでログイン
- **テスト内容**: 管理者が更新したパスワードでログイン
- **期待結果**: 200 OK - ログイン成功

### 2. エラーケース

#### 2.1 間違った現在のパスワード
- **テスト内容**: 間違った現在のパスワードで更新を試行
- **リクエスト**:
  ```json
  {
    "currentPassword": "wrongpassword",
    "newPassword": "anothernewpassword123"
  }
  ```
- **期待結果**: 400 Bad Request - "Current password is incorrect"

#### 2.2 短いパスワード（バリデーションエラー）
- **テスト内容**: 8文字未満のパスワードで更新を試行
- **リクエスト**:
  ```json
  {
    "currentPassword": "newtestpassword123",
    "newPassword": "123"
  }
  ```
- **期待結果**: 400 Bad Request - "New password must be at least 8 characters long"

#### 2.3 権限のないユーザーによる他ユーザーのパスワード更新
- **テスト内容**: 一般ユーザーが他ユーザーのパスワードを更新
- **期待結果**: 403 Forbidden - "Forbidden: You can only update your own password or need admin/operator role"

#### 2.4 トークンなしでの更新（認証エラー）
- **テスト内容**: 認証トークンなしでパスワード更新
- **期待結果**: 401 Unauthorized - "Unauthorized: Missing token"

## テスト結果の解釈

### 成功パターン
```
✅ 自分のパスワード更新（正常ケース） - 成功
✅ 新しいパスワードでログイン - 成功
✅ 管理者による他ユーザーのパスワード更新 - 成功
✅ 管理者が更新したパスワードでログイン - 成功
✅ 間違った現在のパスワードで更新 - 成功
✅ 短いパスワードで更新（バリデーションエラー） - 成功
✅ 権限のないユーザーによる他ユーザーのパスワード更新 - 成功
✅ トークンなしでの更新（認証エラー） - 成功
```

### 失敗パターン
```
❌ 自分のパスワード更新（正常ケース） - 失敗
❌ 新しいパスワードでログイン - 失敗
```

## トラブルシューティング

### 1. 認証エラー
- **問題**: テストユーザーまたは管理者の認証に失敗
- **解決方法**: 
  - ユーザーがデータベースに存在するか確認
  - `create_test_user.py` を実行してユーザーを作成
  - メールアドレスとパスワードが正しいか確認

### 2. API接続エラー
- **問題**: APIサーバーに接続できない
- **解決方法**:
  - Azure Functionsが起動しているか確認 (`func start`)
  - `API_BASE_URL` が正しいか確認
  - ポート番号が正しいか確認

### 3. 権限エラー
- **問題**: 管理者権限がない
- **解決方法**:
  - 管理者ユーザーが正しく作成されているか確認
  - ユーザーの権限（role）が `admin` になっているか確認

### 4. データベースエラー
- **問題**: ユーザー情報の取得に失敗
- **解決方法**:
  - Azuriteが起動しているか確認
  - データベース接続設定を確認
  - テーブルが正しく作成されているか確認

## セキュリティテスト

このテストは以下のセキュリティ機能を検証します：

1. **認証**: JWTトークンによる認証
2. **認可**: ユーザー権限による認可
3. **パスワードハッシュ化**: bcryptjsによる安全なハッシュ化
4. **バリデーション**: パスワード長の検証
5. **現在のパスワード確認**: 本人確認

## 注意事項

- テスト実行前に必ずテストユーザーを作成してください
- 本番環境では絶対に実行しないでください
- テスト実行後は、必要に応じてテストデータをクリーンアップしてください
- パスワードは適切にハッシュ化されて保存されます

## 関連ファイル

- `src/functions/UpdateUserPassword/index.ts` - メインAPI実装
- `src/index.ts` - API登録
- `scripts/test/create_test_user.py` - テストユーザー作成スクリプト
- `scripts/admin/create_admin_user.py` - 管理者ユーザー作成スクリプト
