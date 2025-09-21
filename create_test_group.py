#!/usr/bin/env python3
"""
Carbon Tracker API - テストグループ作成スクリプト

このスクリプトは、テスト用のグループをAzure Table Storageに作成するためのものです。

使用方法:
    python create_test_group.py

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
TABLE_NAME = "GroupsTable"
PARTITION_KEY = "Groups"

# テストグループの定義
TEST_GROUPS = [
    {
        "id": "test-group-id",
        "name": "テストグループ",
        "description": "テスト用のグループです"
    },
    {
        "id": "admin-group-id",
        "name": "管理者グループ",
        "description": "管理者用のグループです"
    },
    {
        "id": "operator-group-id",
        "name": "オペレーターグループ",
        "description": "オペレーター用のグループです"
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
        tables_url = f"{self.endpoint}/{self.account_name}/Tables"
        
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
                create_url = f"{self.endpoint}/{self.account_name}/Tables"
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
    
    def get_group_by_id(self, group_id: str) -> Optional[Dict[str, Any]]:
        """グループIDでグループを検索"""
        url = f"{self.endpoint}/{self.account_name}/{TABLE_NAME}(PartitionKey='{PARTITION_KEY}',RowKey='{group_id}')"
        
        try:
            response = self._make_request("GET", url)
            return response
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            else:
                print(f"グループ検索エラー: {e.code} - {e.reason}")
                return None
        except Exception as e:
            print(f"グループ検索エラー: {e}")
            return None
    
    def list_all_groups(self) -> list:
        """すべてのグループを取得"""
        url = f"{self.endpoint}/{self.account_name}/{TABLE_NAME}()"
        
        try:
            response = self._make_request("GET", url)
            return response.get('value', [])
        except Exception as e:
            print(f"グループ一覧取得エラー: {e}")
            return []
    
    def create_group(self, group_data: Dict[str, Any]) -> bool:
        """グループを作成"""
        url = f"{self.endpoint}/{self.account_name}/{TABLE_NAME}()"
        
        try:
            self._make_request("POST", url, group_data)
            print(f"グループ '{group_data['name']}' を作成しました")
            return True
        except Exception as e:
            print(f"グループ作成エラー: {e}")
            return False

def main() -> bool:
    print("=" * 60)
    print("テストグループ作成スクリプト")
    print("=" * 60)
    print()

    # Azure Table Storage クライアントを初期化
    client = AzureTableStorageClient(AZURITE_ACCOUNT_NAME, AZURITE_ACCOUNT_KEY, AZURITE_TABLE_ENDPOINT)


    # テーブルの存在確認・作成
    print("テーブルの確認中...")
    if not client.create_table_if_not_exists(TABLE_NAME):
        print("❌ テーブルの確認・作成に失敗しました")
        return False

    print("✅ テーブルの確認・作成が完了しました")
    print()

    # 既存グループの確認と表示
    print("既存グループの確認中...")
    existing_groups = client.list_all_groups()

    if existing_groups:
        print(f"既存グループ数: {len(existing_groups)}")
        print("既存グループ一覧:")
        for group in existing_groups:
            group_id = group.get('RowKey', 'N/A')
            name = group.get('name', 'N/A')
            description = group.get('description', 'N/A')
            created_at = group.get('createdAt', 'N/A')
            print(f"  📁 {name} ({group_id}) - {description} - 作成日: {created_at}")
        print()

    # 各テストグループを確認・作成
    created_count = 0
    skipped_count = 0

    for group_data in TEST_GROUPS:
        group_id = group_data['id']
        print(f"グループ '{group_id}' の確認中...")

        # 既存グループの確認
        existing_group = client.get_group_by_id(group_id)
        if existing_group:
            print(f"  ✅ グループ '{group_id}' は既に存在します。")
            print(f"     グループ名: {existing_group.get('name', 'N/A')}")
            print(f"     説明: {existing_group.get('description', 'N/A')}")
            print(f"     作成日: {existing_group.get('createdAt', 'N/A')}")
            print(f"     更新日: {existing_group.get('updatedAt', 'N/A')}")
            skipped_count += 1
            continue

        # グループエンティティの作成
        timestamp = datetime.now(timezone.utc).isoformat()

        group_entity = {
            "PartitionKey": PARTITION_KEY,
            "RowKey": group_id,
            "name": group_data['name'],
            "description": group_data['description'],
            "createdAt": timestamp,
            "updatedAt": timestamp
        }

        # グループを作成
        print(f"  グループ '{group_id}' を作成中...")
        if client.create_group(group_entity):
            print(f"  ✅ グループ '{group_id}' を作成しました")
            created_count += 1
        else:
            print(f"  ❌ グループ '{group_id}' の作成に失敗しました")

    print()
    print("=" * 60)
    print("テストグループ確認・作成完了")
    print("=" * 60)
    print(f"作成されたグループ数: {created_count}")
    print(f"スキップされたグループ数: {skipped_count}")
    print(f"対象グループ数: {len(TEST_GROUPS)}")
    print()

    # 利用可能なテストグループを表示
    print("利用可能なテストグループ:")
    for group_data in TEST_GROUPS:
        group_id = group_data['id']
        name = group_data['name']
        description = group_data['description']

        # 既存グループかどうかを確認
        existing_group = client.get_group_by_id(group_id)
        status = "✅ 登録済み" if existing_group else "❌ 未登録"

        print(f"  📁 {name} ({group_id}) - {description} - {status}")

    print()
    print("登録済みのグループでAPIテストを実行できます。")

    return True  # 既存グループがあれば成功とする

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ ユーザーによって中断されました")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 予期しないエラーが発生しました: {e}")
        sys.exit(1)