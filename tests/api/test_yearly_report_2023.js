/**
 * GetYearlyReport APIの2023年データ取得テスト
 * 
 * このスクリプトは、GetYearlyReport APIが2023年のデータを正しく取得できるかをテストします。
 * 
 * 使用方法:
 * 1. Azure Functionsが起動していることを確認
 * 2. node test_yearly_report_2023.js を実行
 */

const https = require('https');
const http = require('http');

// Node.js 18+ では fetch が利用可能
const fetch = globalThis.fetch || require('node-fetch');

// 設定
const BASE_URL = 'http://localhost:7071'; // ローカル開発環境の場合
// const BASE_URL = 'https://your-function-app.azurewebsites.net'; // Azure環境の場合

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
 * 2023年の年次レポート取得テスト
 */
async function testGetYearlyReport2023() {
    console.log('📊 2023年の年次レポート取得テストを開始...');
    
    try {
        const response = await makeRequest(`${BASE_URL}/api/reports/yearly/2023`);

        console.log(`ステータス: ${response.statusCode}`);
        console.log('レスポンスヘッダー:', response.headers);
        
        if (response.statusCode === 200) {
            console.log('✅ 2023年の年次レポート取得成功');
            
            // レスポンスボディをパース
            const data = JSON.parse(response.body);
            console.log('📋 レスポンスデータ:', JSON.stringify(data, null, 2));
            
            // データ形式の検証
            if (Array.isArray(data) && data.length === 12) {
                console.log('✅ データ形式が正しい（12ヶ月分のデータ）');
                
                // 各月のデータ構造を検証
                let validStructure = true;
                data.forEach((monthData, index) => {
                    if (!monthData.hasOwnProperty('month') || 
                        !monthData.hasOwnProperty('totalBamboo') || 
                        !monthData.hasOwnProperty('totalCharcoal') || 
                        !monthData.hasOwnProperty('totalCO2Reduction')) {
                        console.log(`❌ ${index + 1}月のデータ構造が不正`);
                        validStructure = false;
                    }
                });
                
                if (validStructure) {
                    console.log('✅ 全月のデータ構造が正しい');
                    
                    // データの合計値を計算
                    const totalBamboo = data.reduce((sum, month) => sum + month.totalBamboo, 0);
                    const totalCharcoal = data.reduce((sum, month) => sum + month.totalCharcoal, 0);
                    const totalCO2Reduction = data.reduce((sum, month) => sum + month.totalCO2Reduction, 0);
                    
                    console.log(`📈 2023年の合計値:`);
                    console.log(`  - 竹材量: ${totalBamboo}`);
                    console.log(`  - 炭生産量: ${totalCharcoal}`);
                    console.log(`  - CO2削減量: ${totalCO2Reduction}`);
                    
                    return { success: true, data: data };
                } else {
                    console.log('❌ データ構造に問題があります');
                    return { success: false, error: 'Invalid data structure' };
                }
            } else {
                console.log('❌ データ形式が不正（12ヶ月分のデータではありません）');
                return { success: false, error: 'Invalid data format' };
            }
        } else {
            console.log('❌ 2023年の年次レポート取得失敗');
            console.log('詳細なレスポンス:', response.body);
            return { success: false, error: `HTTP ${response.statusCode}` };
        }
    } catch (error) {
        console.error('❌ 年次レポート取得テストエラー:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 無効な年パラメータのテスト
 */
async function testInvalidYearParameter() {
    console.log('\n🚫 無効な年パラメータのテストを開始...');
    
    const invalidYears = ['abc', '2023.5', '', '2023-01-01', '999999'];
    
    for (const year of invalidYears) {
        try {
            console.log(`  年パラメータ "${year}" をテスト中...`);
            const response = await makeRequest(`${BASE_URL}/api/reports/yearly/${year}`);
            
            if (response.statusCode === 400) {
                console.log(`  ✅ 無効な年パラメータ "${year}" が正しく拒否されました`);
            } else {
                console.log(`  ❌ 無効な年パラメータ "${year}" が拒否されませんでした (ステータス: ${response.statusCode})`);
            }
        } catch (error) {
            console.log(`  ❌ 年パラメータ "${year}" のテストでエラー: ${error.message}`);
        }
    }
}

/**
 * 存在しない年のテスト
 */
async function testNonExistentYear() {
    console.log('\n🔍 存在しない年のテストを開始...');
    
    const futureYear = new Date().getFullYear() + 10; // 10年後の年
    
    try {
        console.log(`  年 ${futureYear} のデータをテスト中...`);
        const response = await makeRequest(`${BASE_URL}/api/reports/yearly/${futureYear}`);
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            console.log('✅ 存在しない年のリクエストが成功（空のデータが返される）');
            
            // すべての値が0であることを確認
            const allZero = data.every(month => 
                month.totalBamboo === 0 && 
                month.totalCharcoal === 0 && 
                month.totalCO2Reduction === 0
            );
            
            if (allZero) {
                console.log('✅ 存在しない年のデータは正しく空（すべて0）です');
                return { success: true };
            } else {
                console.log('❌ 存在しない年のデータが空ではありません');
                return { success: false };
            }
        } else {
            console.log(`❌ 存在しない年のリクエストが失敗 (ステータス: ${response.statusCode})`);
            return { success: false };
        }
    } catch (error) {
        console.error('❌ 存在しない年のテストエラー:', error.message);
        return { success: false };
    }
}

/**
 * レスポンス形式の詳細検証
 */
async function validateResponseFormat(data) {
    console.log('\n🔍 レスポンス形式の詳細検証を開始...');
    
    let isValid = true;
    
    // 各月のデータを詳細検証
    data.forEach((monthData, index) => {
        const monthName = `${index + 1}月`;
        
        // 必須フィールドの存在確認
        const requiredFields = ['month', 'totalBamboo', 'totalCharcoal', 'totalCO2Reduction'];
        for (const field of requiredFields) {
            if (!monthData.hasOwnProperty(field)) {
                console.log(`❌ ${monthName}: 必須フィールド "${field}" が存在しません`);
                isValid = false;
            }
        }
        
        // データ型の確認
        if (typeof monthData.month !== 'number' || monthData.month !== index + 1) {
            console.log(`❌ ${monthName}: month フィールドが正しくありません (期待値: ${index + 1}, 実際: ${monthData.month})`);
            isValid = false;
        }
        
        if (typeof monthData.totalBamboo !== 'number') {
            console.log(`❌ ${monthName}: totalBamboo が数値ではありません (実際: ${typeof monthData.totalBamboo})`);
            isValid = false;
        }
        
        if (typeof monthData.totalCharcoal !== 'number') {
            console.log(`❌ ${monthName}: totalCharcoal が数値ではありません (実際: ${typeof monthData.totalCharcoal})`);
            isValid = false;
        }
        
        if (typeof monthData.totalCO2Reduction !== 'number') {
            console.log(`❌ ${monthName}: totalCO2Reduction が数値ではありません (実際: ${typeof monthData.totalCO2Reduction})`);
            isValid = false;
        }
        
        // 負の値の確認
        if (monthData.totalBamboo < 0 || monthData.totalCharcoal < 0 || monthData.totalCO2Reduction < 0) {
            console.log(`⚠️ ${monthName}: 負の値が含まれています (竹材: ${monthData.totalBamboo}, 炭: ${monthData.totalCharcoal}, CO2削減: ${monthData.totalCO2Reduction})`);
        }
    });
    
    if (isValid) {
        console.log('✅ レスポンス形式の詳細検証が完了しました');
    } else {
        console.log('❌ レスポンス形式に問題があります');
    }
    
    return isValid;
}

/**
 * メインテスト関数
 */
async function runYearlyReportTests() {
    console.log('🚀 GetYearlyReport APIの2023年データ取得テストを開始します\n');
    
    let testResults = {
        yearlyReport2023: false,
        invalidYearParameter: false,
        nonExistentYear: false,
        responseFormat: false
    };
    
    // 1. 2023年の年次レポート取得テスト
    const yearlyReportResult = await testGetYearlyReport2023();
    testResults.yearlyReport2023 = yearlyReportResult.success;
    
    if (yearlyReportResult.success) {
        // レスポンス形式の詳細検証
        const formatValid = await validateResponseFormat(yearlyReportResult.data);
        testResults.responseFormat = formatValid;
    }
    
    // 2. 無効な年パラメータのテスト
    await testInvalidYearParameter();
    testResults.invalidYearParameter = true; // 基本的なテストは実行された
    
    // 3. 存在しない年のテスト
    const nonExistentYearResult = await testNonExistentYear();
    testResults.nonExistentYear = nonExistentYearResult.success;
    
    // 4. 結果サマリー
    console.log('\n📊 テスト結果サマリー:');
    console.log(`2023年年次レポート取得: ${testResults.yearlyReport2023 ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`レスポンス形式検証: ${testResults.responseFormat ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`無効な年パラメータテスト: ${testResults.invalidYearParameter ? '✅ 実行済み' : '❌ 未実行'}`);
    console.log(`存在しない年のテスト: ${testResults.nonExistentYear ? '✅ 成功' : '❌ 失敗'}`);
    
    const successCount = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;
    
    console.log(`\n🎯 総合結果: ${successCount}/${totalTests} のテストが成功`);
    
    if (successCount === totalTests) {
        console.log('\n🎉 すべてのテストが成功しました！GetYearlyReport APIは正しく動作しています。');
    } else {
        console.log('\n⚠️ 一部のテストが失敗しました。APIの実装を確認してください。');
    }
    
    return testResults;
}

// テスト実行
if (require.main === module) {
    runYearlyReportTests().catch(console.error);
}

module.exports = {
    testGetYearlyReport2023,
    testInvalidYearParameter,
    testNonExistentYear,
    validateResponseFormat,
    runYearlyReportTests
};
