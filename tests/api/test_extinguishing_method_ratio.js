const axios = require('axios');

// テスト用の設定
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:7071/api';
const TEST_YEAR = 2023;

/**
 * 消化方法別生産量割合APIのテスト
 */
async function testExtinguishingMethodRatio() {
    console.log('=== 消化方法別生産量割合APIテスト開始 ===');
    
    try {
        const response = await axios.get(`${BASE_URL}/reports/extinguishing-method-ratio/${TEST_YEAR}`);
        
        console.log('ステータスコード:', response.status);
        console.log('レスポンスデータ:', JSON.stringify(response.data, null, 2));
        
        // レスポンス構造の検証
        const data = response.data;
        
        if (data.year !== TEST_YEAR) {
            throw new Error(`年が正しくありません。期待値: ${TEST_YEAR}, 実際: ${data.year}`);
        }
        
        if (typeof data.totalCharcoalProduced !== 'number') {
            throw new Error('totalCharcoalProducedが数値ではありません');
        }
        
        if (!data.extinguishingMethodTotals || typeof data.extinguishingMethodTotals !== 'object') {
            throw new Error('extinguishingMethodTotalsがオブジェクトではありません');
        }
        
        if (!data.ratios || typeof data.ratios !== 'object') {
            throw new Error('ratiosがオブジェクトではありません');
        }
        
        if (!data.summary || typeof data.summary !== 'object') {
            throw new Error('summaryがオブジェクトではありません');
        }
        
        // 消化方法の検証
        const expectedMethods = ['water', 'oxygen'];
        for (const method of expectedMethods) {
            if (!(method in data.extinguishingMethodTotals)) {
                throw new Error(`${method}がextinguishingMethodTotalsに含まれていません`);
            }
            if (!(method in data.ratios)) {
                throw new Error(`${method}がratiosに含まれていません`);
            }
            if (!(method in data.summary)) {
                throw new Error(`${method}がsummaryに含まれていません`);
            }
        }
        
        // 割合の合計が100%に近いかチェック（丸め誤差を考慮）
        const totalPercentage = data.ratios.water + data.ratios.oxygen;
        if (Math.abs(totalPercentage - 100) > 0.01) {
            console.warn(`警告: 割合の合計が100%ではありません。実際: ${totalPercentage}%`);
        }
        
        console.log('✅ 消化方法別生産量割合APIテスト成功');
        console.log(`📊 ${TEST_YEAR}年の結果:`);
        console.log(`   総生産量: ${data.totalCharcoalProduced}`);
        console.log(`   水消火法: ${data.summary.water.amount} (${data.summary.water.percentage}%)`);
        console.log(`   酸素消火法: ${data.summary.oxygen.amount} (${data.summary.oxygen.percentage}%)`);
        
    } catch (error) {
        console.error('❌ 消化方法別生産量割合APIテスト失敗:', error.message);
        if (error.response) {
            console.error('レスポンスステータス:', error.response.status);
            console.error('レスポンスデータ:', error.response.data);
        }
        throw error;
    }
}

/**
 * 無効な年パラメータのテスト
 */
async function testInvalidYear() {
    console.log('\n=== 無効な年パラメータテスト ===');
    
    try {
        await axios.get(`${BASE_URL}/reports/extinguishing-method-ratio/invalid`);
        throw new Error('無効な年パラメータでエラーが発生しませんでした');
    } catch (error) {
        if (error.response && error.response.status === 400) {
            console.log('✅ 無効な年パラメータテスト成功 (400エラー)');
        } else {
            throw error;
        }
    }
}

/**
 * メイン実行関数
 */
async function main() {
    try {
        await testExtinguishingMethodRatio();
        await testInvalidYear();
        console.log('\n🎉 すべてのテストが成功しました！');
    } catch (error) {
        console.error('\n💥 テストが失敗しました:', error.message);
        process.exit(1);
    }
}

// スクリプトが直接実行された場合のみテストを実行
if (require.main === module) {
    main();
}

module.exports = {
    testExtinguishingMethodRatio,
    testInvalidYear
};
