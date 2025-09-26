const https = require('https');
const http = require('http');

// テスト設定
const BASE_URL = process.env.BASE_URL || 'http://localhost:7071';

/**
 * HTTPリクエストを送信する関数
 */
async function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const client = isHttps ? https : http;
        
        const requestOptions = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: 10000 // 10秒のタイムアウト
        };

        const req = client.request(url, requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
}

/**
 * ヘルスチェックAPIのテスト
 */
async function testHealthCheck() {
    console.log('🏥 ヘルスチェックAPIのテストを開始...');
    
    try {
        const response = await makeRequest(`${BASE_URL}/api/health`);
        
        console.log(`ステータスコード: ${response.statusCode}`);
        
        if (response.statusCode === 200) {
            console.log('✅ ヘルスチェックAPIが正常に動作しています');
            
            try {
                const data = JSON.parse(response.body);
                console.log('📊 レスポンスデータ:');
                console.log(`  - ステータス: ${data.status}`);
                console.log(`  - タイムスタンプ: ${data.timestamp}`);
                console.log(`  - サーバー: ${data.server}`);
                console.log(`  - バージョン: ${data.version}`);
                console.log(`  - 稼働時間: ${data.uptime}秒`);
                
                // レスポンスデータの検証
                if (data.status === 'healthy' && data.server === 'CarbonTrackerAPI') {
                    console.log('✅ レスポンスデータが正しい形式です');
                    return true;
                } else {
                    console.log('❌ レスポンスデータの形式が正しくありません');
                    return false;
                }
            } catch (parseError) {
                console.log('❌ レスポンスのJSON解析に失敗しました');
                console.log('レスポンスボディ:', response.body);
                return false;
            }
        } else {
            console.log(`❌ ヘルスチェックAPIが異常なステータスコードを返しました: ${response.statusCode}`);
            console.log('レスポンスボディ:', response.body);
            return false;
        }
    } catch (error) {
        console.log(`❌ ヘルスチェックAPIのテストに失敗しました: ${error.message}`);
        return false;
    }
}

/**
 * CORSヘッダーのテスト
 */
async function testCorsHeaders() {
    console.log('\n🌐 CORSヘッダーのテストを開始...');
    
    try {
        const response = await makeRequest(`${BASE_URL}/api/health`);
        
        const corsHeaders = {
            'Access-Control-Allow-Origin': response.headers['access-control-allow-origin'],
            'Access-Control-Allow-Methods': response.headers['access-control-allow-methods'],
            'Access-Control-Allow-Headers': response.headers['access-control-allow-headers']
        };
        
        console.log('📋 CORSヘッダー:');
        console.log(`  - Access-Control-Allow-Origin: ${corsHeaders['Access-Control-Allow-Origin']}`);
        console.log(`  - Access-Control-Allow-Methods: ${corsHeaders['Access-Control-Allow-Methods']}`);
        console.log(`  - Access-Control-Allow-Headers: ${corsHeaders['Access-Control-Allow-Headers']}`);
        
        if (corsHeaders['Access-Control-Allow-Origin'] === '*') {
            console.log('✅ CORSヘッダーが正しく設定されています');
            return true;
        } else {
            console.log('❌ CORSヘッダーが正しく設定されていません');
            return false;
        }
    } catch (error) {
        console.log(`❌ CORSヘッダーのテストに失敗しました: ${error.message}`);
        return false;
    }
}

/**
 * OPTIONSリクエストのテスト
 */
async function testOptionsRequest() {
    console.log('\n🔧 OPTIONSリクエストのテストを開始...');
    
    try {
        const response = await makeRequest(`${BASE_URL}/api/health`, {
            method: 'OPTIONS'
        });
        
        console.log(`ステータスコード: ${response.statusCode}`);
        
        if (response.statusCode === 200) {
            console.log('✅ OPTIONSリクエストが正常に処理されました');
            return true;
        } else {
            console.log(`❌ OPTIONSリクエストが異常なステータスコードを返しました: ${response.statusCode}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ OPTIONSリクエストのテストに失敗しました: ${error.message}`);
        return false;
    }
}

/**
 * メインテスト関数
 */
async function runTests() {
    console.log('🚀 ヘルスチェックAPIのテストを開始します\n');
    console.log(`🔗 テスト対象URL: ${BASE_URL}/api/health\n`);
    
    let successCount = 0;
    let totalTests = 0;
    
    // 1. ヘルスチェックAPIのテスト
    totalTests++;
    if (await testHealthCheck()) {
        successCount++;
    }
    
    // 2. CORSヘッダーのテスト
    totalTests++;
    if (await testCorsHeaders()) {
        successCount++;
    }
    
    // 3. OPTIONSリクエストのテスト
    totalTests++;
    if (await testOptionsRequest()) {
        successCount++;
    }
    
    // テスト結果の表示
    console.log('\n📊 テスト結果:');
    console.log(`✅ 成功: ${successCount}/${totalTests}`);
    console.log(`❌ 失敗: ${totalTests - successCount}/${totalTests}`);
    
    if (successCount === totalTests) {
        console.log('\n🎉 すべてのテストが成功しました！');
        console.log('\n💡 使用方法:');
        console.log('curl -s http://localhost:7071/api/health || echo "バックエンドサーバーが起動していません"');
        process.exit(0);
    } else {
        console.log('\n⚠️ 一部のテストが失敗しました');
        process.exit(1);
    }
}

// テスト実行
runTests().catch((error) => {
    console.error('❌ テスト実行中にエラーが発生しました:', error.message);
    process.exit(1);
});
