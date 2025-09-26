const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 設定
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:7071/api';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';
const TEST_GROUP_ID = process.env.TEST_GROUP_ID || 'test-group-123';

// テスト用のJWTトークン
let authToken = null;

/**
 * HTTPリクエストを送信するヘルパー関数
 */
function makeRequest(method, url, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        // リクエストボディを準備
        const requestBody = data ? JSON.stringify(data) : '';
        const contentLength = Buffer.byteLength(requestBody, 'utf8');
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': contentLength,
                ...headers
            }
        };
        
        console.log(`🔍 リクエスト詳細:`);
        console.log(`   Method: ${method}`);
        console.log(`   URL: ${url}`);
        console.log(`   Body: ${requestBody}`);
        console.log(`   Content-Length: ${contentLength}`);
        
        const req = client.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = responseData ? JSON.parse(responseData) : {};
                    resolve({
                        status: res.statusCode,
                        data: parsedData,
                        headers: res.headers
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        data: responseData,
                        headers: res.headers
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        // リクエストボディを送信
        if (requestBody) {
            req.write(requestBody);
        }
        
        req.end();
    });
}

// テスト用のデータ
const testProductionData = [
    {
        date: '2025-01-15',
        materialType: 'bamboo',
        materialAmount: 100,
        charcoalProduced: 50,
        charcoalVolume: 30,
        extinguishingMethod: 'water',
        userId: 'test-user-1',
        groupId: TEST_GROUP_ID,
        notes: 'Test production 1'
    },
    {
        date: '2025-02-20',
        materialType: 'pruning',
        materialAmount: 80,
        charcoalProduced: 40,
        charcoalVolume: 25,
        extinguishingMethod: 'water',
        userId: 'test-user-2',
        groupId: TEST_GROUP_ID,
        notes: 'Test production 2'
    },
    {
        date: '2025-03-10',
        materialType: 'bamboo',
        materialAmount: 120,
        charcoalProduced: 60,
        charcoalVolume: 35,
        extinguishingMethod: 'water',
        userId: 'test-user-1',
        groupId: TEST_GROUP_ID,
        notes: 'Test production 3'
    },
    {
        date: '2024-12-05',
        materialType: 'herbaceous',
        materialAmount: 60,
        charcoalProduced: 30,
        charcoalVolume: 20,
        extinguishingMethod: 'water',
        userId: 'test-user-3',
        groupId: TEST_GROUP_ID,
        notes: 'Test production 4 (previous year)'
    }
];

// テスト用の設定データ
const testCalcSettings = {
    carbonContentFactors: {
        bamboo: 0.8,
        pruning: 0.8,
        herbaceous: 0.65,
        other: 0.8
    },
    co2ConversionFactor: 3.67,
    ipccLongTermFactors: {
        bamboo: 0.8,
        pruning: 0.8,
        herbaceous: 0.65,
        other: 0.8
    }
};

/**
 * テスト用のグループを作成
 */
async function createTestGroup() {
    try {
        console.log('👥 テスト用グループを作成中...');
        
        const groupData = {
            name: 'Test Group',
            description: 'Test group for production sum testing'
        };
        
        const response = await makeRequest('POST', `${BASE_URL}/group`, groupData, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (response.status === 201) {
            console.log('✅ テスト用グループを作成しました');
            return true;
        } else if (response.status === 409) {
            console.log('ℹ️ テスト用グループは既に存在します');
            return true;
        } else {
            console.log(`⚠️ グループ作成に問題があります: ${response.status}`);
            console.log('📊 レスポンス:', response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ グループ作成に失敗:', error.message);
        return false;
    }
}

/**
 * JWTトークンを取得
 */
async function getAuthToken() {
    try {
        console.log('🔐 認証トークンを取得中...');
        console.log(`📧 メールアドレス: ${TEST_USER_EMAIL}`);
        console.log(`🔗 API URL: ${BASE_URL}/auth/login`);
        
        const response = await makeRequest('POST', `${BASE_URL}/auth/login`, {
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD
        });
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        console.log(`📊 レスポンスデータ:`, JSON.stringify(response.data, null, 2));
        
        if (response.data && response.data.token) {
            authToken = response.data.token;
            console.log('✅ 認証トークンを取得しました');
            return true;
        } else {
            console.error('❌ 認証トークンの取得に失敗しました');
            console.error('📊 レスポンス詳細:', response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ 認証エラー:', error.message);
        console.error('❌ エラー詳細:', error);
        return false;
    }
}

/**
 * テスト用のProductionデータを作成
 */
async function createTestProductionData() {
    console.log('📝 テスト用のProductionデータを作成中...');
    
    for (let i = 0; i < testProductionData.length; i++) {
        const data = testProductionData[i];
        try {
            const response = await makeRequest('POST', `${BASE_URL}/production`, data, {
                'Authorization': `Bearer ${authToken}`
            });
            
            if (response.status === 201) {
                console.log(`✅ Production ${i + 1} を作成しました: ${data.materialType} (${data.date})`);
            } else {
                console.log(`⚠️ Production ${i + 1} の作成に問題があります: ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ Production ${i + 1} の作成に失敗:`, error.message);
        }
    }
}

/**
 * テスト用の設定データをアップロード
 */
async function uploadTestCalcSettings() {
    try {
        console.log('⚙️ テスト用の計算設定をアップロード中...');
        
        // 設定をアップロード（SaveCalcSettingsエンドポイントを使用）
        const response = await makeRequest('POST', `${BASE_URL}/calc-settings`, testCalcSettings, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (response.status === 200) {
            console.log('✅ 計算設定をアップロードしました');
        } else {
            console.log(`⚠️ 計算設定のアップロードに問題があります: ${response.status}`);
        }
        
    } catch (error) {
        console.error('❌ 計算設定のアップロードに失敗:', error.message);
    }
}

/**
 * CreateProductionSum APIをテスト
 */
async function testCreateProductionSum() {
    try {
        console.log('🧮 CreateProductionSum APIをテスト中...');
        
        const response = await makeRequest('POST', `${BASE_URL}/production-sum`, {}, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (response.status === 200) {
            console.log('✅ CreateProductionSum APIが正常に実行されました');
            console.log('📊 結果:', JSON.stringify(response.data, null, 2));
            
            // 結果の検証
            const result = response.data;
            if (result.totalGroups > 0) {
                console.log(`✅ ${result.totalGroups}個のグループが処理されました`);
                
                // 各グループのデータを検証
                result.data.forEach((group, index) => {
                    console.log(`\n📈 グループ ${index + 1}:`);
                    console.log(`  年: ${group.year}`);
                    console.log(`  グループID: ${group.groupId}`);
                    console.log(`  材料タイプ: ${group.materialType}`);
                    console.log(`  材料量: ${group.materialAmount}`);
                    console.log(`  炭生産量: ${group.charcoalProduced}`);
                    console.log(`  炭体積: ${group.charcoalVolume}`);
                    console.log(`  CO2削減量: ${group.co2Reduction}`);
                    console.log(`  炭素含有量: ${group.carbonContent}`);
                    console.log(`  IPCC長期: ${group.ipccLongTerm}`);
                });
                
                return true;
            } else {
                console.log('⚠️ 処理されたグループがありません');
                return false;
            }
        } else {
            console.log(`❌ CreateProductionSum APIの実行に失敗: ${response.status}`);
            return false;
        }
        
    } catch (error) {
        console.error('❌ CreateProductionSum APIのテストに失敗:', error.message);
        return false;
    }
}

/**
 * 期待される計算結果を検証
 */
function validateCalculations(data) {
    console.log('🔍 計算結果を検証中...');
    
    let allValid = true;
    
    data.forEach((group, index) => {
        console.log(`\n📊 グループ ${index + 1} の検証:`);
        
        // carbonContentの計算を検証
        const expectedCarbonContent = group.charcoalProduced * testCalcSettings.carbonContentFactors[group.materialType];
        if (Math.abs(group.carbonContent - expectedCarbonContent) < 0.01) {
            console.log(`✅ carbonContent計算: 正しい (${group.carbonContent})`);
        } else {
            console.log(`❌ carbonContent計算: 間違い (期待値: ${expectedCarbonContent}, 実際: ${group.carbonContent})`);
            allValid = false;
        }
        
        // co2Reductionの計算を検証
        const expectedCo2Reduction = group.carbonContent * testCalcSettings.co2ConversionFactor;
        if (Math.abs(group.co2Reduction - expectedCo2Reduction) < 0.01) {
            console.log(`✅ co2Reduction計算: 正しい (${group.co2Reduction})`);
        } else {
            console.log(`❌ co2Reduction計算: 間違い (期待値: ${expectedCo2Reduction}, 実際: ${group.co2Reduction})`);
            allValid = false;
        }
        
        // ipccLongTermの計算を検証
        const expectedIpccLongTerm = group.co2Reduction * testCalcSettings.ipccLongTermFactors[group.materialType];
        if (Math.abs(group.ipccLongTerm - expectedIpccLongTerm) < 0.01) {
            console.log(`✅ ipccLongTerm計算: 正しい (${group.ipccLongTerm})`);
        } else {
            console.log(`❌ ipccLongTerm計算: 間違い (期待値: ${expectedIpccLongTerm}, 実際: ${group.ipccLongTerm})`);
            allValid = false;
        }
    });
    
    return allValid;
}

/**
 * メインテスト実行
 */
async function runTest() {
    console.log('🚀 CreateProductionSum API テストを開始します\n');
    
    try {
        // 1. 認証
        const authSuccess = await getAuthToken();
        if (!authSuccess) {
            console.error('❌ 認証に失敗したため、テストを終了します');
            return;
        }
        
        // 2. テスト用グループの作成
        const groupCreated = await createTestGroup();
        if (!groupCreated) {
            console.error('❌ テスト用グループの作成に失敗したため、テストを終了します');
            return;
        }
        
        // 3. テスト用データの準備
        await createTestProductionData();
        await uploadTestCalcSettings();
        
        // 少し待機（データの反映を待つ）
        console.log('⏳ データの反映を待機中...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 4. CreateProductionSum APIのテスト
        const testSuccess = await testCreateProductionSum();
        
        if (testSuccess) {
            console.log('\n🎉 すべてのテストが正常に完了しました！');
        } else {
            console.log('\n❌ テストに失敗しました');
        }
        
    } catch (error) {
        console.error('❌ テスト実行中にエラーが発生しました:', error.message);
    }
}

// テスト実行
if (require.main === module) {
    runTest();
}

module.exports = {
    runTest,
    testCreateProductionSum,
    validateCalculations
};
