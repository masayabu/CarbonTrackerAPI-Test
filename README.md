# Carbon Tracker API

炭素固定量追跡システムのためのAzure Functions API

## 概要

Carbon Tracker APIは、竹炭生産によるCO2固定量を追跡・管理するためのRESTful APIです。Azure Functions v4とAzure Table Storageを使用して構築されており、ユーザー管理、グループ管理、生産記録管理、ダッシュボード機能を提供します。

## 主な機能

### 🔐 認証・認可
- JWT ベースの認証システム
- ロールベースのアクセス制御（admin, operator, user）
- セキュアなパスワードハッシュ化（bcrypt）

### 👥 ユーザー管理
- ユーザー作成・更新・削除
- ユーザー一覧取得
- プロフィール管理
- グループへの参加・脱退

### 🏢 グループ管理
- グループ作成・更新・削除
- グループ一覧取得
- ユーザーのグループ参加管理
- グループランキング機能

### 📊 生産記録管理
- 竹炭生産記録の登録・更新・削除
- 生産データの一覧取得
- 写真・PDFファイルのアップロード・取得
- データのインポート・エクスポート

### 📈 ダッシュボード・分析
- CO2固定量の計算・表示
- 月別・年別の生産データ分析
- 効率率の計算
- ランキング表示

### ⚙️ 設定管理
- 計算設定の保存・取得
- 環境別設定管理

## 技術スタック

- **ランタイム**: Node.js 20+
- **フレームワーク**: Azure Functions v4
- **言語**: TypeScript
- **データベース**: Azure Table Storage
- **認証**: JWT (jsonwebtoken)
- **パスワードハッシュ**: bcryptjs
- **ファイルストレージ**: Azure Blob Storage
- **開発ツール**: Azure Functions Core Tools

## 前提条件

- Node.js 20.0.0以上
- Azure Functions Core Tools v4
- Azure Storage Account（Table Storage, Blob Storage）
- TypeScript 5.8.3以上

## セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd CarbonTrackerAPI-Test
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境設定

#### ローカル開発環境

1. `env.example`をコピーして`.env`ファイルを作成：

```bash
cp env.example .env
```

2. `.env`ファイルを編集してAzure Storage接続文字列を設定：

```env
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your_storage_account;AccountKey=your_key;EndpointSuffix=core.windows.net
```

#### Azure Functions Core Toolsの設定

```bash
# Azure Functions Core Toolsをインストール（未インストールの場合）
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

### 4. ビルド

```bash
npm run build
```

### 5. ローカル実行

```bash
# 開発モードで起動
npm run dev

# または
npm start
```

## 管理者アカウントの作成

### ローカル環境

詳細な手順は[ADMIN_SETUP_README.md](./ADMIN_SETUP_README.md)を参照してください。

```bash
# 依存関係をインストール
pip install -r requirements_admin_script.txt

# 管理者アカウントを作成
python create_admin_user.py --non-interactive
```

**デフォルトの管理者アカウント:**
- ユーザー名: `admin`
- パスワード: `admin123`

### 検証環境

詳細な手順は[STAGING_ADMIN_SETUP_README.md](./STAGING_ADMIN_SETUP_README.md)を参照してください。

```bash
# 環境変数を設定
export AZURE_STORAGE_CONNECTION_STRING='your_connection_string'

# 管理者アカウントを作成
python create_admin_user_staging.py --non-interactive
```

**デフォルトの管理者アカウント:**
- ユーザー名: `admin`
- パスワード: `Admin123!@#`

## API エンドポイント

### 認証

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | `/api/auth/login` | ユーザーログイン |
| POST | `/api/auth/logout` | ユーザーログアウト |

### ユーザー管理

| メソッド | エンドポイント | 説明 | 権限 |
|---------|---------------|------|------|
| POST | `/api/users` | ユーザー作成 | admin, operator |
| GET | `/api/users` | ユーザー一覧取得 | admin, operator |
| GET | `/api/users/{id}` | ユーザー詳細取得 | admin, operator |
| PUT | `/api/users/{id}` | ユーザー更新 | admin, operator |
| DELETE | `/api/users/{id}` | ユーザー削除 | admin |
| GET | `/api/users/me` | 自分の情報取得 | 認証済み |
| GET | `/api/users/jwt` | JWTからユーザー情報取得 | 認証済み |

### グループ管理

| メソッド | エンドポイント | 説明 | 権限 |
|---------|---------------|------|------|
| POST | `/api/groups` | グループ作成 | admin, operator |
| GET | `/api/groups` | グループ一覧取得 | 認証済み |
| GET | `/api/groups/{id}` | グループ詳細取得 | 認証済み |
| PUT | `/api/groups/{id}` | グループ更新 | admin, operator |
| DELETE | `/api/groups/{id}` | グループ削除 | admin |
| GET | `/api/groups/user/{userId}` | ユーザーのグループ取得 | 認証済み |
| POST | `/api/groups/{groupId}/users/{userId}` | ユーザーをグループに追加 | admin, operator |
| DELETE | `/api/groups/{groupId}/users/{userId}` | ユーザーをグループから削除 | admin, operator |

### 生産記録管理

| メソッド | エンドポイント | 説明 | 権限 |
|---------|---------------|------|------|
| POST | `/api/productions` | 生産記録作成 | 認証済み |
| GET | `/api/productions` | 生産記録一覧取得 | 認証済み |
| GET | `/api/productions/{id}` | 生産記録詳細取得 | 認証済み |
| PUT | `/api/productions/{id}` | 生産記録更新 | 認証済み |
| DELETE | `/api/productions/{id}` | 生産記録削除 | admin, operator |

### ダッシュボード・分析

| メソッド | エンドポイント | 説明 | 権限 |
|---------|---------------|------|------|
| GET | `/api/dashboard?groupId={id}&year={year}` | ダッシュボードデータ取得 | 認証済み |
| GET | `/api/group-ranking` | グループランキング取得 | 認証済み |
| GET | `/api/group-rankings` | グループランキング一覧取得 | 認証済み |
| GET | `/api/yearly-report?groupId={id}&year={year}` | 年次レポート取得 | 認証済み |

### ファイル管理

| メソッド | エンドポイント | 説明 | 権限 |
|---------|---------------|------|------|
| POST | `/api/upload/photo` | 写真アップロード | 認証済み |
| GET | `/api/photo/{id}` | 写真取得 | 認証済み |
| POST | `/api/upload/pdf` | PDFアップロード | 認証済み |
| GET | `/api/pdf/{id}` | PDF取得 | 認証済み |

### データ管理

| メソッド | エンドポイント | 説明 | 権限 |
|---------|---------------|------|------|
| POST | `/api/import` | データインポート | admin, operator |
| GET | `/api/export` | データエクスポート | admin, operator |

### 設定管理

| メソッド | エンドポイント | 説明 | 権限 |
|---------|---------------|------|------|
| GET | `/api/calc-settings` | 計算設定取得 | 認証済み |
| POST | `/api/calc-settings` | 計算設定保存 | admin, operator |

### 生産データ集計

| メソッド | エンドポイント | 説明 | 権限 |
|---------|---------------|------|------|
| POST | `/api/production-sum` | 生産データ集計実行 | 認証済み |

### ユーティリティ

| メソッド | エンドポイント | 説明 | 権限 |
|---------|---------------|------|------|
| POST | `/api/carbonization-volume` | CO2固定量計算 | 認証済み |
| GET | `/api/check-role` | ユーザーロール確認 | 認証済み |
| GET | `/api/test` | テストエンドポイント | 認証済み |

## 自動実行機能

### Timer Trigger

システムには以下の自動実行機能が含まれています：

#### 生産データ集計の自動実行

- **関数名**: `CreateProductionSumTimer`
- **実行スケジュール**: 毎日深夜0:00（CRON形式: `0 0 0 * * *`）
- **機能**: 
  - ProductionTableからデータを取得
  - 年、groupId、materialTypeでグループ化
  - 以下の項目を合計・計算：
    - `materialAmount`（材料量）
    - `charcoalProduced`（炭生産量）
    - `charcoalVolume`（炭体積）
    - `co2Reduction`（CO2削減量）
    - `carbonContent`（炭素含有量）
    - `ipccLongTerm`（IPCC長期係数適用値）
  - ProductionSumTableに結果を保存（既存データは洗い替え）

#### 計算ロジック

1. **炭素含有量計算**: `charcoalProduced × carbonContentFactors[materialType]`
2. **CO2削減量計算**: `carbonContent × co2ConversionFactor`
3. **IPCC長期係数適用**: `co2Reduction × ipccLongTermFactors[materialType]`

#### 設定値の取得

- Azure Blob Storageの`calc-settings`コンテナから`setting.json`を取得
- 設定ファイルが存在しない場合はデフォルト値を使用

#### 監視・ログ

- Azure Functionsのログに実行結果を出力
- エラー時はAzure Functionsに失敗として通知
- Azure Portalで実行履歴とログを確認可能

## デプロイ

### 開発環境へのデプロイ

```bash
npm run deploy:dev
```

**デプロイ先**: `carbontracker-api-linux` (Azure Functions App)

### 本番環境へのデプロイ

```bash
npm run deploy:prod
```

**デプロイ先**: `carbontracker-api-linux-new` (Azure Functions App)

## 開発

### 利用可能なスクリプト

```bash
# ビルド
npm run build

# 開発モードで起動
npm run dev

# ウォッチモード
npm run watch

# ホットリロード
npm run dev:hot

# クリーンアップ
npm run clean
```

### プロジェクト構造

```
src/
├── config.ts                 # 設定管理
├── index.ts                  # エントリーポイント
└── functions/                # Azure Functions
    ├── CalculateCarbonizationVolume/
    ├── CheckUserRole/
    ├── CreateGroup/
    ├── CreateProduction/
    ├── CreateUser/
    ├── Dashboard/
    ├── DeleteGroup/
    ├── DeleteProduction/
    ├── DeleteUser/
    ├── ExportData/
    ├── GetCalcSettings/
    ├── GetGroup/
    ├── GetGroups/
    ├── GetGroupsById/
    ├── GetMe/
    ├── GetPdf/
    ├── GetPhoto/
    ├── GetProductionById/
    ├── GetProductions/
    ├── GetUserById/
    ├── GetUserByJWT/
    ├── GetUserGroups/
    ├── GetYearlyReport/
    ├── group-ranking/
    ├── group-rankings/
    ├── ImportData/
    ├── ListUsers/
    ├── LoginUser/
    ├── LogoutUser/
    ├── RemoveUserFromGroup/
    ├── SaveCalcSettings/
    ├── TestFunction/
    ├── UpdateGroup/
    ├── UpdateProduction/
    ├── UpdateUser/
    ├── UploadPdf/
    └── UploadPhoto/
```

## 環境設定

### 設定ファイル

環境別の設定は`src/config.dev.json`で管理されます：

```json
{
  "environment": "development",
  "corsOrigins": "http://localhost:5000,http://localhost:3000",
  "jwtSecret": "your-jwt-secret",
  "tableName": "ProductionTable",
  "partitionKey": "Production"
}
```

### 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `AzureWebJobsStorage` | Azure Storage接続文字列 | ✅ |
| `NODE_ENV` | 実行環境（development/production） | ❌ |

## CO2固定量計算

### 計算式

```
CO2固定量 = 竹炭重量 × 0.8（炭素含有率） × 3.67（CO2換算係数）
```

### 効率率計算

```
効率率 = (竹炭生産量 / 竹材投入量) × 100
```

## セキュリティ

- JWT トークンベースの認証
- パスワードのbcryptハッシュ化
- CORS設定によるオリジン制限
- ロールベースのアクセス制御
- 入力値の検証

## トラブルシューティング

### よくある問題

1. **Azure Storage接続エラー**
   - 接続文字列が正しいか確認
   - ストレージアカウントが存在するか確認
   - ネットワーク接続を確認

2. **JWT認証エラー**
   - JWT_SECRETが設定されているか確認
   - トークンの有効期限を確認

3. **CORSエラー**
   - 許可されたオリジンが設定されているか確認
   - フロントエンドのURLが正しいか確認

### ログの確認

```bash
# Azure Functions Core Toolsでログを確認
func start --verbose
```

## ライセンス

このプロジェクトのライセンス情報については、プロジェクトのライセンスファイルを参照してください。

## サポート

問題が発生した場合は、以下の情報を含めて報告してください：

1. エラーメッセージの全文
2. 実行環境（OS、Node.jsバージョン）
3. 実行したコマンド
4. 設定ファイルの内容（機密情報は除く）

## 貢献

このプロジェクトへの貢献を歓迎します。貢献する前に、プロジェクトのコーディング規約とプルリクエストのガイドラインを確認してください。
