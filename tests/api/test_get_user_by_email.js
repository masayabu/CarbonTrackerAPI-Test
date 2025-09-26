/**
 * GetUserByEmail APIのテストスクリプト
 * 
 * このスクリプトは、メールアドレスからユーザーのRowKeyを取得するAPIが正しく動作するかをテストします。
 * 
 * 使用方法:
 * 1. まず、テスト用ユーザーを作成（test@example.com）
 * 2. GetUserByEmail APIをテスト
 * 3. 存在しないメールアドレスでのテスト
 */

const https = require('https');
const http = require('http');

// Node.js 18+ では fetch が利用可能
const fetch = globalThis.fetch || require('node-fetch');

// 設定
const BASE_URL = 'http://localhost:7071'; // ローカル開発環境の場合
// const BASE_URL = 'https://your-function-app.azurewebsites.net'; // Azure環境の場合

// テスト用のユーザー情報
const TEST_USER = {
    email: 'test@example.com',
    password: 'testpassword123',
    firstName: 'テスト',
    lastName: 'ユーザー',
    role: 'viewer'
};

/**
 * HTTPリクエストを送信する関数（fetch API使用）
 */
async function makeRequest(url, options = {}) {
    try {
        const fetchOptions = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'CarbonTrackerAPI-Test/1.0',
                ...options.headers
            }
        };

        if (options.body) {
            fetchOptions.body = JSON.stringify(options.body);
        }

        const response = await fetch(url, fetchOptions);
        const body = await response.text();
        
        return {
            statusCode: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body: body
        };
    } catch (error) {
        console.error('リクエストエラー:', error);
        throw error;
    }
}


/**
 * GetUserByEmail APIのテスト（成功ケース）
 */
async function testGetUserByEmailSuccess() {
    console.log('\n🔍 GetUserByEmail APIテスト（成功ケース）を開始...');
    
    try {
        const response = await makeRequest(`${BASE_URL}/api/users/email/${encodeURIComponent(TEST_USER.email)}`);

        console.log(`ステータス: ${response.statusCode}`);
        console.log('レスポンス:', response.body);
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            console.log('✅ GetUserByEmail APIが正常に動作しました');
            console.log(`RowKey: ${data.rowKey}`);
            console.log(`Email: ${data.email}`);
            console.log(`Name: ${data.lastName}${data.firstName}`);
            console.log(`Role: ${data.role}`);
            console.log(`Active: ${data.isActive}`);
            
            // レスポンスデータの検証
            if (data.rowKey && data.email === TEST_USER.email) {
                console.log('✅ レスポンスデータが正しく返されています');
                return { success: true, rowKey: data.rowKey };
            } else {
                console.log('❌ レスポンスデータが不正です');
                return { success: false };
            }
        } else {
            console.log('❌ GetUserByEmail APIの呼び出しに失敗');
            return { success: false };
        }
    } catch (error) {
        console.error('❌ GetUserByEmail APIテストエラー:', error.message);
        return { success: false };
    }
}

/**
 * GetUserByEmail APIのテスト（存在しないメールアドレス）
 */
async function testGetUserByEmailNotFound() {
    console.log('\n🔍 GetUserByEmail APIテスト（存在しないメールアドレス）を開始...');
    
    const nonExistentEmail = 'nonexistent@example.com';
    
    try {
        const response = await makeRequest(`${BASE_URL}/api/users/email/${encodeURIComponent(nonExistentEmail)}`);

        console.log(`ステータス: ${response.statusCode}`);
        console.log('レスポンス:', response.body);
        
        if (response.statusCode === 404) {
            console.log('✅ 存在しないメールアドレスに対して正しく404が返されました');
            return true;
        } else {
            console.log('❌ 存在しないメールアドレスに対して404が返されませんでした');
            return false;
        }
    } catch (error) {
        console.error('❌ 存在しないメールアドレステストエラー:', error.message);
        return false;
    }
}

/**
 * GetUserByEmail APIのテスト（無効なメールアドレス）
 */
async function testGetUserByEmailInvalid() {
    console.log('\n🔍 GetUserByEmail APIテスト（無効なメールアドレス）を開始...');
    
    const testCases = [
        { email: '', description: '空のメールアドレス' },
        { email: 'invalid-email', description: '無効な形式のメールアドレス' },
        { email: 'test@', description: 'ドメインが不完全なメールアドレス' },
        { email: '@example.com', description: 'ローカル部分が空のメールアドレス' }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
        console.log(`  📧 ${testCase.description}をテスト中...`);
        
        try {
            const response = await makeRequest(`${BASE_URL}/api/users/email/${encodeURIComponent(testCase.email)}`);

            console.log(`    ステータス: ${response.statusCode}`);
            console.log(`    レスポンス: ${response.body}`);
            
            if (response.statusCode === 400) {
                console.log(`    ✅ ${testCase.description}に対して正しく400が返されました`);
            } else {
                console.log(`    ❌ ${testCase.description}に対して400が返されませんでした`);
                allPassed = false;
            }
        } catch (error) {
            console.error(`    ❌ ${testCase.description}のテストエラー:`, error.message);
            allPassed = false;
        }
    }
    
    return allPassed;
}

/**
 * CORSヘッダーのテスト
 */
async function testCORSHeaders() {
    console.log('\n🌐 CORSヘッダーのテストを開始...');
    
    try {
        const response = await makeRequest(`${BASE_URL}/api/users/email/${encodeURIComponent(TEST_USER.email)}`);

        console.log('レスポンスヘッダー:', response.headers);
        
        const corsHeaders = [
            'access-control-allow-origin',
            'access-control-allow-credentials',
            'access-control-allow-methods',
            'access-control-allow-headers'
        ];
        
        let corsValid = true;
        corsHeaders.forEach(header => {
            if (response.headers[header]) {
                console.log(`✅ ${header}: ${response.headers[header]}`);
            } else {
                console.log(`❌ ${header} が設定されていません`);
                corsValid = false;
            }
        });
        
        if (corsValid) {
            console.log('✅ CORSヘッダーが正しく設定されています');
            return true;
        } else {
            console.log('❌ CORSヘッダーが正しく設定されていません');
            return false;
        }
    } catch (error) {
        console.error('❌ CORSヘッダーテストエラー:', error.message);
        return false;
    }
}

/**
 * OPTIONSリクエストのテスト
 */
async function testOptionsRequest() {
    console.log('\n🔧 OPTIONSリクエストのテストを開始...');
    
    try {
        const response = await makeRequest(`${BASE_URL}/api/users/email/${encodeURIComponent(TEST_USER.email)}`, {
            method: 'OPTIONS'
        });

        console.log(`ステータス: ${response.statusCode}`);
        console.log('レスポンスヘッダー:', response.headers);
        
        if (response.statusCode === 204) {
            console.log('✅ OPTIONSリクエストが正しく処理されました');
            return true;
        } else {
            console.log('❌ OPTIONSリクエストの処理に失敗');
            return false;
        }
    } catch (error) {
        console.error('❌ OPTIONSリクエストテストエラー:', error.message);
        return false;
    }
}

/**
 * メインテスト関数
 */
async function runTests() {
    console.log('🚀 GetUserByEmail APIのテストを開始します\n');
    
    let testResults = {
        successCase: false,
        notFoundCase: false,
        invalidCase: false,
        corsHeaders: false,
        optionsRequest: false
    };
    
    // 1. 成功ケースのテスト
    const successResult = await testGetUserByEmailSuccess();
    testResults.successCase = successResult.success;
    
    // 2. 存在しないメールアドレスのテスト
    testResults.notFoundCase = await testGetUserByEmailNotFound();
    
    // 3. 無効なメールアドレスのテスト
    testResults.invalidCase = await testGetUserByEmailInvalid();
    
    // 4. CORSヘッダーのテスト
    testResults.corsHeaders = await testCORSHeaders();
    
    // 5. OPTIONSリクエストのテスト
    testResults.optionsRequest = await testOptionsRequest();
    
    // 結果サマリー
    console.log('\n📊 テスト結果サマリー:');
    console.log(`成功ケース: ${testResults.successCase ? '✅' : '❌'}`);
    console.log(`存在しないメール: ${testResults.notFoundCase ? '✅' : '❌'}`);
    console.log(`無効なメール: ${testResults.invalidCase ? '✅' : '❌'}`);
    console.log(`CORSヘッダー: ${testResults.corsHeaders ? '✅' : '❌'}`);
    console.log(`OPTIONSリクエスト: ${testResults.optionsRequest ? '✅' : '❌'}`);
    
    const totalTests = Object.keys(testResults).length;
    const passedTests = Object.values(testResults).filter(result => result === true).length;
    
    console.log(`\n📈 テスト結果: ${passedTests}/${totalTests} 成功`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 すべてのテストが成功しました！GetUserByEmail APIは正しく動作しています。');
    } else {
        console.log('\n⚠️ 一部のテストが失敗しました。設定を確認してください。');
    }
    
    return testResults;
}

// テスト実行
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    runTests,
    testGetUserByEmailSuccess,
    testGetUserByEmailNotFound,
    testGetUserByEmailInvalid,
    testCORSHeaders,
    testOptionsRequest
};
