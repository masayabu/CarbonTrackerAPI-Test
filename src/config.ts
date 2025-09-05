// src/config.ts
import * as fs from "fs";
import * as path from "path";

// 環境変数から環境を取得（デフォルトはdevelopment）
const environment = process.env.NODE_ENV || "development";

// 環境別の設定ファイルを読み込み（distディレクトリ内のconfigファイルを参照）
const configPath = path.join(process.cwd(), "dist", `config.${environment}.json`);
let config: any = {};

try {
  const configFile = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configFile);
} catch (error) {
  console.warn(`Config file not found for environment: ${environment}, using default config`);
  // デフォルト設定
  config = {
    environment: "development",
    corsOrigins: "http://localhost:5000,http://localhost:3000",
    jwtSecret: "default-jwt-secret",
    tableName: "ProductionTable",
    partitionKey: "Production"
  };
}

export const connectionString = process.env.AzureWebJobsStorage!;
export const tableName = config.tableName;
export const partitionKey = config.partitionKey;
export const corsOrigins = config.corsOrigins;
export const jwtSecret = config.jwtSecret;
export const currentEnvironment = config.environment;
