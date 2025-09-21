# JWT認証システム実装ガイド

## 概要

このドキュメントでは、CarbonTrackerAPIに実装されたJWT認証システムについて説明します。すべてのAPIエンドポイント（ログインAPIとテストAPIを除く）でJWT認証が必須となりました。

## 実装内容

### 1. 共通認証ミドルウェア (`src/utils/auth.ts`)

#### 主要機能
- **JWT認証**: トークンの検証とペイロードの抽出
- **権限チェック**: 管理者・オペレーター権限の確認
- **CORS対応**: 適切なCORSヘッダーの設定
- **エラーハンドリング**: 統一されたエラーレスポンス

#### 主要関数
```typescript
// JWT認証を実行
authenticateJWT(request: HttpRequest, context: InvocationContext): AuthResult

// 権限チェック
isAdmin(payload: JWTPayload): boolean
isOperator(payload: JWTPayload): boolean
isAdminOrOperator(payload: JWTPayload): boolean
isOwnResource(payload: JWTPayload, targetUserId: string): boolean
```

### 2. 認証が適用されたAPI

#### 認証必須API（29個）
- **グループ管理**: GetGroups, CreateGroup, UpdateGroup, DeleteGroup, GetGroup, GetGroupsById
- **生産データ管理**: GetProductions, CreateProduction, UpdateProduction, DeleteProduction, GetProductionById
- **ユーザー管理**: ListUsers, CreateUser, UpdateUser, DeleteUser, GetUserById, GetUserByJWT, GetMe
- **データ管理**: ExportData, ImportData, Dashboard, GetYearlyReport
- **設定管理**: GetCalcSettings, SaveCalcSettings
- **ファイル管理**: UploadPhoto, UploadPdf, GetPhoto, GetPdf
- **その他**: GetUserGroups, RemoveUserFromGroup, CheckUserRole, CalculateCarbonizationVolume, group-ranking, group-rankings

#### 認証不要API（2個）
- **LoginUser**: ログイン用API
- **TestFunction**: テスト用API（開発環境のみ）

### 3. 権限レベル

#### 管理者権限が必要なAPI
- CreateGroup, UpdateGroup, DeleteGroup
- CreateUser, UpdateUser, DeleteUser
- ExportData, ImportData
- ListUsers

#### 一般ユーザーでもアクセス可能なAPI
- GetGroups, GetGroup, GetGroupsById
- GetProductions, GetProductionById
- Dashboard, GetYearlyReport
- GetCalcSettings, SaveCalcSettings
- その他の読み取り専用API

## 使用方法

### 1. ログイン
```javascript
const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        email: 'user@example.com',
        password: 'password'
    })
});

const data = await response.json();
const token = data.token;
```

### 2. 認証が必要なAPIの呼び出し
```javascript
const response = await fetch('/api/groups', {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});
```

### 3. エラーレスポンス

#### 401 Unauthorized
```json
{
    "error": "Unauthorized: Missing token"
}
```

#### 403 Forbidden
```json
{
    "error": "Forbidden: Admin or operator role required"
}
```

## セキュリティ対策

### 1. JWT設定
- **有効期限**: 1時間
- **署名アルゴリズム**: HS256
- **シークレットキー**: 環境変数 `JWT_SECRET` から取得

### 2. トークン検証
- トークンの存在確認
- 署名の検証
- 有効期限の確認
- ペイロードの整合性チェック

### 3. 権限管理
- ロールベースのアクセス制御
- リソース所有者の確認
- 管理者・オペレーター権限の分離

## テスト方法

### 1. テストスクリプトの実行
```bash
node test_auth.js
```

### 2. 手動テスト
1. ログインAPIでトークンを取得
2. 取得したトークンで他のAPIをテスト
3. 認証なしでのアクセスをテスト

## 設定

### 環境変数
```bash
JWT_SECRET=your-secret-key-here
```

### CORS設定
`src/config.ts` でCORSオリジンを設定：
```typescript
export const corsOrigins = "http://localhost:3000,https://yourdomain.com";
```

## トラブルシューティング

### よくある問題

#### 1. "JWT_SECRET is not set" エラー
- 環境変数 `JWT_SECRET` が設定されているか確認
- ローカル開発環境では `local.settings.json` を確認

#### 2. "Unauthorized: Token expired" エラー
- トークンの有効期限（1時間）が切れている
- 再ログインが必要

#### 3. "Forbidden: Admin or operator role required" エラー
- ユーザーのロールが管理者またはオペレーターではない
- 管理者権限が必要なAPIにアクセスしようとしている

### デバッグ方法
1. ログを確認してJWT検証エラーの詳細を確認
2. トークンのペイロードを確認
3. ユーザーのロールを確認

## 今後の改善点

### 1. トークンリフレッシュ機能
- アクセストークンとリフレッシュトークンの分離
- 自動的なトークン更新

### 2. レート制限
- API呼び出し回数の制限
- ブルートフォース攻撃の防止

### 3. 監査ログ
- APIアクセスの記録
- セキュリティイベントの追跡

### 4. 多要素認証
- 2FA（Two-Factor Authentication）の実装
- より強固なセキュリティ

## まとめ

このJWT認証システムの実装により、CarbonTrackerAPIのセキュリティが大幅に向上しました。すべてのAPIエンドポイントで適切な認証と認可が行われ、不正アクセスを防ぐことができます。

定期的なセキュリティ監査とテストを実施し、システムの安全性を維持してください。
