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

interface GroupRankingData {
  groupId: string;
  groupName: string;
  thisMonthCharcoal: number;
  thisMonthCO2Reduction: number;
  thisYearCO2Reduction: number;
  totalCO2ReductionShortTerm: number;
  totalCO2ReductionLongTerm: number;
  introductionPdfUrl?: string | null;
}

async function GetGroupRankingFromSum(
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
  context.log("GetGroupRankingFromSum: Starting JWT authentication");
  const authResult = authenticateJWT(request, context);
  if (!authResult.success) {
    context.log("GetGroupRankingFromSum: JWT authentication failed");
    return authResult.response!;
  }
  context.log("GetGroupRankingFromSum: JWT authentication successful");

  const userPayload = authResult.payload!;
  context.log(`Http function processed request for url "${request.url}" by user: ${userPayload.email}`);

  try {
    // 現在の年月を取得
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // グループ情報を取得
    const groupClient = TableClient.fromConnectionString(connectionString, groupTableName);
    const groupMap = new Map<string, { name: string; introductionPdfUrl?: string | null }>();
    
    for await (const group of groupClient.listEntities()) {
      const groupId = group.rowKey as string;
      const groupName = group.name as string;
      const introductionPdfUrl = group.introductionPdfUrl as string | null | undefined;
      groupMap.set(groupId, { name: groupName, introductionPdfUrl });
    }

    // ProductionSumTableからデータを取得
    const productionSumClient = TableClient.fromConnectionString(connectionString, productionSumTableName);
    const productionSumEntities = productionSumClient.listEntities<ProductionSumEntity>();

    // グループ別のデータを集計
    const groupDataMap = new Map<string, {
      thisMonthCharcoal: number;
      thisMonthCO2Reduction: number;
      thisYearCO2Reduction: number;
      totalCO2ReductionShortTerm: number;
      totalCO2ReductionLongTerm: number;
    }>();

    for await (const entity of productionSumEntities) {
      const groupId = entity.groupId;
      const year = parseInt(entity.year);
      const charcoalProduced = entity.charcoalProduced || 0;
      const co2Reduction = entity.co2Reduction || 0;
      const ipccLongTerm = entity.ipccLongTerm || 0;

      if (!groupDataMap.has(groupId)) {
        groupDataMap.set(groupId, {
          thisMonthCharcoal: 0,
          thisMonthCO2Reduction: 0,
          thisYearCO2Reduction: 0,
          totalCO2ReductionShortTerm: 0,
          totalCO2ReductionLongTerm: 0,
        });
      }

      const groupData = groupDataMap.get(groupId)!;

      // 累積データ
      groupData.totalCO2ReductionShortTerm += co2Reduction;
      groupData.totalCO2ReductionLongTerm += ipccLongTerm;

      // 今年のデータ
      if (year === currentYear) {
        groupData.thisYearCO2Reduction += co2Reduction;
      }

      // 今月のデータ（ProductionSumTableには月別データがないため、今年のデータを今月として扱う）
      if (year === currentYear) {
        groupData.thisMonthCharcoal += charcoalProduced;
        groupData.thisMonthCO2Reduction += co2Reduction;
      }
    }

    // 結果を配列に変換
    const result: GroupRankingData[] = [];
    for (const [groupId, data] of groupDataMap) {
      const groupInfo = groupMap.get(groupId);
      const groupName = groupInfo?.name || "不明なグループ";
      const introductionPdfUrl = groupInfo?.introductionPdfUrl || null;
      
      result.push({
        groupId,
        groupName,
        thisMonthCharcoal: data.thisMonthCharcoal,
        thisMonthCO2Reduction: data.thisMonthCO2Reduction,
        thisYearCO2Reduction: data.thisYearCO2Reduction,
        totalCO2ReductionShortTerm: data.totalCO2ReductionShortTerm,
        totalCO2ReductionLongTerm: data.totalCO2ReductionLongTerm,
        introductionPdfUrl,
      });
    }

    // 累積炭素固定量でソート（降順）
    result.sort((a, b) => b.totalCO2ReductionShortTerm - a.totalCO2ReductionShortTerm);

    return {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(result)
    };

  } catch (error) {
    context.log(`Error retrieving group ranking data: ${error}`);
    
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
        message: "Failed to retrieve group ranking data"
      })
    };
  }
}

app.http("GetGroupRankingFromSum", {
  methods: ["GET"],
  route: "group-ranking-from-sum",
  authLevel: "anonymous",
  handler: GetGroupRankingFromSum
});

export { GetGroupRankingFromSum };