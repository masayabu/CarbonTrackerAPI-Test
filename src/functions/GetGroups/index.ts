import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { TableClient } from "@azure/data-tables";

// Azure Table Storage 接続設定
const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "GroupsTable";
const partitionKey = "Groups"; // 固定値でもユーザー別でもOK

async function GetGroups(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }
  context.log(`Http function processed request for url "${request.url}"`);

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
        "Access-Control-Allow-Origin": "*",
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
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "Content-Type": "application/json",
    },
    body: "Internal Server Error",
  };
}

app.http("GetGroups", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "groups",
  handler: GetGroups,
});

export { GetGroups };
