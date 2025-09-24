# テストデータ作成スクリプト

このディレクトリには、テスト用のデータを作成するためのスクリプトが含まれています。

## 📁 ファイル構成

- **`create_test_user.py`**: テスト用ユーザーアカウントの作成
- **`create_test_group.py`**: テスト用グループの作成
- **`reset_user_password.py`**: ユーザーパスワードのリセット

## 🚀 使用方法

### テストユーザーの作成
```bash
python create_test_user.py
```

### テストグループの作成
```bash
python create_test_group.py
```

### ユーザーパスワードのリセット
```bash
python reset_user_password.py
```

## 📋 機能詳細

### create_test_user.py
- 複数のテストユーザーアカウントを一括作成
- 異なる権限（admin, operator, viewer）のユーザーを作成
- ローカル環境と検証環境の両方に対応

### create_test_group.py
- テスト用グループの作成
- グループメンバーの追加
- グループ設定の管理

### reset_user_password.py
- 既存ユーザーのパスワードをリセット
- 指定したユーザーのパスワードを新しいパスワードに変更
- パスワードハッシュ化の処理

## ⚠️ 注意事項

- これらのスクリプトはテスト目的でのみ使用してください
- 本番環境では使用しないでください
- 作成されたテストデータは適切にクリーンアップしてください
