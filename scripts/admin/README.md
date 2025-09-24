# 管理者アカウント作成スクリプト

このディレクトリには、管理者アカウントを作成するためのスクリプトが含まれています。

## 📁 ファイル構成

- **`create_admin_user.py`**: ローカル環境（Azurite）用管理者アカウント作成スクリプト
- **`create_admin_user_staging.py`**: 検証環境（Azure Storage）用管理者アカウント作成スクリプト

## 🚀 使用方法

### ローカル環境（Azurite）

1. **Azuriteを起動**
   ```bash
   cd /path/to/azurite
   azurite
   ```

2. **管理者アカウントを作成**
   ```bash
   python create_admin_user.py --non-interactive
   ```

### 検証環境（Azure Storage）

1. **接続文字列を設定**
   ```bash
   export AZURE_STORAGE_CONNECTION_STRING='your_connection_string'
   ```

2. **管理者アカウントを作成**
   ```bash
   python create_admin_user_staging.py --non-interactive
   ```

## 📋 デフォルトの管理者アカウント

### ローカル環境
- **ユーザー名**: `admin`
- **メールアドレス**: `admin@carbontracker.local`
- **パスワード**: `admin123`

### 検証環境
- **ユーザー名**: `admin`
- **メールアドレス**: `admin@carbontracker.com`
- **パスワード**: `Admin123!@#`

## 📚 詳細ドキュメント

- **`../docs/ADMIN_SETUP_README.md`**: ローカル環境管理者設定の詳細ガイド
- **`../docs/STAGING_ADMIN_SETUP_README.md`**: 検証環境管理者設定の詳細ガイド
