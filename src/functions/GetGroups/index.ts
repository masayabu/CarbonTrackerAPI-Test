import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { authenticateJWT, JWTPayload } from "../../utils/auth";
import { corsOrigins } from "../../config";

// Azure Table Storage 接続設定
const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "GroupsTable";
const partitionKey = "Groups"; // 固定値でもユーザー別でもOK

async function GetGroups(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // CORS設定
  const allowedOrigins = corsOrigins.split(",").map((origin: string) => origin.trim());
  const origin = request.headers.get("Origin") || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    };
  }

  // JWT認証
  const authResult = authenticateJWT(request, context);
  if (!authResult.success) {
    return authResult.response!;
  }
  // 認証成功
  context.log("GetGroups: JWT認証に成功しました");

  interface Group {
    PartitionKey: string; // 例: "Groups"
    RowKey: string; // グループの一意な ID（UUID）
    name: string; // グループ名
    description: string; // 説明
    timestamp: string; // 作成/更新日時
  }
  try {
    const client = TableClient.fromConnectionString(
      connectionString,
      tableName
    );

    const entities = [];
    for await (const entity of client.listEntities()) {
      entities.push(entity);
    }

    return {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entities),
    };
  } catch (error) {
    if (error instanceof Error) {
      context.log(`Error: ${error.message}`);
      context.log(`Stack Trace: ${error.stack}`); // スタックトレースを追加
    } else {
      context.log(`Unknown error: ${JSON.stringify(error)}`);
    }
  }
  return {
    status: 500,
    headers: {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Content-Type": "application/json",
    },
    body: "Internal Server Error",
  };
}

app.http("GetGroups", {
  methods: ["GET"],
  authLevel: "function",
  route: "groups",
  handler: GetGroups,
});

export { GetGroups };
