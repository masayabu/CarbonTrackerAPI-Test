#!/usr/bin/env python3
"""
2025年10月のテストデータ作成スクリプト

このスクリプトは、CarbonTrackerAPIのテスト用に2025年10月のデータを作成します。
Azure Table Storageに直接データを挿入します。

使用方法:
1. Azure Storage接続文字列を設定
2. python create_test_data_2025_10.py を実行
"""

import os
import sys
from datetime import datetime, timedelta
from azure.data.tables import TableClient
from azure.core.exceptions import ResourceExistsError
import uuid

# Azure Storage接続文字列
CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
TABLE_NAME = 'ProductionTable'
PARTITION_KEY = 'Production'

def create_test_data_2025_10():
    """2025年10月のテストデータを作成"""
    
    if not CONNECTION_STRING:
        print("❌ エラー: AZURE_STORAGE_CONNECTION_STRING 環境変数が設定されていません")
        print("設定例: export AZURE_STORAGE_CONNECTION_STRING='DefaultEndpointsProtocol=https;AccountName=your_account;AccountKey=your_key;EndpointSuffix=core.windows.net'")
        return False
    
    try:
        # Table Clientを作成
        table_client = TableClient.from_connection_string(CONNECTION_STRING, TABLE_NAME)
        
        # テーブルが存在しない場合は作成
        try:
            table_client.create_table()
            print("✅ テーブルを作成しました")
        except ResourceExistsError:
            print("✅ テーブルは既に存在します")
        
        # 2025年10月のテストデータ
        test_data = [
            {
                'PartitionKey': PARTITION_KEY,
                'RowKey': str(uuid.uuid4()),
                'date': '2025-10-01T09:00:00Z',
                'bambooAmount': 100.0,
                'charcoalProduced': 25.0,
                'charcoalVolume': 0.5,
                'co2Reduction': 73.5,
                'materialType': 'bamboo',
                'groupId': 'test-group-1',
                'userId': 'test-user-1',
                'notes': '2025年10月テストデータ - 1日目'
            },
            {
                'PartitionKey': PARTITION_KEY,
                'RowKey': str(uuid.uuid4()),
                'date': '2025-10-15T14:30:00Z',
                'bambooAmount': 150.0,
                'charcoalProduced': 37.5,
                'charcoalVolume': 0.75,
                'co2Reduction': 110.25,
                'materialType': 'bamboo',
                'groupId': 'test-group-1',
                'userId': 'test-user-1',
                'notes': '2025年10月テストデータ - 15日目'
            },
            {
                'PartitionKey': PARTITION_KEY,
                'RowKey': str(uuid.uuid4()),
                'date': '2025-10-24T11:15:00Z',
                'bambooAmount': 200.0,
                'charcoalProduced': 50.0,
                'charcoalVolume': 1.0,
                'co2Reduction': 147.0,
                'materialType': 'bamboo',
                'groupId': 'test-group-1',
                'userId': 'test-user-1',
                'notes': '2025年10月テストデータ - 24日目（特別な日）'
            },
            {
                'PartitionKey': PARTITION_KEY,
                'RowKey': str(uuid.uuid4()),
                'date': '2025-10-31T16:45:00Z',
                'bambooAmount': 120.0,
                'charcoalProduced': 30.0,
                'charcoalVolume': 0.6,
                'co2Reduction': 88.2,
                'materialType': 'bamboo',
                'groupId': 'test-group-1',
                'userId': 'test-user-1',
                'notes': '2025年10月テストデータ - 31日目（月末）'
            }
        ]
        
        print(f"📊 2025年10月のテストデータを作成中...")
        print(f"データ数: {len(test_data)}件")
        
        # データを挿入
        success_count = 0
        for i, data in enumerate(test_data, 1):
            try:
                table_client.create_entity(data)
                print(f"✅ データ {i} を挿入しました: {data['date']}")
                success_count += 1
            except Exception as e:
                print(f"❌ データ {i} の挿入に失敗: {e}")
        
        print(f"\n📈 結果: {success_count}/{len(test_data)} 件のデータが正常に挿入されました")
        
        # 合計値を計算
        total_bamboo = sum(d['bambooAmount'] for d in test_data)
        total_charcoal = sum(d['charcoalProduced'] for d in test_data)
        total_co2 = sum(d['co2Reduction'] for d in test_data)
        
        print(f"\n📊 2025年10月の合計値:")
        print(f"  - 竹材量: {total_bamboo} kg")
        print(f"  - 炭生産量: {total_charcoal} kg")
        print(f"  - CO2削減量: {total_co2} kg")
        
        return success_count == len(test_data)
        
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
        return False

def verify_test_data():
    """作成したテストデータを検証"""
    print("\n🔍 テストデータの検証を開始...")
    
    try:
        table_client = TableClient.from_connection_string(CONNECTION_STRING, TABLE_NAME)
        
        # 2025年10月のデータを取得
        entities = table_client.list_entities(
            filter=f"PartitionKey eq '{PARTITION_KEY}'"
        )
        
        october_2025_data = []
        for entity in entities:
            if entity.get('date'):
                date = datetime.fromisoformat(entity['date'].replace('Z', '+00:00'))
                if date.year == 2025 and date.month == 10:
                    october_2025_data.append(entity)
        
        print(f"✅ 2025年10月のデータ: {len(october_2025_data)}件")
        
        if october_2025_data:
            total_bamboo = sum(float(d.get('bambooAmount', 0)) for d in october_2025_data)
            total_charcoal = sum(float(d.get('charcoalProduced', 0)) for d in october_2025_data)
            total_co2 = sum(float(d.get('co2Reduction', 0)) for d in october_2025_data)
            
            print(f"📊 検証結果:")
            print(f"  - 竹材量: {total_bamboo} kg")
            print(f"  - 炭生産量: {total_charcoal} kg")
            print(f"  - CO2削減量: {total_co2} kg")
            
            return True
        else:
            print("❌ 2025年10月のデータが見つかりません")
            return False
            
    except Exception as e:
        print(f"❌ データ検証エラー: {e}")
        return False

def main():
    """メイン関数"""
    print("🚀 2025年10月テストデータ作成スクリプト")
    print("=====================================\n")
    
    # テストデータを作成
    if create_test_data_2025_10():
        print("\n✅ テストデータの作成が完了しました")
        
        # データを検証
        if verify_test_data():
            print("\n🎉 すべての処理が正常に完了しました！")
            print("これで2025年10月のテストが実行できます。")
            return True
        else:
            print("\n⚠️ データの検証に失敗しました")
            return False
    else:
        print("\n❌ テストデータの作成に失敗しました")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
