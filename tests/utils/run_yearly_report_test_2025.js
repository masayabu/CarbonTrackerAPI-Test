#!/usr/bin/env node

/**
 * GetYearlyReport APIテストの実行スクリプト（2025年版）
 * 
 * 使用方法:
 * 1. Azure Functionsが起動していることを確認
 * 2. node run_yearly_report_test_2025.js を実行
 */

const { runYearlyReportTests2025 } = require('../api/test_yearly_report_2025');

async function main() {
    console.log('🔧 GetYearlyReport APIテスト実行スクリプト（2025年版）');
    console.log('================================================\n');
    
    try {
        const results = await runYearlyReportTests2025();
        
        // 終了コードを設定
        const allPassed = Object.values(results).every(Boolean);
        process.exit(allPassed ? 0 : 1);
    } catch (error) {
        console.error('❌ テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}

main();
