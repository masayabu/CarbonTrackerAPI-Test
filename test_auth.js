/**
 * JWT認証システムのテストスクリプト
 * 
 * このスクリプトは、実装したJWT認証システムが正しく動作するかをテストします。
 * 
 * 使用方法:
 * 1. まず、LoginUser APIでログインしてトークンを取得
 * 2. 取得したトークンを使用して他のAPIをテスト
 */

const https = require('https');
const http = require('http');

// Node.js 18+ では fetch が利用可能
const fetch = globalThis.fetch || require('node-fetch');

// 設定
const BASE_URL = 'http://localhost:7071'; // ローカル開発環境の場合
// const BASE_URL = 'https://your-function-app.azurewebsites.net'; // Azure環境の場合

// テスト用のユーザー情報
const TEST_USERS = [
    {
        email: 'admin@carbontracker.local',
        password: 'admin123',
        role: 'admin'
    },
    {
        email: 'test@example.com',
        password: 'testpassword',
        role: 'user'
    },
    {
        email: 'admin@example.com',
        password: 'adminpassword',
        role: 'admin'
    },
    {
        email: 'operator@example.com',
        password: 'operatorpassword',
        role: 'operator'
    }
];

// デフォルトのテストユーザー（既存の管理者ユーザー）
const TEST_USER = TEST_USERS[0];

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
 * ログインテスト
 */
async function testLogin() {
    console.log('🔐 ログインテストを開始...');
    
    try {
        const response = await makeRequest(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            body: TEST_USER
        });

        console.log(`ステータス: ${response.statusCode}`);
        console.log('レスポンスヘッダー:', response.headers);
        console.log('レスポンスボディ:', response.body);
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            console.log('✅ ログイン成功');
            console.log(`ユーザー: ${data.email}`);
            console.log(`ロール: ${data.role}`);
            console.log(`トークン: ${data.token.substring(0, 20)}...`);
            return data.token;
        } else {
            console.log('❌ ログイン失敗');
            console.log('詳細なレスポンス:', response.body);
            return null;
        }
    } catch (error) {
        console.error('❌ ログインテストエラー:', error.message);
        return null;
    }
}

/**
 * 認証が必要なAPIのテスト
 */
async function testProtectedAPI(token, apiPath, method = 'GET') {
    console.log(`\n🔒 ${apiPath} のテストを開始...`);
    
    try {
        const response = await makeRequest(`${BASE_URL}/api${apiPath}`, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`ステータス: ${response.statusCode}`);
        
        if (response.statusCode === 200 || response.statusCode === 201) {
            console.log('✅ API呼び出し成功');
            return true;
        } else if (response.statusCode === 401) {
            console.log('❌ 認証失敗 - トークンが無効または期限切れ');
            return false;
        } else if (response.statusCode === 403) {
            console.log('⚠️ 権限不足 - 管理者またはオペレーター権限が必要');
            return false;
        } else {
            console.log('❌ API呼び出し失敗');
            console.log('レスポンス:', response.body);
            return false;
        }
    } catch (error) {
        console.error('❌ APIテストエラー:', error.message);
        return false;
    }
}

/**
 * 認証なしでのAPIアクセステスト
 */
async function testUnauthorizedAccess(apiPath, method = 'GET') {
    console.log(`\n🚫 認証なしで ${apiPath} にアクセステスト...`);
    
    try {
        const response = await makeRequest(`${BASE_URL}/api${apiPath}`, {
            method: method
        });

        console.log(`ステータス: ${response.statusCode}`);
        
        if (response.statusCode === 401) {
            console.log('✅ 認証が正しく要求されている');
            return true;
        } else {
            console.log('❌ 認証が要求されていない - セキュリティ問題');
            console.log('レスポンス:', response.body);
            return false;
        }
    } catch (error) {
        console.error('❌ 認証なしアクセステストエラー:', error.message);
        return false;
    }
}

/**
 * メインテスト関数
 */
async function runTests() {
    console.log('🚀 JWT認証システムのテストを開始します\n');
    
    // 利用可能なテストユーザーを表示
    console.log('📋 利用可能なテストユーザー:');
    TEST_USERS.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email} (${user.role}) - パスワード: ${user.password}`);
    });
    console.log();
    
    // 1. ログインテスト
    const token = await testLogin();
    if (!token) {
        console.log('\n❌ ログインに失敗したため、テストを終了します');
        console.log('💡 ヒント: テストユーザーが作成されているか確認してください:');
        console.log('   python create_test_user.py');
        return;
    }

    // 2. 認証が必要なAPIのテスト
    const protectedAPIs = [
        { path: '/groups', method: 'GET' },
        { path: '/groups/test-group-id', method: 'GET' },
        { path: '/productions?groupId=test-group-id', method: 'GET' },
        { path: '/production', method: 'POST' },
        { path: '/dashboard?groupId=test-group-id', method: 'GET' },
        { path: '/export-data', method: 'GET' }
    ];

    let successCount = 0;
    for (const api of protectedAPIs) {
        const success = await testProtectedAPI(token, api.path, api.method);
        if (success) successCount++;
    }

    // 3. 認証なしでのアクセステスト
    console.log('\n🔒 認証なしアクセステストを開始...');
    let unauthorizedTestCount = 0;
    for (const api of protectedAPIs) {
        const success = await testUnauthorizedAccess(api.path, api.method);
        if (success) unauthorizedTestCount++;
    }

    // 4. 結果サマリー
    console.log('\n📊 テスト結果サマリー:');
    console.log(`認証ありAPIテスト: ${successCount}/${protectedAPIs.length} 成功`);
    console.log(`認証なしアクセステスト: ${unauthorizedTestCount}/${protectedAPIs.length} 成功`);
    
    if (successCount === protectedAPIs.length && unauthorizedTestCount === protectedAPIs.length) {
        console.log('\n🎉 すべてのテストが成功しました！JWT認証システムは正しく動作しています。');
    } else {
        console.log('\n⚠️ 一部のテストが失敗しました。設定を確認してください。');
    }
}

// テスト実行
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    testLogin,
    testProtectedAPI,
    testUnauthorizedAccess,
    runTests
};
