import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { authenticateJWT, JWTPayload } from "../../utils/auth";
import { corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const productionSumTableName = "ProductionSumTable";
const groupTableName = "GroupsTable";

interface ProductionSumEntity {
  partitionKey: string;
  rowKey: string;
  year: string;
  groupId: string;
  materialAmount: number;
  charcoalProduced: number;
  charcoalVolume: number;
  co2Reduction: number;
  carbonContent: number;
  ipccLongTerm: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

interface YearlyGroupRankingData {
  groupId: string;
  groupName: string;
  yearlyCharcoal: number;
  yearlyCharcoalVolume: number;
  yearlyCO2Reduction: number;
  yearlyCO2ReductionShortTerm: number;
  yearlyCO2ReductionLongTerm: number;
  introductionPdfUrl?: string | null;
}

async function GetYearlyGroupRankingFromSum(
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
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
        "Access-Control-Max-Age": "86400"
      }
    };
  }

  // JWT認証
  context.log("GetYearlyGroupRankingFromSum: Starting JWT authentication");
  const authResult = authenticateJWT(request, context);
  if (!authResult.success) {
    context.log("GetYearlyGroupRankingFromSum: JWT authentication failed");
    return authResult.response!;
  }
  context.log("GetYearlyGroupRankingFromSum: JWT authentication successful");

  const userPayload = authResult.payload!;
  context.log(`Http function processed request for url "${request.url}" by user: ${userPayload.email}`);

  try {
    // 年パラメータを取得
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    
    if (!yearParam) {
      return {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          error: "Bad Request",
          message: "Year parameter is required"
        })
      };
    }

    const targetYear = parseInt(yearParam);
    if (isNaN(targetYear)) {
      return {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          error: "Bad Request",
          message: "Invalid year parameter"
        })
      };
    }

    // グループ情報を取得
    const groupClient = TableClient.fromConnectionString(connectionString, groupTableName);
    const groupMap = new Map<string, { name: string; introductionPdfUrl?: string | null }>();
    
    for await (const group of groupClient.listEntities()) {
      const groupId = group.rowKey as string;
      const groupName = group.name as string;
      const introductionPdfUrl = group.introductionPdfUrl as string | null | undefined;
      groupMap.set(groupId, { name: groupName, introductionPdfUrl });
    }

    // ProductionSumTableから指定年のデータを取得
    const productionSumClient = TableClient.fromConnectionString(connectionString, productionSumTableName);
    const productionSumEntities = productionSumClient.listEntities<ProductionSumEntity>();

    // グループ別のデータを集計
    const groupDataMap = new Map<string, {
      yearlyCharcoal: number;
      yearlyCharcoalVolume: number;
      yearlyCO2Reduction: number;
      yearlyCO2ReductionShortTerm: number;
      yearlyCO2ReductionLongTerm: number;
    }>();

    for await (const entity of productionSumEntities) {
      const groupId = entity.groupId;
      const year = parseInt(entity.year);
      const charcoalProduced = entity.charcoalProduced || 0;
      const charcoalVolume = entity.charcoalVolume || 0;
      const co2Reduction = entity.co2Reduction || 0;
      const ipccLongTerm = entity.ipccLongTerm || 0;

      // 指定年のデータのみを処理
      if (year === targetYear) {
        if (!groupDataMap.has(groupId)) {
          groupDataMap.set(groupId, {
            yearlyCharcoal: 0,
            yearlyCharcoalVolume: 0,
            yearlyCO2Reduction: 0,
            yearlyCO2ReductionShortTerm: 0,
            yearlyCO2ReductionLongTerm: 0,
          });
        }

        const groupData = groupDataMap.get(groupId)!;
        groupData.yearlyCharcoal += charcoalProduced;
        groupData.yearlyCharcoalVolume += charcoalVolume;
        groupData.yearlyCO2Reduction += co2Reduction;
        groupData.yearlyCO2ReductionShortTerm += co2Reduction;
        groupData.yearlyCO2ReductionLongTerm += ipccLongTerm;
      }
    }

    // 結果を配列に変換
    const result: YearlyGroupRankingData[] = [];
    for (const [groupId, data] of groupDataMap) {
      const groupInfo = groupMap.get(groupId);
      const groupName = groupInfo?.name || "不明なグループ";
      const introductionPdfUrl = groupInfo?.introductionPdfUrl || null;
      
      result.push({
        groupId,
        groupName,
        yearlyCharcoal: data.yearlyCharcoal,
        yearlyCharcoalVolume: data.yearlyCharcoalVolume,
        yearlyCO2Reduction: data.yearlyCO2Reduction,
        yearlyCO2ReductionShortTerm: data.yearlyCO2ReductionShortTerm,
        yearlyCO2ReductionLongTerm: data.yearlyCO2ReductionLongTerm,
        introductionPdfUrl,
      });
    }

    // CO2削減量（短期）でソート（降順）
    result.sort((a, b) => b.yearlyCO2ReductionShortTerm - a.yearlyCO2ReductionShortTerm);

    return {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        year: targetYear,
        data: result
      })
    };

  } catch (error) {
    context.log(`Error retrieving yearly group ranking data: ${error}`);
    
    return {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        error: "Internal Server Error",
        message: "Failed to retrieve yearly group ranking data"
      })
    };
  }
}

app.http("GetYearlyGroupRankingFromSum", {
  methods: ["GET"],
  route: "yearly-group-ranking-from-sum",
  authLevel: "anonymous",
  handler: GetYearlyGroupRankingFromSum
});

export { GetYearlyGroupRankingFromSum };
