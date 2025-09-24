# Carbon Tracker API - 検証環境管理者アカウント作成ガイド

## 概要

このガイドでは、検証環境のAzure Table Storageに直接管理者アカウントを作成する方法を説明します。

## 前提条件

1. **Azure Storage アカウントへのアクセス権限**
   - 接続文字列（Connection String）が必要です
   - Table Storage への読み書き権限が必要です

2. **Python 3.7以上がインストールされていること**

3. **必要なライブラリがインストールされていること**
   ```bash
   pip install -r requirements_admin_script.txt
   ```

## セットアップ手順

### 1. Azure Storage 接続文字列の取得

Azure Portal で以下の手順で接続文字列を取得してください：

1. Azure Portal にログイン
2. ストレージアカウント（例：carbontrackerstorage）を選択
3. 「アクセスキー」をクリック
4. 「接続文字列」をコピー

接続文字列の例：
```
DefaultEndpointsProtocol=https;AccountName=carbontrackerstorage;AccountKey=your_key_here;EndpointSuffix=core.windows.net
```

### 2. 環境変数の設定

#### 方法1: 環境変数として設定
```bash
export AZURE_STORAGE_CONNECTION_STRING='DefaultEndpointsProtocol=https;AccountName=carbontrackerstorage;AccountKey=your_key_here;EndpointSuffix=core.windows.net'
```

#### 方法2: .envファイルを使用（推奨）
```bash
# env.exampleをコピー
cp env.example .env

# .envファイルを編集して接続文字列を設定
nano .env
```

.envファイルの内容：
```
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=carbontrackerstorage;AccountKey=your_key_here;EndpointSuffix=core.windows.net
```

#### 方法3: スクリプト実行時に設定
```bash
AZURE_STORAGE_CONNECTION_STRING='your_connection_string' python create_admin_user_staging.py
```

### 3. 管理者アカウントの作成

#### 対話式モード（推奨）
```bash
python create_admin_user_staging.py
```

#### 非対話式モード（自動実行）
```bash
python create_admin_user_staging.py --non-interactive
# または
python create_admin_user_staging.py -y
```

## デフォルトの管理者アカウント情報

- **ユーザー名**: `admin`
- **メールアドレス**: `admin@carbontracker.com`
- **パスワード**: `Admin123!@#`
- **名前**: `Admin`
- **姓**: `User`
- **権限**: `admin`

## 実行例

### 対話式モードでの実行例
```bash
$ python create_admin_user_staging.py
=== Carbon Tracker API - 検証環境管理者アカウント作成スクリプト ===

管理者アカウントの情報を入力してください（Enterでデフォルト値を使用）:

ユーザー名 [admin]: 
メールアドレス [admin@carbontracker.com]: 
パスワード [mU7@bpRet*Ud]: 
名前 [Admin]: 
姓 [User]: 

入力された情報:
  ユーザー名: admin
  メールアドレス: admin@carbontracker.com
  名前: Admin
  姓: User
  権限: admin

この情報で管理者アカウントを作成しますか？ (y/N): y
テーブルの確認中...
テーブル 'UsersTable' は既に存在します
パスワードをハッシュ化中...
管理者アカウントを作成中...
✅ 管理者アカウントが正常に作成されました！

作成されたアカウント情報:
  ユーザーID: 367ebb44-5f35-46ae-9cb9-23816155feda
  ユーザー名: admin
  メールアドレス: admin@carbontracker.com
  権限: admin

このアカウントでログインして、他のユーザーを作成できます。
🎉 管理者アカウントの作成が完了しました！
```

### 非対話式モードでの実行例
```bash
$ python create_admin_user_staging.py --non-interactive
=== Carbon Tracker API - 検証環境管理者アカウント作成スクリプト ===

管理者アカウントの情報を入力してください（Enterでデフォルト値を使用）:

非対話式モード: デフォルト値を使用します。

入力された情報:
  ユーザー名: admin
  メールアドレス: admin@carbontracker.com
  名前: Admin
  姓: User
  権限: admin

非対話式モード: 自動的に続行します。
テーブルの確認中...
テーブル 'UsersTable' は既に存在します
パスワードをハッシュ化中...
管理者アカウントを作成中...
✅ 管理者アカウントが正常に作成されました！

作成されたアカウント情報:
  ユーザーID: 367ebb44-5f35-46ae-9cb9-23816155feda
  ユーザー名: admin
  メールアドレス: admin@carbontracker.com
  権限: admin

このアカウントでログインして、他のユーザーを作成できます。
🎉 管理者アカウントの作成が完了しました！
```

## 作成後の手順

1. **管理者アカウントでログイン**
   - 作成されたアカウント情報を使用して、Carbon Tracker APIにログインします
   - ユーザー名: `admin`
   - パスワード: `Admin123!@#`

2. **他のユーザーの作成**
   - 管理者権限でログイン後、他のユーザーアカウントを作成できます

3. **セキュリティの向上**
   - 本番環境では、デフォルトのパスワードを変更することを強く推奨します

## トラブルシューティング

### Azure Storageに接続できない場合

```
❌ Azure Storageに接続できません
```

**解決方法:**
1. 接続文字列が正しいか確認
2. Azure Storage アカウントが存在するか確認
3. ネットワーク接続を確認
4. ファイアウォールの設定を確認

### 接続文字列が設定されていない場合

```
❌ 環境変数 AZURE_STORAGE_CONNECTION_STRING が設定されていません
```

**解決方法:**
1. 環境変数を設定
2. .envファイルを作成
3. スクリプト実行時に環境変数を指定

### bcryptライブラリがインストールされていない場合

```
エラー: bcrypt ライブラリがインストールされていません
```

**解決方法:**
```bash
pip install bcrypt
```

### テーブル作成に失敗する場合

```
エラー: テーブルの作成に失敗しました
```

**解決方法:**
1. Azure Storage アカウントの権限を確認
2. Table Storage が有効になっているか確認
3. 接続文字列の権限を確認

## セキュリティに関する注意事項

- **接続文字列の管理**: 接続文字列は機密情報です。安全に管理してください
- **パスワードの変更**: 本番環境では、デフォルトのパスワードを必ず変更してください
- **アクセス権限**: 必要最小限の権限のみを付与してください
- **ログの監視**: 管理者アカウントの作成ログを監視してください

## ファイル構成

- `create_admin_user_staging.py`: 検証環境用管理者アカウント作成スクリプト
- `requirements_admin_script.txt`: 必要なPythonライブラリ
- `env.example`: 環境変数設定例
- `STAGING_ADMIN_SETUP_README.md`: このガイド

## サポート

問題が発生した場合は、以下の情報を含めて報告してください：

1. エラーメッセージの全文
2. 実行環境（OS、Pythonバージョン）
3. Azure Storage アカウント名
4. 実行したコマンド
5. 接続文字列の形式（機密情報は除く）
