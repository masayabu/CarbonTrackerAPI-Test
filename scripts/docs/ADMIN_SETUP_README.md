# Carbon Tracker API - 管理者アカウント作成ガイド

## 概要

このガイドでは、データベースにユーザーアカウントが存在しない場合に、管理者アカウントを直接Azure Table Storageに作成する方法を説明します。

## クイックスタート

1. **Azuriteを起動**
   ```bash
   cd /path/to/azurite
   azurite
   ```

2. **依存関係をインストール**
   ```bash
   pip install -r requirements_admin_script.txt
   ```

3. **管理者アカウントを作成**
   ```bash
   python create_admin_user.py --non-interactive
   ```

4. **ログイン**
   - ユーザー名: `admin`
   - パスワード: `admin123`

## 前提条件

1. **Azuriteが起動していること**
   - ローカル環境でAzuriteを起動:
     ```bash
     # 特定のフォルダに移動してAzuriteを起動
     cd /path/to/azurite
     azurite
     ```
   - Dockerを使用している場合:
     ```bash
     docker run -d -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite
     ```
   - Azure Functions Core Toolsを使用している場合:
     ```bash
     func start
     ```

2. **Python 3.7以上がインストールされていること**

## セットアップ手順

### 1. 依存関係のインストール

```bash
pip install -r requirements_admin_script.txt
```

### 2. 管理者アカウントの作成

#### 対話式モード（推奨）
```bash
python create_admin_user.py
```

#### 非対話式モード（自動実行）
```bash
python create_admin_user.py --non-interactive
# または
python create_admin_user.py -y
```

### 3. スクリプトの実行

#### 対話式モードの場合
スクリプトを実行すると、以下の情報の入力を求められます：

- **ユーザー名**: 管理者のユーザー名（デフォルト: `admin`）
- **メールアドレス**: 管理者のメールアドレス（デフォルト: `admin@carbontracker.local`）
- **パスワード**: 管理者のパスワード（デフォルト: `admin123`）
- **名前**: 管理者の名前（デフォルト: `Admin`）
- **姓**: 管理者の姓（デフォルト: `User`）

各項目でEnterキーを押すと、デフォルト値が使用されます。

入力された情報が表示され、確認を求められます。`y`を入力してEnterキーを押すと、管理者アカウントが作成されます。

#### 非対話式モードの場合
すべての項目でデフォルト値が自動的に使用され、確認なしで管理者アカウントが作成されます。

## 作成後の手順

1. **管理者アカウントでログイン**
   - 作成されたアカウント情報を使用して、Carbon Tracker APIにログインします
   - ユーザー名: `admin`
   - パスワード: `admin123`

2. **他のユーザーの作成**
   - 管理者権限でログイン後、他のユーザーアカウントを作成できます

3. **セキュリティの向上**
   - 本番環境では、デフォルトのパスワードを変更することを強く推奨します

## トラブルシューティング

### Azuriteに接続できない場合

```
❌ Azuriteに接続できません
```

**解決方法:**
1. Azuriteが起動しているか確認
   ```bash
   # 特定のフォルダに移動してAzuriteを起動
   cd /path/to/azurite
   azurite
   ```
2. ポート10002が使用可能か確認
3. ファイアウォールの設定を確認

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
1. Azuriteが正常に起動しているか確認
2. ポート10002が他のプロセスで使用されていないか確認
3. 管理者権限でスクリプトを実行

## セキュリティに関する注意事項

- このスクリプトは**ローカル開発環境でのみ使用**してください
- 本番環境では使用しないでください
- 作成された管理者アカウントのパスワードは、本番環境では必ず変更してください
- デフォルトのパスワードは推測されやすいため、強力なパスワードに変更することを推奨します

## 実行例

### 対話式モードでの実行例
```bash
$ python create_admin_user.py
Azuriteの接続確認中...
✅ Azuriteに正常に接続できました
=== Carbon Tracker API - 管理者アカウント作成スクリプト ===

管理者アカウントの情報を入力してください（Enterでデフォルト値を使用）:

ユーザー名 [admin]: 
メールアドレス [admin@carbontracker.local]: 
パスワード [admin123]: 
名前 [Admin]: 
姓 [User]: 

入力された情報:
  ユーザー名: admin
  メールアドレス: admin@carbontracker.local
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
  メールアドレス: admin@carbontracker.local
  権限: admin

このアカウントでログインして、他のユーザーを作成できます。
🎉 管理者アカウントの作成が完了しました！
```

### 非対話式モードでの実行例
```bash
$ python create_admin_user.py --non-interactive
Azuriteの接続確認中...
✅ Azuriteに正常に接続できました
=== Carbon Tracker API - 管理者アカウント作成スクリプト ===

管理者アカウントの情報を入力してください（Enterでデフォルト値を使用）:

非対話式モード: デフォルト値を使用します。

入力された情報:
  ユーザー名: admin
  メールアドレス: admin@carbontracker.local
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
  メールアドレス: admin@carbontracker.local
  権限: admin

このアカウントでログインして、他のユーザーを作成できます。
🎉 管理者アカウントの作成が完了しました！
```

## ファイル構成

- `create_admin_user.py`: 管理者アカウント作成スクリプト
- `requirements_admin_script.txt`: 必要なPythonライブラリ
- `ADMIN_SETUP_README.md`: このガイド

## サポート

問題が発生した場合は、以下の情報を含めて報告してください：

1. エラーメッセージの全文
2. 実行環境（OS、Pythonバージョン）
3. Azuriteの起動状況
4. 実行したコマンド
