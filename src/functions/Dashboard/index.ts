import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { authenticateJWT, JWTPayload } from "../../utils/auth";
import { corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "ProductionTable";

// CO2固定量を計算する関数
function calculateCO2Reduction(charcoalWeight: number): number {
  const carbonContent = charcoalWeight * 0.8;
  return carbonContent * 3.67;
}

// 効率率を計算する関数
function calculateEfficiency(bamboo: number, charcoal: number): number {
  if (bamboo <= 0) return 0;
  return (charcoal / bamboo) * 100;
}

// 月別CO2固定量を計算する関数
function calculateMonthlyCO2Reduction(productions: any[], targetYear?: number): { month: number; totalCO2Reduction: number }[] {
  const currentYear = new Date().getFullYear();
  const year = targetYear || currentYear;

  // 月別の集計用オブジェクト
  const monthlyData: { [key: number]: number } = {};
  
  // 12ヶ月分初期化
  for (let i = 1; i <= 12; i++) {
    monthlyData[i] = 0;
  }

  // 各生産記録を月別に集計
  productions.forEach(production => {
    const productionDate = new Date(production.date);
    const month = productionDate.getMonth() + 1; // 0ベースから1ベースに変換
    const productionYear = productionDate.getFullYear();
    
    // 指定された年のデータのみを対象とする
    if (productionYear === year) {
      const charcoalWeight = Number(production.charcoalProduced) || 0;
      const co2Reduction = calculateCO2Reduction(charcoalWeight);
      monthlyData[month] += co2Reduction;
    }
  });

  // 配列形式に変換
  return Object.entries(monthlyData).map(([month, totalCO2Reduction]) => ({
    month: parseInt(month),
    totalCO2Reduction
  }));
}

// 今月のCO2固定量を計算する関数
function calculateCurrentMonthCO2Reduction(productions: any[]): number {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  return productions
    .filter(production => {
      const productionDate = new Date(production.date);
      return productionDate.getMonth() === currentMonth && 
             productionDate.getFullYear() === currentYear;
    })
    .reduce((sum, production) => {
      const charcoalWeight = Number(production.charcoalProduced) || 0;
      const co2Reduction = calculateCO2Reduction(charcoalWeight);
      return sum + co2Reduction;
    }, 0);
}

// 総CO2固定量を計算する関数
function calculateTotalCO2Reduction(productions: any[], targetYear?: number): number {
  const currentYear = new Date().getFullYear();
  const year = targetYear || currentYear;
  
  return productions
    .filter(production => {
      const productionDate = new Date(production.date);
      const productionYear = productionDate.getFullYear();
      return productionYear === year;
    })
    .reduce((sum, production) => {
      const charcoalWeight = Number(production.charcoalProduced) || 0;
      const co2Reduction = calculateCO2Reduction(charcoalWeight);
      return sum + co2Reduction;
    }, 0);
}

// 年別の月別CO2固定量を計算する関数
function calculateYearlyCO2Reduction(productions: any[], targetYear: number): { month: number; totalCO2Reduction: number }[] {
  // 月別の集計用オブジェクト
  const monthlyData: { [key: number]: number } = {};
  
  // 12ヶ月分初期化
  for (let i = 1; i <= 12; i++) {
    monthlyData[i] = 0;
  }

  // 各生産記録を月別に集計
  productions.forEach(production => {
    const productionDate = new Date(production.date);
    const month = productionDate.getMonth() + 1; // 0ベースから1ベースに変換
    const productionYear = productionDate.getFullYear();
    
    // 指定された年のデータのみを対象とする
    if (productionYear === targetYear) {
      const charcoalWeight = Number(production.charcoalProduced) || 0;
      const co2Reduction = calculateCO2Reduction(charcoalWeight);
      monthlyData[month] += co2Reduction;
    }
  });

  // 配列形式に変換
  return Object.entries(monthlyData).map(([month, totalCO2Reduction]) => ({
    month: parseInt(month),
    totalCO2Reduction
  }));
}

async function Dashboard(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  // CORS設定
  const allowedOrigins = corsOrigins.split(",").map((origin: string) => origin.trim());
  const origin = request.headers.get("Origin") || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  // OPTIONS リクエストの処理
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      }
    };
  }

  // JWT認証
  const authResult = authenticateJWT(request, context);
  if (!authResult.success) {
    return authResult.response!;
  }

  const userPayload = authResult.payload!;
  context.log(`Http function processed request for url "${request.url}" by user: ${userPayload.email}`);

  const client = TableClient.fromConnectionString(connectionString, tableName);

  // クエリパラメータからgroupIdとyearを取得
  const url = new URL(request.url);
  const groupId = url.searchParams.get('groupId');
  const yearParam = url.searchParams.get('year');
  
  if (!groupId) {
    return {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "groupId parameter is required" })
    };
  }

  // 年パラメータが指定されている場合は年別データを返す
  const targetYear = yearParam ? parseInt(yearParam) : undefined;

  interface ProductionEntity {
    partitionKey: string;
    rowKey: string;
    materialAmount: number;
    charcoalProduced: number;
    date: string;
    createdAt: string;
    groupId?: string;
    [key: string]: any; // その他のプロパティ
  }

  // グループIDでフィルタリング
  const entities = client.listEntities<ProductionEntity>({
    queryOptions: { filter: `groupId eq '${groupId}'` }
  });
    
  let productions: any[] = [];
  let monthlyTotals: { [key: string]: { bamboo: number, charcoal: number, co2: number } } = {};
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  for await (const entity of entities) {
    const date = new Date(entity.date as string);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // 月別データ
    if (!monthlyTotals[month]) {
      monthlyTotals[month] = { bamboo: 0, charcoal: 0, co2: 0 };
    }
    monthlyTotals[month].bamboo += Number(entity.materialAmount || 0);
    monthlyTotals[month].charcoal += Number(entity.charcoalProduced || 0);
    monthlyTotals[month].co2 += Number(entity.charcoalProduced || 0) * 0.8 * 3.67;

    // 生産データを配列に追加
    productions.push(entity);
  }

  // 日付順にソート
  productions.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // 計算ロジックを実行
  const totalCO2Reduction = calculateTotalCO2Reduction(productions, targetYear);
  const currentMonthCO2Reduction = calculateCurrentMonthCO2Reduction(productions);
  
  // 年別データが要求されている場合は年別データを返す
  const yearlyData = targetYear !== undefined
    ? calculateYearlyCO2Reduction(productions, targetYear)
    : calculateMonthlyCO2Reduction(productions);
  
  const current = monthlyTotals[currentMonth] || { bamboo: 0, charcoal: 0 };
  const efficiencyRate = calculateEfficiency(current.bamboo, current.charcoal);

  const response = {
    groupId: groupId,
    totalCO2Reduction: totalCO2Reduction,
    currentMonth: {
      bamboo: current.bamboo,
      charcoal: current.charcoal,
      co2Reduction: currentMonthCO2Reduction
    },
    changes: {
      co2: currentMonthCO2Reduction,
      bamboo: current.bamboo,
      charcoal: current.charcoal
    },
    yearlyData,
    efficiencyRate,
    recentProductions: productions.slice(0, 5).map(production => ({
      id: production.rowKey,
      date: production.date,
      materialAmount: production.materialAmount,
      charcoalProduced: production.charcoalProduced,
      co2Reduction: calculateCO2Reduction(production.charcoalProduced)
    }))
  };

  return {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(response)
  };
}

app.http("Dashboard", {
  methods: ["GET"],
  route: "dashboard",
  authLevel: "anonymous",
  handler: Dashboard
});

export { Dashboard };
