#!/usr/bin/env python3
"""
Carbon Tracker API - テストユーザー作成スクリプト

このスクリプトは、テスト用のユーザーアカウントを作成するためのものです。

使用方法:
    python create_test_user.py

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
from typing import Dict, Any, Optional

# Azure Table Storage の設定
AZURITE_ACCOUNT_NAME = "devstoreaccount1"
AZURITE_ACCOUNT_KEY = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
AZURITE_TABLE_ENDPOINT = "http://127.0.0.1:10002"
TABLE_NAME = "UsersTable"
PARTITION_KEY = "User"

# テスト用ユーザー情報
TEST_USERS = [
    {
        "username": "testuser",
        "email": "test@example.com",
        "firstName": "Test",
        "lastName": "User",
        "role": "user",
        "password": "testpassword"
    },
    {
        "username": "admin",
        "email": "admin@example.com",
        "firstName": "Admin",
        "lastName": "User",
        "role": "admin",
        "password": "adminpassword"
    },
    {
        "username": "operator",
        "email": "operator@example.com",
        "firstName": "Operator",
        "lastName": "User",
        "role": "operator",
        "password": "operatorpassword"
    }
]

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
        
        # デバッグ情報を表示
        print(f"  🔍 デバッグ情報:")
        print(f"     URL: {url}")
        print(f"     Method: {method}")
        print(f"     Content-Type: {content_type_for_auth}")
        print(f"     Auth Header: {auth_header[:50]}...")
        
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
                print(f"テーブル '{table_name}' が見つかりません。作成します...")
                return self._create_table(table_name)
            else:
                print(f"テーブル確認エラー: {e.code} - {e.reason}")
                # エラーレスポンスの詳細を表示
                try:
                    error_body = e.read().decode('utf-8')
                    print(f"エラー詳細: {error_body}")
                except:
                    pass
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
                print(f"テーブル '{table_name}' を作成しました")
                return True
        except urllib.error.HTTPError as e:
            print(f"テーブル作成エラー: {e.code} - {e.reason}")
            try:
                error_body = e.read().decode('utf-8')
                print(f"エラー詳細: {error_body}")
            except:
                pass
            return False
        except Exception as e:
            print(f"テーブル作成エラー: {e}")
            return False
    
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
    
    def list_all_users(self) -> list:
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
    
    def create_user(self, user_data: Dict[str, Any]) -> bool:
        """ユーザーを作成"""
        # エンティティをJSONに変換
        entity_json = json.dumps(user_data)
        content_length = len(entity_json.encode('utf-8'))
        
        url = f"{self.endpoint}/{TABLE_NAME}"
        headers = self._get_auth_headers("POST", url, "application/json", content_length)
        
        try:
            req = urllib.request.Request(url, data=entity_json.encode('utf-8'), headers=headers, method="POST")
            with urllib.request.urlopen(req) as response:
                return True
        except Exception as e:
            print(f"ユーザー作成エラー: {e}")
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
    print("Carbon Tracker API - テストユーザー作成スクリプト")
    print("=" * 60)
    print()
    
    # Azure Table Storage クライアントを作成
    client = AzureTableStorageClient(AZURITE_ACCOUNT_NAME, AZURITE_ACCOUNT_KEY, AZURITE_TABLE_ENDPOINT)
    
    # テーブルの存在確認・作成
    print("テーブルの確認中...")
    if not client.create_table_if_not_exists(TABLE_NAME):
        print("エラー: テーブルの確認に失敗しました")
        return False
    
    # パスワードのハッシュ化
    print("パスワードをハッシュ化中...")
    try:
        for user_data in TEST_USERS:
            user_data['passwordHash'] = hash_password(user_data['password'])
    except ImportError:
        print("エラー: bcrypt ライブラリがインストールされていません")
        print("以下のコマンドでインストールしてください:")
        print("  pip install bcrypt")
        return False
    
    # 既存ユーザーの確認と表示
    print("既存ユーザーの確認中...")
    existing_users = client.list_all_users()
    
    if existing_users:
        print(f"既存ユーザー数: {len(existing_users)}")
        print("既存ユーザー一覧:")
        for user in existing_users:
            email = user.get('email', 'N/A')
            username = user.get('username', 'N/A')
            role = user.get('role', 'N/A')
            created_at = user.get('createdAt', 'N/A')
            print(f"  📧 {email} ({username}) - {role} - 作成日: {created_at}")
        print()
    
    # 各テストユーザーを確認・作成
    created_count = 0
    skipped_count = 0
    
    for user_data in TEST_USERS:
        email = user_data['email']
        print(f"ユーザー '{email}' の確認中...")
        
        # 既存ユーザーの確認
        existing_user = client.get_user_by_email(email)
        if existing_user:
            print(f"  ✅ ユーザー '{email}' は既に存在します。")
            print(f"     ユーザー名: {existing_user.get('username', 'N/A')}")
            print(f"     権限: {existing_user.get('role', 'N/A')}")
            print(f"     作成日: {existing_user.get('createdAt', 'N/A')}")
            print(f"     更新日: {existing_user.get('updatedAt', 'N/A')}")
            skipped_count += 1
            continue
        
        # ユーザーエンティティの作成
        user_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        user_entity = {
            "PartitionKey": PARTITION_KEY,
            "RowKey": user_id,
            "username": user_data['username'],
            "email": user_data['email'],
            "firstName": user_data['firstName'],
            "lastName": user_data['lastName'],
            "role": user_data['role'],
            "isActive": True,
            "passwordHash": user_data['passwordHash'],
            "createdAt": timestamp,
            "updatedAt": timestamp
        }
        
        # ユーザーを作成
        print(f"  ユーザー '{email}' を作成中...")
        if client.create_user(user_entity):
            print(f"  ✅ ユーザー '{email}' を作成しました")
            created_count += 1
        else:
            print(f"  ❌ ユーザー '{email}' の作成に失敗しました")
    
    print()
    print("=" * 60)
    print("テストユーザー確認・作成完了")
    print("=" * 60)
    print(f"作成されたユーザー数: {created_count}")
    print(f"スキップされたユーザー数: {skipped_count}")
    print(f"対象ユーザー数: {len(TEST_USERS)}")
    print()
    
    # 利用可能なテストユーザーを表示
    print("利用可能なテストユーザー:")
    for user_data in TEST_USERS:
        email = user_data['email']
        password = user_data['password']
        role = user_data['role']
        
        # 既存ユーザーかどうかを確認
        existing_user = client.get_user_by_email(email)
        status = "✅ 登録済み" if existing_user else "❌ 未登録"
        
        print(f"  📧 {email} (パスワード: {password}, 権限: {role}) - {status}")
    
    print()
    print("登録済みのユーザーでログインテストを実行できます。")
    
    return True  # 既存ユーザーがあれば成功とする

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
