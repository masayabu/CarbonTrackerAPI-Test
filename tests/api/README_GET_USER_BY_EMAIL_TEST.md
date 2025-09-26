# GetUserByEmail API テスト

このディレクトリには、GetUserByEmail APIのテストコードが含まれています。

## テスト概要

GetUserByEmail APIは、メールアドレスからユーザーのRowKey（UUID）を取得するAPIです。

**エンドポイント**: `GET /api/users/email/{email}`

## テスト内容

### 1. 成功ケース
- 存在するメールアドレス（`test@example.com`）でAPIを呼び出し
- 正しいRowKeyとユーザー情報が返されることを確認

### 2. 存在しないメールアドレス
- 存在しないメールアドレスでAPIを呼び出し
- 404エラーが返されることを確認

### 3. 無効なメールアドレス
- 空のメールアドレスでAPIを呼び出し
- 400エラーが返されることを確認

### 4. CORSヘッダー
- レスポンスヘッダーにCORS設定が含まれていることを確認

### 5. OPTIONSリクエスト
- プリフライトリクエストが正しく処理されることを確認

## テスト実行方法

### 前提条件
1. Azure Functions Core Toolsがインストールされている
2. Azurite（ローカル開発用Azure Storage）が起動している
3. テスト用ユーザー（`test@example.com`）が既に作成されている

### 1. Azure Functionsの起動
```bash
# プロジェクトルートで実行
func start
```

### 3. テストの実行
```bash
# テストディレクトリで実行
cd tests/api
node test_get_user_by_email.js
```

## 期待される結果

```
🚀 GetUserByEmail APIのテストを開始します

🔍 GetUserByEmail APIテスト（成功ケース）を開始...
✅ GetUserByEmail APIが正常に動作しました
RowKey: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Email: test@example.com
Name: ユーザーテスト
Role: viewer
Active: true
✅ レスポンスデータが正しく返されています

🔍 GetUserByEmail APIテスト（存在しないメールアドレス）を開始...
✅ 存在しないメールアドレスに対して正しく404が返されました

🔍 GetUserByEmail APIテスト（無効なメールアドレス）を開始...
✅ 無効なメールアドレスに対して正しく400が返されました

🌐 CORSヘッダーのテストを開始...
✅ CORSヘッダーが正しく設定されています

🔧 OPTIONSリクエストのテストを開始...
✅ OPTIONSリクエストが正しく処理されました

📊 テスト結果サマリー:
成功ケース: ✅
存在しないメール: ✅
無効なメール: ✅
CORSヘッダー: ✅
OPTIONSリクエスト: ✅

📈 テスト結果: 5/5 成功

🎉 すべてのテストが成功しました！GetUserByEmail APIは正しく動作しています。
```

## トラブルシューティング

### テスト用ユーザーが存在しない場合
```bash
# Azuriteが起動しているか確認
azurite --version

# Azuriteを起動
azurite --silent --location c:\azurite --debug c:\azurite\debug.log

# テスト用ユーザーを作成
cd scripts/test
python create_test_user.py
```

### APIが応答しない場合
```bash
# Azure Functionsが起動しているか確認
func start

# 別のターミナルでテストを実行
node test_get_user_by_email.js
```

### CORSエラーが発生する場合
- `config.ts`の`corsOrigins`設定を確認
- テスト実行時のOriginヘッダーを確認

## テストデータ

テストで使用されるサンプルメールアドレス: `test@example.com`

このメールアドレスは、`scripts/test/create_test_user.py`で作成されるテストユーザーのメールアドレスです。
