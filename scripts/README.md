# Carbon Tracker API - 管理スクリプト

このディレクトリには、Carbon Tracker APIの管理に必要なスクリプトが含まれています。

## 📁 ディレクトリ構成

```
scripts/
├── admin/                    # 管理者アカウント作成スクリプト
│   ├── create_admin_user.py           # ローカル環境用
│   └── create_admin_user_staging.py   # 検証環境用
├── test/                     # テストデータ作成スクリプト
│   ├── create_test_user.py            # テストユーザー作成
│   ├── create_test_group.py           # テストグループ作成
│   └── reset_user_password.py        # ユーザーパスワードリセット
├── docs/                     # ドキュメント
│   ├── ADMIN_SETUP_README.md          # ローカル環境管理者設定ガイド
│   └── STAGING_ADMIN_SETUP_README.md  # 検証環境管理者設定ガイド
├── requirements_admin_script.txt     # 必要なPythonライブラリ
├── env.example                      # 環境変数設定例
└── README.md                        # このファイル
```

## 🚀 クイックスタート

### 1. 依存関係のインストール
```bash
pip install -r requirements_admin_script.txt
```

### 2. ローカル環境での管理者アカウント作成
```bash
cd scripts/admin
python create_admin_user.py --non-interactive
```

### 3. 検証環境での管理者アカウント作成
```bash
cd scripts/admin
# 環境変数を設定
export AZURE_STORAGE_CONNECTION_STRING='your_connection_string'
python create_admin_user_staging.py --non-interactive
```

## 📋 各スクリプトの詳細

### 管理者アカウント作成スクリプト

- **`admin/create_admin_user.py`**: ローカル環境（Azurite）用
- **`admin/create_admin_user_staging.py`**: 検証環境（Azure Storage）用

詳細は `docs/` フォルダ内のREADMEファイルを参照してください。

### テストデータ作成スクリプト

- **`test/create_test_user.py`**: テスト用ユーザーアカウントの作成
- **`test/create_test_group.py`**: テスト用グループの作成
- **`test/reset_user_password.py`**: ユーザーパスワードのリセット

## 🔧 環境設定

### ローカル環境
- Azuriteが起動している必要があります
- 追加の設定は不要です

### 検証環境
- Azure Storage接続文字列が必要です
- `.env`ファイルまたは環境変数で設定してください

## 📚 ドキュメント

- **`docs/ADMIN_SETUP_README.md`**: ローカル環境管理者設定の詳細ガイド
- **`docs/STAGING_ADMIN_SETUP_README.md`**: 検証環境管理者設定の詳細ガイド

## ⚠️ 注意事項

- これらのスクリプトは管理目的でのみ使用してください
- 本番環境では使用しないでください
- 接続文字列などの機密情報は安全に管理してください
