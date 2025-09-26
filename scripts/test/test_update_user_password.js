const https = require('https');
const http = require('http');

// 設定
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:7071/api';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminpassword';

// テスト用のJWTトークン
let testUserToken = null;
let adminToken = null;

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

/**
 * テストユーザーでログインしてトークンを取得
 */
async function getTestUserToken() {
    try {
        console.log('🔐 テストユーザーの認証トークンを取得中...');
        console.log(`📧 メールアドレス: ${TEST_USER_EMAIL}`);
        
        const response = await makeRequest('POST', `${BASE_URL}/auth/login`, {
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD
        });
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        
        if (response.data && response.data.token) {
            testUserToken = response.data.token;
            console.log('✅ テストユーザーの認証トークンを取得しました');
            return true;
        } else {
            console.error('❌ テストユーザーの認証トークンの取得に失敗しました');
            console.error('📊 レスポンス詳細:', response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ テストユーザー認証エラー:', error.message);
        return false;
    }
}

/**
 * 管理者でログインしてトークンを取得
 */
async function getAdminToken() {
    try {
        console.log('🔐 管理者の認証トークンを取得中...');
        console.log(`📧 メールアドレス: ${ADMIN_EMAIL}`);
        
        const response = await makeRequest('POST', `${BASE_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        
        if (response.data && response.data.token) {
            adminToken = response.data.token;
            console.log('✅ 管理者の認証トークンを取得しました');
            return true;
        } else {
            console.error('❌ 管理者の認証トークンの取得に失敗しました');
            console.error('📊 レスポンス詳細:', response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ 管理者認証エラー:', error.message);
        return false;
    }
}

/**
 * ユーザー情報を取得
 */
async function getUserInfo(token, userId) {
    try {
        console.log(`👤 ユーザー情報を取得中... (ID: ${userId})`);
        
        const response = await makeRequest('GET', `${BASE_URL}/me`, null, {
            'Authorization': `Bearer ${token}`
        });
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        
        if (response.status === 200) {
            console.log('✅ ユーザー情報を取得しました');
            return response.data;
        } else {
            console.error('❌ ユーザー情報の取得に失敗しました');
            console.error('📊 レスポンス詳細:', response.data);
            return null;
        }
    } catch (error) {
        console.error('❌ ユーザー情報取得エラー:', error.message);
        return null;
    }
}

/**
 * 自分のパスワードを更新（正常ケース）
 */
async function testUpdateOwnPassword() {
    try {
        console.log('🔐 自分のパスワード更新テスト（正常ケース）...');
        
        const passwordData = {
            currentPassword: TEST_USER_PASSWORD,
            newPassword: 'newtestpassword123'
        };
        
        // まずユーザー情報を取得してIDを取得
        const userInfo = await getUserInfo(testUserToken, 'me');
        if (!userInfo || !userInfo.rowKey) {
            console.error('❌ ユーザー情報の取得に失敗しました');
            return false;
        }
        
        const response = await makeRequest('PUT', `${BASE_URL}/users/update-password/${userInfo.rowKey}`, passwordData, {
            'Authorization': `Bearer ${testUserToken}`
        });
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        console.log(`📊 レスポンスデータ:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 200) {
            console.log('✅ 自分のパスワード更新が成功しました');
            return true;
        } else {
            console.error('❌ 自分のパスワード更新に失敗しました');
            return false;
        }
    } catch (error) {
        console.error('❌ 自分のパスワード更新テストエラー:', error.message);
        return false;
    }
}

/**
 * 新しいパスワードでログインテスト
 */
async function testLoginWithNewPassword() {
    try {
        console.log('🔐 新しいパスワードでログインテスト...');
        
        const response = await makeRequest('POST', `${BASE_URL}/auth/login`, {
            email: TEST_USER_EMAIL,
            password: 'newtestpassword123'
        });
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        
        if (response.data && response.data.token) {
            console.log('✅ 新しいパスワードでログインに成功しました');
            return true;
        } else {
            console.error('❌ 新しいパスワードでログインに失敗しました');
            console.error('📊 レスポンス詳細:', response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ 新しいパスワードログインテストエラー:', error.message);
        return false;
    }
}

/**
 * 間違った現在のパスワードで更新テスト（エラーケース）
 */
async function testUpdateWithWrongCurrentPassword() {
    try {
        console.log('🔐 間違った現在のパスワードで更新テスト（エラーケース）...');
        
        const passwordData = {
            currentPassword: 'wrongpassword',
            newPassword: 'anothernewpassword123'
        };
        
        // ユーザー情報を取得してIDを取得
        const userInfo = await getUserInfo(testUserToken, 'me');
        if (!userInfo || !userInfo.rowKey) {
            console.error('❌ ユーザー情報の取得に失敗しました');
            return false;
        }
        
        const response = await makeRequest('PUT', `${BASE_URL}/users/update-password/${userInfo.rowKey}`, passwordData, {
            'Authorization': `Bearer ${testUserToken}`
        });
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        console.log(`📊 レスポンスデータ:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 400 && response.data.error && response.data.error.includes('Current password is incorrect')) {
            console.log('✅ 間違った現在のパスワードでエラーが正しく返されました');
            return true;
        } else {
            console.error('❌ 間違った現在のパスワードのエラーハンドリングが正しくありません');
            return false;
        }
    } catch (error) {
        console.error('❌ 間違った現在のパスワードテストエラー:', error.message);
        return false;
    }
}

/**
 * 短いパスワードで更新テスト（バリデーションエラー）
 */
async function testUpdateWithShortPassword() {
    try {
        console.log('🔐 短いパスワードで更新テスト（バリデーションエラー）...');
        
        const passwordData = {
            currentPassword: 'newtestpassword123',
            newPassword: '123'
        };
        
        // ユーザー情報を取得してIDを取得
        const userInfo = await getUserInfo(testUserToken, 'me');
        if (!userInfo || !userInfo.rowKey) {
            console.error('❌ ユーザー情報の取得に失敗しました');
            return false;
        }
        
        const response = await makeRequest('PUT', `${BASE_URL}/users/update-password/${userInfo.rowKey}`, passwordData, {
            'Authorization': `Bearer ${testUserToken}`
        });
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        console.log(`📊 レスポンスデータ:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 400 && response.data.error && response.data.error.includes('at least 8 characters')) {
            console.log('✅ 短いパスワードのバリデーションエラーが正しく返されました');
            return true;
        } else {
            console.error('❌ 短いパスワードのバリデーションエラーハンドリングが正しくありません');
            return false;
        }
    } catch (error) {
        console.error('❌ 短いパスワードテストエラー:', error.message);
        return false;
    }
}

/**
 * 管理者による他ユーザーのパスワード更新テスト
 */
async function testAdminUpdateOtherUserPassword() {
    try {
        console.log('🔐 管理者による他ユーザーのパスワード更新テスト...');
        
        const passwordData = {
            newPassword: 'adminupdatedpassword123'
        };
        
        // 管理者の情報を取得（管理者が自分のパスワードを更新）
        const adminInfo = await getUserInfo(adminToken, 'me');
        if (!adminInfo || !adminInfo.rowKey) {
            console.error('❌ 管理者情報の取得に失敗しました');
            return false;
        }
        
        const response = await makeRequest('PUT', `${BASE_URL}/users/update-password/${adminInfo.rowKey}`, passwordData, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        console.log(`📊 レスポンスデータ:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 200) {
            console.log('✅ 管理者によるパスワード更新が成功しました');
            return true;
        } else {
            console.error('❌ 管理者によるパスワード更新に失敗しました');
            return false;
        }
    } catch (error) {
        console.error('❌ 管理者による他ユーザーのパスワード更新テストエラー:', error.message);
        return false;
    }
}

/**
 * 管理者が更新したパスワードでログインテスト
 */
async function testLoginWithAdminUpdatedPassword() {
    try {
        console.log('🔐 管理者が更新したパスワードでログインテスト...');
        
        const response = await makeRequest('POST', `${BASE_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: 'adminupdatedpassword123'
        });
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        
        if (response.data && response.data.token) {
            console.log('✅ 管理者が更新したパスワードでログインに成功しました');
            return true;
        } else {
            console.error('❌ 管理者が更新したパスワードでログインに失敗しました');
            console.error('📊 レスポンス詳細:', response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ 管理者が更新したパスワードログインテストエラー:', error.message);
        return false;
    }
}

/**
 * 権限のないユーザーによる他ユーザーのパスワード更新テスト（エラーケース）
 */
async function testUnauthorizedUpdateOtherUserPassword() {
    try {
        console.log('🔐 権限のないユーザーによる他ユーザーのパスワード更新テスト（エラーケース）...');
        
        const passwordData = {
            newPassword: 'unauthorizedpassword123'
        };
        
        // 管理者の情報を取得（テストユーザーが管理者のパスワードを更新しようとする）
        const adminInfo = await getUserInfo(adminToken, 'me');
        if (!adminInfo || !adminInfo.rowKey) {
            console.error('❌ 管理者情報の取得に失敗しました');
            return false;
        }
        
        const response = await makeRequest('PUT', `${BASE_URL}/users/update-password/${adminInfo.rowKey}`, passwordData, {
            'Authorization': `Bearer ${testUserToken}`
        });
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        console.log(`📊 レスポンスデータ:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 403 && response.data.error && response.data.error.includes('Forbidden')) {
            console.log('✅ 権限のないユーザーによる更新が正しく拒否されました');
            return true;
        } else {
            console.error('❌ 権限チェックが正しく動作していません');
            return false;
        }
    } catch (error) {
        console.error('❌ 権限のないユーザーの更新テストエラー:', error.message);
        return false;
    }
}

/**
 * トークンなしでの更新テスト（認証エラー）
 */
async function testUpdateWithoutToken() {
    try {
        console.log('🔐 トークンなしでの更新テスト（認証エラー）...');
        
        const passwordData = {
            currentPassword: 'adminupdatedpassword123',
            newPassword: 'notokenpassword123'
        };
        
        // テストユーザーの情報を取得
        const userInfo = await getUserInfo(testUserToken, 'me');
        if (!userInfo || !userInfo.rowKey) {
            console.error('❌ テストユーザー情報の取得に失敗しました');
            return false;
        }
        
        const response = await makeRequest('PUT', `${BASE_URL}/users/update-password/${userInfo.rowKey}`, passwordData);
        
        console.log(`📊 レスポンスステータス: ${response.status}`);
        console.log(`📊 レスポンスデータ:`, JSON.stringify(response.data, null, 2));
        
        if (response.status === 401 && response.data.error && response.data.error.includes('Unauthorized')) {
            console.log('✅ トークンなしでの更新が正しく拒否されました');
            return true;
        } else {
            console.error('❌ 認証チェックが正しく動作していません');
            return false;
        }
    } catch (error) {
        console.error('❌ トークンなし更新テストエラー:', error.message);
        return false;
    }
}

/**
 * メインテスト実行
 */
async function runTest() {
    console.log('🚀 UpdateUserPassword API テストを開始します\n');
    
    let testResults = {
        total: 0,
        passed: 0,
        failed: 0
    };
    
    const runTest = async (testName, testFunction) => {
        testResults.total++;
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🧪 テスト: ${testName}`);
        console.log(`${'='.repeat(60)}`);
        
        try {
            const result = await testFunction();
            if (result) {
                testResults.passed++;
                console.log(`✅ ${testName} - 成功`);
            } else {
                testResults.failed++;
                console.log(`❌ ${testName} - 失敗`);
            }
        } catch (error) {
            testResults.failed++;
            console.log(`❌ ${testName} - エラー: ${error.message}`);
        }
    };
    
    try {
        // 1. 認証
        console.log('🔐 認証テスト...');
        const testUserAuth = await getTestUserToken();
        const adminAuth = await getAdminToken();
        
        if (!testUserAuth || !adminAuth) {
            console.error('❌ 認証に失敗したため、テストを終了します');
            return;
        }
        
        // 2. 正常ケースのテスト
        await runTest('自分のパスワード更新（正常ケース）', testUpdateOwnPassword);
        await runTest('新しいパスワードでログイン', testLoginWithNewPassword);
        await runTest('管理者による他ユーザーのパスワード更新', testAdminUpdateOtherUserPassword);
        await runTest('管理者が更新したパスワードでログイン', testLoginWithAdminUpdatedPassword);
        
        // 3. エラーケースのテスト
        await runTest('間違った現在のパスワードで更新', testUpdateWithWrongCurrentPassword);
        await runTest('短いパスワードで更新（バリデーションエラー）', testUpdateWithShortPassword);
        await runTest('権限のないユーザーによる他ユーザーのパスワード更新', testUnauthorizedUpdateOtherUserPassword);
        await runTest('トークンなしでの更新（認証エラー）', testUpdateWithoutToken);
        
        // 4. テスト結果の表示
        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 テスト結果サマリー');
        console.log(`${'='.repeat(60)}`);
        console.log(`総テスト数: ${testResults.total}`);
        console.log(`成功: ${testResults.passed}`);
        console.log(`失敗: ${testResults.failed}`);
        console.log(`成功率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
        
        if (testResults.failed === 0) {
            console.log('\n🎉 すべてのテストが正常に完了しました！');
        } else {
            console.log('\n⚠️ 一部のテストが失敗しました');
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
    testUpdateOwnPassword,
    testLoginWithNewPassword,
    testUpdateWithWrongCurrentPassword,
    testUpdateWithShortPassword,
    testAdminUpdateOtherUserPassword,
    testLoginWithAdminUpdatedPassword,
    testUnauthorizedUpdateOtherUserPassword,
    testUpdateWithoutToken
};
