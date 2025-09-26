import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { authenticateJWT, JWTPayload } from "../../utils/auth";
import { corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "ProductionSumTable";

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
  [key: string]: any; // その他のプロパティ
}

async function GetProductionSum(
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

  // クエリパラメータからgroupIdを取得
  const url = new URL(request.url);
  const groupId = url.searchParams.get('groupId');
  
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

  try {
    // グループIDでフィルタリング
    const entities = client.listEntities<ProductionSumEntity>({
      queryOptions: { filter: `groupId eq '${groupId}'` }
    });
      
    let productionSums: ProductionSumEntity[] = [];

    for await (const entity of entities) {
      productionSums.push(entity);
    }

    // 年、materialType（rowKeyから抽出）でソート
    productionSums.sort((a, b) => {
      // 年でソート（降順）
      const yearCompare = parseInt(b.year) - parseInt(a.year);
      if (yearCompare !== 0) return yearCompare;
      
      // 同じ年の場合はrowKeyでソート（materialType順）
      return a.rowKey.localeCompare(b.rowKey);
    });

    // レスポンス用のデータを整形
    const response = {
      groupId: groupId,
      totalRecords: productionSums.length,
      data: productionSums.map(entity => ({
        id: entity.rowKey,
        year: entity.year,
        groupId: entity.groupId,
        materialType: entity.rowKey.split('-')[2], // rowKeyからmaterialTypeを抽出
        materialAmount: entity.materialAmount,
        charcoalProduced: entity.charcoalProduced,
        charcoalVolume: entity.charcoalVolume,
        co2Reduction: entity.co2Reduction,
        carbonContent: entity.carbonContent,
        ipccLongTerm: entity.ipccLongTerm,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
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

  } catch (error) {
    context.log(`Error retrieving production sum data: ${error}`);
    
    return {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        error: "Internal Server Error",
        message: "Failed to retrieve production sum data"
      })
    };
  }
}

app.http("GetProductionSum", {
  methods: ["GET"],
  route: "production-sum",
  authLevel: "anonymous",
  handler: GetProductionSum
});

export { GetProductionSum };
