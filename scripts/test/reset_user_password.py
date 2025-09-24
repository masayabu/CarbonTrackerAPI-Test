#!/usr/bin/env python3
"""
Carbon Tracker API - ユーザーパスワード再設定スクリプト

このスクリプトは、既存のユーザーのパスワードを再設定するためのものです。

使用方法:
    python reset_user_password.py

注意:
    - Azuriteが起動している必要があります
    - ローカル開発環境でのみ使用してください
"""

import os
import sys
import json
import uuid
import hashlib
import hmac
import base64
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

# Azure Table Storage の設定
AZURITE_ACCOUNT_NAME = "devstoreaccount1"
AZURITE_ACCOUNT_KEY = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
AZURITE_TABLE_ENDPOINT = "http://127.0.0.1:10002"
TABLE_NAME = "UsersTable"
PARTITION_KEY = "User"

class AzureTableStorageClient:
    """Azure Table Storage クライアント（Azurite用）"""
    
    def __init__(self, account_name: str, account_key: str, endpoint: str):
        self.account_name = account_name
        self.account_key = account_key
        self.endpoint = endpoint
        
    def _generate_shared_key_auth(self, method: str, url: str, content_type: str = "application/json", content_length: int = 0) -> str:
        """Shared Key認証ヘッダーを生成"""
        from datetime import datetime
        
        # 現在の日時をGMT形式で取得
        now = datetime.utcnow()
        date_str = now.strftime('%a, %d %b %Y %H:%M:%S GMT')
        
        # URLからパス部分を抽出
        parsed_url = urllib.parse.urlparse(url)
        canonicalized_resource = f"/{self.account_name}{parsed_url.path}"
        
        # クエリパラメータがある場合は追加
        if parsed_url.query:
            canonicalized_resource += f"?{parsed_url.query}"
        
        # 署名用の文字列を作成（Azure Table Storage用）
        content_type_for_sign = content_type if content_type else ""
        string_to_sign = f"{method}\n\n{content_type_for_sign}\n{date_str}\n{canonicalized_resource}"
        
        # HMAC-SHA256で署名を作成
        signature = base64.b64encode(
            hmac.new(
                base64.b64decode(self.account_key),
                string_to_sign.encode('utf-8'),
                hashlib.sha256
            ).digest()
        ).decode('utf-8')
        
        return f"SharedKey {self.account_name}:{signature}"
    
    def _get_auth_headers(self, method: str, url: str, content_type: str = "application/json", content_length: int = 0) -> Dict[str, str]:
        """認証ヘッダーを生成"""
        # GETリクエストの場合はContent-Typeを空にする
        if method.upper() == "GET":
            content_type_for_auth = ""
        else:
            content_type_for_auth = content_type
            
        auth_header = self._generate_shared_key_auth(method, url, content_type_for_auth, content_length)
        
        headers = {
            "Accept": "application/json;odata=nometadata",
            "Authorization": auth_header,
            "x-ms-date": datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S GMT'),
            "x-ms-version": "2020-04-08"
        }
        
        if method.upper() in ["POST", "PUT", "MERGE", "DELETE"]:
            headers["Content-Type"] = content_type
            headers["Content-Length"] = str(content_length)
        
        return headers
    
    def create_table_if_not_exists(self, table_name: str) -> bool:
        """テーブルが存在しない場合は作成"""
        url = f"{self.endpoint}/{table_name}"
        headers = self._get_auth_headers("GET", url)
        
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                # テーブルが存在しない場合は作成
                return self._create_table(table_name)
            else:
                print(f"テーブル確認エラー: {e.code} - {e.reason}")
                return False
        except Exception as e:
            print(f"テーブル確認エラー: {e}")
            return False
    
    def _create_table(self, table_name: str) -> bool:
        """テーブルを作成"""
        url = f"{self.endpoint}/{table_name}"
        headers = self._get_auth_headers("POST", url, "application/json", 0)
        
        try:
            req = urllib.request.Request(url, headers=headers, method="POST")
            with urllib.request.urlopen(req) as response:
                return True
        except Exception as e:
            print(f"テーブル作成エラー: {e}")
            return False
    
    def list_users(self) -> List[Dict[str, Any]]:
        """すべてのユーザーを取得"""
        url = f"{self.endpoint}/{TABLE_NAME}()"
        headers = self._get_auth_headers("GET", url)
        
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                return data.get('value', [])
        except Exception as e:
            print(f"ユーザー一覧取得エラー: {e}")
            return []
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """メールアドレスでユーザーを検索"""
        # URLエンコード
        encoded_email = urllib.parse.quote(email, safe='')
        filter_query = f"$filter=email eq '{encoded_email}'"
        url = f"{self.endpoint}/{TABLE_NAME}()?{filter_query}"
        headers = self._get_auth_headers("GET", url)
        
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                users = data.get('value', [])
                return users[0] if users else None
        except Exception as e:
            print(f"ユーザー検索エラー: {e}")
            return None
    
    def update_user_password(self, user: Dict[str, Any], new_password_hash: str) -> bool:
        """ユーザーのパスワードを更新"""
        # エンティティの更新
        user['passwordHash'] = new_password_hash
        user['updatedAt'] = datetime.now(timezone.utc).isoformat()
        
        # 不要なフィールドを削除
        user.pop('odata.etag', None)
        user.pop('odata.metadata', None)
        user.pop('Timestamp', None)
        
        # MERGEリクエストで更新
        partition_key = user['PartitionKey']
        row_key = user['RowKey']
        url = f"{self.endpoint}/{TABLE_NAME}(PartitionKey='{partition_key}',RowKey='{row_key}')"
        
        # エンティティをJSONに変換
        entity_json = json.dumps(user)
        content_length = len(entity_json.encode('utf-8'))
        headers = self._get_auth_headers("MERGE", url, "application/json", content_length)
        
        try:
            req = urllib.request.Request(url, data=entity_json.encode('utf-8'), headers=headers, method="MERGE")
            with urllib.request.urlopen(req) as response:
                return True
        except Exception as e:
            print(f"パスワード更新エラー: {e}")
            return False

def hash_password(password: str) -> str:
    """パスワードをハッシュ化"""
    try:
        import bcrypt
        # ソルトを生成してハッシュ化
        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt)
        return password_hash.decode('utf-8')
    except ImportError:
        raise ImportError("bcrypt ライブラリがインストールされていません")

def main():
    """メイン関数"""
    print("=" * 60)
    print("Carbon Tracker API - ユーザーパスワード再設定スクリプト")
    print("=" * 60)
    print()
    
    # 非対話式モードの確認
    non_interactive = "--non-interactive" in sys.argv or "-y" in sys.argv
    
    # Azure Table Storage クライアントを作成
    client = AzureTableStorageClient(AZURITE_ACCOUNT_NAME, AZURITE_ACCOUNT_KEY, AZURITE_TABLE_ENDPOINT)
    
    # テーブルの存在確認
    print("テーブルの確認中...")
    if not client.create_table_if_not_exists(TABLE_NAME):
        print("エラー: テーブルの確認に失敗しました")
        return False
    
    # 既存のユーザー一覧を取得
    print("既存のユーザーを取得中...")
    users = client.list_users()
    
    if not users:
        print("エラー: ユーザーが見つかりません")
        return False
    
    print(f"見つかったユーザー数: {len(users)}")
    print()
    
    # ユーザー選択
    if non_interactive:
        # 非対話式モードの場合は最初のユーザーを選択
        if users:
            selected_user = users[0]
            print(f"非対話式モード: 最初のユーザーを選択しました - {selected_user.get('email', 'N/A')}")
        else:
            print("エラー: ユーザーが見つかりません")
            return False
    else:
        # ユーザー一覧を表示
        print("利用可能なユーザー:")
        for i, user in enumerate(users, 1):
            email = user.get('email', 'N/A')
            username = user.get('username', 'N/A')
            role = user.get('role', 'N/A')
            print(f"  {i}. {email} ({username}) - {role}")
        print()
        
        # ユーザー選択
        try:
            while True:
                choice = input("パスワードを再設定するユーザーの番号を入力してください: ").strip()
                try:
                    index = int(choice) - 1
                    if 0 <= index < len(users):
                        selected_user = users[index]
                        break
                    else:
                        print("無効な番号です。再度入力してください。")
                except ValueError:
                    print("数値を入力してください。")
        except EOFError:
            print("対話式入力ができないため、最初のユーザーを選択します。")
            selected_user = users[0]
    
    print()
    print("選択されたユーザー:")
    print(f"  メールアドレス: {selected_user.get('email', 'N/A')}")
    print(f"  ユーザー名: {selected_user.get('username', 'N/A')}")
    print(f"  名前: {selected_user.get('firstName', 'N/A')} {selected_user.get('lastName', 'N/A')}")
    print(f"  権限: {selected_user.get('role', 'N/A')}")
    print()
    
    # 新しいパスワードの入力
    if non_interactive:
        # 非対話式モードの場合はデフォルトパスワードを使用
        new_password = "testpassword"
        print(f"非対話式モード: デフォルトパスワードを使用します - {new_password}")
    else:
        try:
            while True:
                new_password = input("新しいパスワードを入力してください: ").strip()
                if new_password:
                    confirm_password = input("パスワードを再入力してください: ").strip()
                    if new_password == confirm_password:
                        break
                    else:
                        print("パスワードが一致しません。再度入力してください。")
                else:
                    print("パスワードを入力してください。")
        except EOFError:
            print("対話式入力ができないため、デフォルトパスワードを使用します。")
            new_password = "testpassword"
    
    print()
    print("パスワード再設定の確認:")
    print(f"  ユーザー: {selected_user.get('email', 'N/A')}")
    print(f"  新しいパスワード: {'*' * len(new_password)}")
    print()
    
    if not non_interactive:
        try:
            confirm = input("この情報でパスワードを再設定しますか？ (y/N): ").strip().lower()
            if confirm != 'y':
                print("キャンセルしました。")
                return False
        except EOFError:
            print("対話式入力ができないため、自動的に続行します。")
    
    # パスワードのハッシュ化
    print("パスワードをハッシュ化中...")
    try:
        password_hash = hash_password(new_password)
    except ImportError:
        print("エラー: bcrypt ライブラリがインストールされていません")
        print("以下のコマンドでインストールしてください:")
        print("  pip install bcrypt")
        return False
    
    # パスワードの更新
    print("パスワードを更新中...")
    if client.update_user_password(selected_user, password_hash):
        print("✅ パスワードの再設定が完了しました！")
        print()
        print("更新されたユーザー情報:")
        print(f"  メールアドレス: {selected_user.get('email', 'N/A')}")
        print(f"  新しいパスワード: {new_password}")
        print()
        print("このパスワードでログインをテストできます。")
        return True
    else:
        print("❌ パスワードの再設定に失敗しました")
        return False

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n操作がキャンセルされました。")
        sys.exit(1)
    except Exception as e:
        print(f"\n予期しないエラーが発生しました: {e}")
        sys.exit(1)
