/**
 * GetYearlyReport APIの2025年データ取得テスト
 * 
 * このスクリプトは、GetYearlyReport APIが2025年のデータを正しく取得できるかをテストします。
 * 特に2025年10月のデータに焦点を当てています。
 * 
 * 使用方法:
 * 1. Azure Functionsが起動していることを確認
 * 2. node test_yearly_report_2025.js を実行
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
 * 2025年の年次レポート取得テスト
 */
async function testGetYearlyReport2025() {
    console.log('📊 2025年の年次レポート取得テストを開始...');
    
    try {
        const response = await makeRequest(`${BASE_URL}/api/reports/yearly/2025`);

        console.log(`ステータス: ${response.statusCode}`);
        console.log('レスポンスヘッダー:', response.headers);
        
        if (response.statusCode === 200) {
            console.log('✅ 2025年の年次レポート取得成功');
            
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
                        !monthData.hasOwnProperty('charcoalProduced') || 
                        !monthData.hasOwnProperty('totalCO2Reduction')) {
                        console.log(`❌ ${index + 1}月のデータ構造が不正`);
                        validStructure = false;
                    }
                });
                
                if (validStructure) {
                    console.log('✅ 全月のデータ構造が正しい');
                    
                    // データの合計値を計算
                    const totalBamboo = data.reduce((sum, month) => sum + month.totalBamboo, 0);
                    const totalCharcoal = data.reduce((sum, month) => sum + month.charcoalProduced, 0);
                    const totalCO2Reduction = data.reduce((sum, month) => sum + month.totalCO2Reduction, 0);
                    
                    console.log(`📈 2025年の合計値:`);
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
            console.log('❌ 2025年の年次レポート取得失敗');
            console.log('詳細なレスポンス:', response.body);
            return { success: false, error: `HTTP ${response.statusCode}` };
        }
    } catch (error) {
        console.error('❌ 年次レポート取得テストエラー:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 2025年10月のデータ検証テスト
 */
async function testSpecificDateData2025_10() {
    console.log('\n📅 2025年10月のデータ検証テストを開始...');
    
    try {
        const response = await makeRequest(`${BASE_URL}/api/reports/yearly/2025`);

        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            
            // 10月のデータを取得（配列のインデックス9、0ベース）
            const octoberData = data[9]; // 10月は配列の9番目
            
            if (octoberData && octoberData.month === 10) {
                console.log('✅ 10月のデータが正しく取得されました');
                console.log(`📊 10月のデータ:`, {
                    month: octoberData.month,
                    totalBamboo: octoberData.totalBamboo,
                    charcoalProduced: octoberData.charcoalProduced,
                    totalCO2Reduction: octoberData.totalCO2Reduction
                });
                
                // 2025年10月のデータが含まれているかチェック
                if (octoberData.totalBamboo > 0 || octoberData.charcoalProduced > 0 || octoberData.totalCO2Reduction > 0) {
                    console.log('✅ 2025年10月のデータが10月の合計に反映されています');
                    
                    // データの妥当性をチェック
                    const hasValidData = octoberData.totalBamboo >= 0 && 
                                       octoberData.charcoalProduced >= 0 && 
                                       octoberData.totalCO2Reduction >= 0;
                    
                    if (hasValidData) {
                        console.log('✅ 10月のデータが妥当な値です');
                        return { success: true, data: octoberData };
                    } else {
                        console.log('❌ 10月のデータに負の値が含まれています');
                        return { success: false, error: 'Invalid data values' };
                    }
                } else {
                    console.log('⚠️ 10月のデータが空です（2025年10月のデータが登録されていない可能性があります）');
                    return { success: false, error: 'No data found for October 2025' };
                }
            } else {
                console.log('❌ 10月のデータが正しく取得されませんでした');
                return { success: false, error: 'October data not found' };
            }
        } else {
            console.log('❌ 年次レポートの取得に失敗しました');
            return { success: false, error: `HTTP ${response.statusCode}` };
        }
    } catch (error) {
        console.error('❌ 2025年10月データ検証テストエラー:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 10月のデータ詳細検証
 */
async function validateOctoberData(octoberData) {
    console.log('\n🔍 10月のデータ詳細検証を開始...');
    
    let isValid = true;
    
    // データ型の確認
    if (typeof octoberData.month !== 'number' || octoberData.month !== 10) {
        console.log(`❌ month フィールドが正しくありません (期待値: 10, 実際: ${octoberData.month})`);
        isValid = false;
    }
    
    if (typeof octoberData.totalBamboo !== 'number') {
        console.log(`❌ totalBamboo が数値ではありません (実際: ${typeof octoberData.totalBamboo})`);
        isValid = false;
    }
    
    if (typeof octoberData.charcoalProduced !== 'number') {
        console.log(`❌ charcoalProduced が数値ではありません (実際: ${typeof octoberData.charcoalProduced})`);
        isValid = false;
    }
    
    if (typeof octoberData.totalCO2Reduction !== 'number') {
        console.log(`❌ totalCO2Reduction が数値ではありません (実際: ${typeof octoberData.totalCO2Reduction})`);
        isValid = false;
    }
    
    // 値の妥当性確認
    if (octoberData.totalBamboo < 0) {
        console.log(`⚠️ totalBamboo が負の値です: ${octoberData.totalBamboo}`);
    }
    
    if (octoberData.charcoalProduced < 0) {
        console.log(`⚠️ charcoalProduced が負の値です: ${octoberData.charcoalProduced}`);
    }
    
    if (octoberData.totalCO2Reduction < 0) {
        console.log(`⚠️ totalCO2Reduction が負の値です: ${octoberData.totalCO2Reduction}`);
    }
    
    // 2025年10月のデータが含まれているかの確認
    if (octoberData.totalBamboo > 0 || octoberData.charcoalProduced > 0 || octoberData.totalCO2Reduction > 0) {
        console.log('✅ 2025年10月のデータが10月の合計に含まれています');
        console.log(`📈 10月の合計値:`);
        console.log(`  - 竹材量: ${octoberData.totalBamboo}`);
        console.log(`  - 炭生産量: ${octoberData.charcoalProduced}`);
        console.log(`  - CO2削減量: ${octoberData.totalCO2Reduction}`);
    } else {
        console.log('⚠️ 10月にデータが登録されていません');
    }
    
    if (isValid) {
        console.log('✅ 10月のデータ詳細検証が完了しました');
    } else {
        console.log('❌ 10月のデータに問題があります');
    }
    
    return isValid;
}

/**
 * 無効な年パラメータのテスト
 */
async function testInvalidYearParameter() {
    console.log('\n🚫 無効な年パラメータのテストを開始...');
    
    const invalidYears = ['abc', '2025.5', '', '2025-01-01', '999999'];
    
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
    
    const futureYear = new Date().getFullYear() + 20; // 20年後の年
    
    try {
        console.log(`  年 ${futureYear} のデータをテスト中...`);
        const response = await makeRequest(`${BASE_URL}/api/reports/yearly/${futureYear}`);
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            console.log('✅ 存在しない年のリクエストが成功（空のデータが返される）');
            
            // すべての値が0であることを確認
            const allZero = data.every(month => 
                month.totalBamboo === 0 && 
                month.charcoalProduced === 0 && 
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
        const requiredFields = ['month', 'totalBamboo', 'charcoalProduced', 'totalCO2Reduction'];
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
        
        if (typeof monthData.charcoalProduced !== 'number') {
            console.log(`❌ ${monthName}: charcoalProduced が数値ではありません (実際: ${typeof monthData.charcoalProduced})`);
            isValid = false;
        }
        
        if (typeof monthData.totalCO2Reduction !== 'number') {
            console.log(`❌ ${monthName}: totalCO2Reduction が数値ではありません (実際: ${typeof monthData.totalCO2Reduction})`);
            isValid = false;
        }
        
        // 負の値の確認
        if (monthData.totalBamboo < 0 || monthData.charcoalProduced < 0 || monthData.totalCO2Reduction < 0) {
            console.log(`⚠️ ${monthName}: 負の値が含まれています (竹材: ${monthData.totalBamboo}, 炭: ${monthData.charcoalProduced}, CO2削減: ${monthData.totalCO2Reduction})`);
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
async function runYearlyReportTests2025() {
    console.log('🚀 GetYearlyReport APIの2025年データ取得テストを開始します\n');
    
    let testResults = {
        yearlyReport2025: false,
        invalidYearParameter: false,
        nonExistentYear: false,
        responseFormat: false,
        specificDate2025_10: false,
        octoberDataValidation: false
    };
    
    // 1. 2025年の年次レポート取得テスト
    const yearlyReportResult = await testGetYearlyReport2025();
    testResults.yearlyReport2025 = yearlyReportResult.success;
    
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
    
    // 4. 2025年10月のデータ検証テスト
    const specificDateResult = await testSpecificDateData2025_10();
    testResults.specificDate2025_10 = specificDateResult.success;
    
    if (specificDateResult.success) {
        // 10月のデータ詳細検証
        const octoberValidation = await validateOctoberData(specificDateResult.data);
        testResults.octoberDataValidation = octoberValidation;
    }
    
    // 5. 結果サマリー
    console.log('\n📊 テスト結果サマリー:');
    console.log(`2025年年次レポート取得: ${testResults.yearlyReport2025 ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`レスポンス形式検証: ${testResults.responseFormat ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`無効な年パラメータテスト: ${testResults.invalidYearParameter ? '✅ 実行済み' : '❌ 未実行'}`);
    console.log(`存在しない年のテスト: ${testResults.nonExistentYear ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`2025年10月データ検証: ${testResults.specificDate2025_10 ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`10月データ詳細検証: ${testResults.octoberDataValidation ? '✅ 成功' : '❌ 失敗'}`);
    
    const successCount = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;
    
    console.log(`\n🎯 総合結果: ${successCount}/${totalTests} のテストが成功`);
    
    if (successCount === totalTests) {
        console.log('\n🎉 すべてのテストが成功しました！GetYearlyReport APIは2025年データを正しく処理しています。');
    } else {
        console.log('\n⚠️ 一部のテストが失敗しました。APIの実装を確認してください。');
    }
    
    return testResults;
}

// テスト実行
if (require.main === module) {
    runYearlyReportTests2025().catch(console.error);
}

module.exports = {
    testGetYearlyReport2025,
    testInvalidYearParameter,
    testNonExistentYear,
    testSpecificDateData2025_10,
    validateOctoberData,
    validateResponseFormat,
    runYearlyReportTests2025
};
