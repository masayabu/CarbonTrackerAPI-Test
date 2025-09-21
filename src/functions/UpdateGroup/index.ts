import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { authenticateJWT, JWTPayload, isAdminOrOperator } from "../../utils/auth";
import { corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "GroupsTable";
const partitionKey = "Groups"; // 固定値でもユーザー別でもOK

async function UpdateGroup(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // CORS設定
  const allowedOrigins = corsOrigins.split(",").map((origin: string) => origin.trim());
  const origin = request.headers.get("Origin") || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  // JWT認証
  const authResult = authenticateJWT(request, context);
  if (!authResult.success) {
    return authResult.response!;
  }

  const userPayload = authResult.payload!;
  
  // 権限チェック: 管理者またはオペレーター権限が必要
  if (!isAdminOrOperator(userPayload)) {
    return {
      status: 403,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Forbidden: Admin or operator role required" })
    };
  }

  context.log(`Http function processed request for url "${request.url}" by user: ${userPayload.email}`);

  const { id } = request.params;
  let body;
  try {
    body = await request.json();
  } catch (error) {
    context.log("Error parsing request body:", error);
    return {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: "Invalid request body",
    };
  }
  context.log("Request ID:", id);
  context.log("Request body:", JSON.stringify(body));
  
  // IDが指定されていない場合のバリデーション
  // リクエストボディのバリデーション
  if (!id || !body) {
    return {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: "Missing id or request body",
    };
  }
  const client = TableClient.fromConnectionString(connectionString, tableName);

  try {
    // 既存データ取得
    const existing = await client.getEntity(partitionKey, id);
    context.log("Existing entity:", JSON.stringify(existing));
    // 取得したエンティティのプロパティを確認

    // 更新内容の反映
    const updated = {
      partitionKey: existing.partitionKey!,
      rowKey: existing.rowKey!,
      ...existing,
      // ここでリクエストボディの内容を上書き
      ...body,
      updatedAt: new Date().toISOString(),
    };
    // 更新処理
    await client.updateEntity(updated, "Merge");
    // 更新後のエンティティを取得
    const updatedEntity = await client.getEntity(partitionKey, id);
    // 取得したエンティティを返す
    context.log(`Updated entity: ${JSON.stringify(updatedEntity)}`);
    return {
      status: 200,
      body: JSON.stringify(updated),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // CORS設定
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      context.log(`Error: ${error.message}`);
      context.log(`Stack Trace: ${error.stack}`); // スタックトレースを追加
    } else {
      context.log(`Unknown error: ${JSON.stringify(error)}`);
    }
    return {
      status: 500,
      body: "Internal Server Error",
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    };
  }
}

app.http("UpdateGroup", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "groups/{id}",
  handler: UpdateGroup,
});

export { UpdateGroup };
