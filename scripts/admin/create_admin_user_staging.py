#!/usr/bin/env python3
"""
Carbon Tracker API - 検証環境管理者アカウント作成スクリプト

このスクリプトは、検証環境のAzure Table Storageに直接管理者アカウントを作成するためのものです。

使用方法:
    python create_admin_user_staging.py

注意:
    - 検証環境のAzure Storage接続文字列が必要です
    - セキュリティ上、接続文字列は環境変数で管理してください
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

# .envファイルサポート
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # python-dotenvがインストールされていない場合は無視
    pass

# Azure Table Storage の設定（検証環境）
TABLE_NAME = "UsersTable"
PARTITION_KEY = "User"

# デフォルトの管理者アカウント情報
DEFAULT_ADMIN_USER = {
    "username": "admin",
    "email": "admin@carbontracker.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin",
    "isActive": True,
    "password": "mU7@bpRet*Ud"
}

class AzureTableStorageClient:
    """Azure Table Storage クライアント（検証環境用）"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.account_name, self.account_key, self.endpoint = self._parse_connection_string()
        
    def _parse_connection_string(self) -> tuple[str, str, str]:
        """接続文字列を解析してアカウント情報を取得"""
        params = {}
        for param in self.connection_string.split(';'):
            if '=' in param:
                key, value = param.split('=', 1)
                params[key] = value
        
        account_name = params.get('AccountName', '')
        account_key = params.get('AccountKey', '')
        endpoint = params.get('TableEndpoint', f"https://{account_name}.table.core.windows.net")
        
        if not account_name or not account_key:
            raise ValueError("接続文字列にAccountNameまたはAccountKeyが含まれていません")
            
        return account_name, account_key, endpoint
    
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
        # Content-Typeが空の場合は空文字列を使用
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
        
        # Content-TypeはGETリクエスト以外の場合のみ追加
        if method.upper() != "GET":
            headers["Content-Type"] = content_type
            
        return headers
    
    def _make_request(self, method: str, url: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """HTTP リクエストを実行"""
        if data:
            json_data = json.dumps(data).encode('utf-8')
            content_length = len(json_data)
        else:
            json_data = None
            content_length = 0
            
        headers = self._get_auth_headers(method, url, content_length=content_length)
        
        if data:
            headers["Content-Length"] = str(content_length)
            
        request = urllib.request.Request(url, data=json_data, headers=headers, method=method)
        
        try:
            with urllib.request.urlopen(request) as response:
                response_data = response.read().decode('utf-8')
                if response_data:
                    return json.loads(response_data)
                return {}
        except urllib.error.HTTPError as e:
            error_data = e.read().decode('utf-8')
            print(f"HTTP エラー {e.code}: {error_data}")
            print(f"リクエストURL: {url}")
            print(f"リクエストヘッダー: {headers}")
            raise
        except Exception as e:
            print(f"リクエストエラー: {e}")
            print(f"リクエストURL: {url}")
            print(f"リクエストヘッダー: {headers}")
            raise
    
    def create_table_if_not_exists(self, table_name: str) -> bool:
        """テーブルが存在しない場合は作成"""
        # テーブル一覧を取得してテーブルの存在確認
        tables_url = f"{self.endpoint}/Tables"
        
        try:
            # テーブル一覧を取得
            response = self._make_request("GET", tables_url)
            tables = response.get("value", [])
            
            # 指定されたテーブルが存在するかチェック
            table_exists = any(table.get("TableName") == table_name for table in tables)
            
            if table_exists:
                print(f"テーブル '{table_name}' は既に存在します")
                return True
            else:
                # テーブルが存在しない場合は作成
                create_url = f"{self.endpoint}/Tables"
                table_data = {"TableName": table_name}
                
                try:
                    self._make_request("POST", create_url, table_data)
                    print(f"テーブル '{table_name}' を作成しました")
                    return True
                except Exception as create_error:
                    print(f"テーブル作成エラー: {create_error}")
                    return False
                    
        except Exception as e:
            print(f"テーブル確認エラー: {e}")
            return False
    
    def create_entity(self, table_name: str, entity: Dict[str, Any]) -> bool:
        """エンティティを作成"""
        url = f"{self.endpoint}/{table_name}()"
        
        try:
            self._make_request("POST", url, entity)
            return True
        except Exception as e:
            print(f"エンティティ作成エラー: {e}")
            return False

def hash_password(password: str) -> str:
    """パスワードをハッシュ化（bcryptjs互換）"""
    import bcrypt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def get_connection_string() -> str:
    """接続文字列を取得"""
    # 環境変数から接続文字列を取得
    connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    
    if not connection_string:
        print("❌ 環境変数 AZURE_STORAGE_CONNECTION_STRING が設定されていません")
        print()
        print("以下の方法で接続文字列を設定してください:")
        print("1. 環境変数として設定:")
        print("   export AZURE_STORAGE_CONNECTION_STRING='DefaultEndpointsProtocol=https;AccountName=your_account;AccountKey=your_key;EndpointSuffix=core.windows.net'")
        print()
        print("2. スクリプト実行時に設定:")
        print("   AZURE_STORAGE_CONNECTION_STRING='your_connection_string' python create_admin_user_staging.py")
        print()
        print("3. .envファイルを使用（推奨）:")
        print("   AZURE_STORAGE_CONNECTION_STRING=your_connection_string")
        sys.exit(1)
    
    return connection_string

def create_admin_user(non_interactive: bool = False):
    """管理者アカウントを作成"""
    print("=== Carbon Tracker API - 検証環境管理者アカウント作成スクリプト ===")
    print()
    
    # 接続文字列を取得
    connection_string = get_connection_string()
    
    # ユーザー情報の入力
    print("管理者アカウントの情報を入力してください（Enterでデフォルト値を使用）:")
    print()
    
    if non_interactive:
        # 非対話式モードの場合はデフォルト値を使用
        print("非対話式モード: デフォルト値を使用します。")
        username = DEFAULT_ADMIN_USER['username']
        email = DEFAULT_ADMIN_USER['email']
        password = DEFAULT_ADMIN_USER['password']
        firstName = DEFAULT_ADMIN_USER['firstName']
        lastName = DEFAULT_ADMIN_USER['lastName']
    else:
        try:
            username = input(f"ユーザー名 [{DEFAULT_ADMIN_USER['username']}]: ").strip()
            if not username:
                username = DEFAULT_ADMIN_USER['username']
            
            email = input(f"メールアドレス [{DEFAULT_ADMIN_USER['email']}]: ").strip()
            if not email:
                email = DEFAULT_ADMIN_USER['email']
            
            password = input(f"パスワード [{DEFAULT_ADMIN_USER['password']}]: ").strip()
            if not password:
                password = DEFAULT_ADMIN_USER['password']
            
            firstName = input(f"名前 [{DEFAULT_ADMIN_USER['firstName']}]: ").strip()
            if not firstName:
                firstName = DEFAULT_ADMIN_USER['firstName']
            
            lastName = input(f"姓 [{DEFAULT_ADMIN_USER['lastName']}]: ").strip()
            if not lastName:
                lastName = DEFAULT_ADMIN_USER['lastName']
        except EOFError:
            # 対話式入力ができない場合（CI/CD環境など）はデフォルト値を使用
            print("対話式入力ができないため、デフォルト値を使用します。")
            username = DEFAULT_ADMIN_USER['username']
            email = DEFAULT_ADMIN_USER['email']
            password = DEFAULT_ADMIN_USER['password']
            firstName = DEFAULT_ADMIN_USER['firstName']
            lastName = DEFAULT_ADMIN_USER['lastName']
    
    print()
    print("入力された情報:")
    print(f"  ユーザー名: {username}")
    print(f"  メールアドレス: {email}")
    print(f"  名前: {firstName}")
    print(f"  姓: {lastName}")
    print(f"  権限: admin")
    print()
    
    if not non_interactive:
        try:
            confirm = input("この情報で管理者アカウントを作成しますか？ (y/N): ").strip().lower()
            if confirm != 'y':
                print("キャンセルしました。")
                return False
        except EOFError:
            # 対話式入力ができない場合は自動的に続行
            print("対話式入力ができないため、自動的に続行します。")
    else:
        print("非対話式モード: 自動的に続行します。")
    
    # Azure Table Storage クライアントを作成
    try:
        client = AzureTableStorageClient(connection_string)
    except Exception as e:
        print(f"❌ Azure Storage クライアントの作成に失敗しました: {e}")
        return False
    
    # テーブルの存在確認・作成
    print("テーブルの確認中...")
    if not client.create_table_if_not_exists(TABLE_NAME):
        print("エラー: テーブルの作成に失敗しました")
        return False
    
    # パスワードのハッシュ化
    print("パスワードをハッシュ化中...")
    try:
        password_hash = hash_password(password)
    except ImportError:
        print("エラー: bcrypt ライブラリがインストールされていません")
        print("以下のコマンドでインストールしてください:")
        print("  pip install bcrypt")
        return False
    
    # ユーザーエンティティの作成
    user_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    
    user_entity = {
        "PartitionKey": PARTITION_KEY,
        "RowKey": user_id,
        "username": username,
        "email": email,
        "firstName": firstName,
        "lastName": lastName,
        "role": "admin",
        "isActive": True,
        "passwordHash": password_hash,
        "createdAt": timestamp,
        "updatedAt": timestamp
    }
    
    # ユーザーを作成
    print("管理者アカウントを作成中...")
    if client.create_entity(TABLE_NAME, user_entity):
        print("✅ 管理者アカウントが正常に作成されました！")
        print()
        print("作成されたアカウント情報:")
        print(f"  ユーザーID: {user_id}")
        print(f"  ユーザー名: {username}")
        print(f"  メールアドレス: {email}")
        print(f"  権限: admin")
        print()
        print("このアカウントでログインして、他のユーザーを作成できます。")
        return True
    else:
        print("❌ 管理者アカウントの作成に失敗しました")
        return False

def check_azure_connection(connection_string: str):
    """Azure Storageの接続確認"""
    print("Azure Storageの接続確認中...")
    
    try:
        client = AzureTableStorageClient(connection_string)
        url = f"{client.endpoint}/Tables"
        
        # 認証ヘッダーを生成
        headers = client._get_auth_headers("GET", url)
        request = urllib.request.Request(url, headers=headers)
        
        with urllib.request.urlopen(request, timeout=10) as response:
            print("✅ Azure Storageに正常に接続できました")
            return True
    except urllib.error.HTTPError as e:
        error_data = e.read().decode('utf-8')
        print("❌ Azure Storageに接続できません")
        print(f"HTTP エラー {e.code}: {error_data}")
        print(f"リクエストURL: {url}")
        print(f"リクエストヘッダー: {headers}")
        return False
    except Exception as e:
        print("❌ Azure Storageに接続できません")
        print(f"エラー: {e}")
        return False

def main():
    """メイン関数"""
    try:
        # コマンドライン引数の処理
        non_interactive = "--non-interactive" in sys.argv or "-y" in sys.argv
        
        # 接続文字列を取得
        connection_string = get_connection_string()
        
        # Azure Storageの接続確認
        if not check_azure_connection(connection_string):
            sys.exit(1)
        
        # 管理者アカウントの作成
        if create_admin_user(non_interactive=non_interactive):
            print("🎉 管理者アカウントの作成が完了しました！")
        else:
            print("💥 管理者アカウントの作成に失敗しました")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n操作がキャンセルされました")
        sys.exit(1)
    except Exception as e:
        print(f"\n予期しないエラーが発生しました: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
