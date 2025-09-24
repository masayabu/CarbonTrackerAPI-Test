#!/usr/bin/env node

/**
 * GetYearlyReport APIテストの実行スクリプト
 * 
 * 使用方法:
 * 1. Azure Functionsが起動していることを確認
 * 2. node run_yearly_report_test.js を実行
 */

const { runYearlyReportTests } = require('../api/test_yearly_report_2023');

async function main() {
    console.log('🔧 GetYearlyReport APIテスト実行スクリプト');
    console.log('==========================================\n');
    
    try {
        const results = await runYearlyReportTests();
        
        // 終了コードを設定
        const allPassed = Object.values(results).every(Boolean);
        process.exit(allPassed ? 0 : 1);
    } catch (error) {
        console.error('❌ テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}

main();
