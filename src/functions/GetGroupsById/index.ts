import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { TableClient, RestError } from "@azure/data-tables";

// Azure Table Storage 接続設定
const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "GroupsTable";
const partitionKey = "Groups"; // 固定値でもユーザー別でもOK

async function GetGroupsById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);
  const req = request as HttpRequest & {
    params: { id: string };
  };
  const { id } = req.params;
  if (!id) {
    context.log("No ID provided in the request.");
    return {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "ID is required" }),
    };
  }

  try {
    const tableClient = TableClient.fromConnectionString(
      connectionString,
      tableName
    );

    const entity = await tableClient.getEntity("Groups", id);
    return {
      status: 200,
      body: JSON.stringify(entity),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    };
  } catch (error) {
    if (error instanceof RestError) {
      // エンティティが見つからない場合（404）
      if (error.statusCode === 404) {
        context.log(`Entity with ID ${id} not found.`);
        return {
          status: 404,
          body: JSON.stringify({ error: `Group with ID ${id} not found` }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        };
      }
    }

    // その他のエラー
    context.log(
      `Error processing request: ${
        error instanceof Error ? error.message : JSON.stringify(error)
      }`
    );
    if (error instanceof Error && error.stack) {
      context.log(`Stack Trace: ${error.stack}`);
    }

    return {
      status: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    };
  }
}

app.http("GetGroupsById", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "groups/{id}",
  handler: GetGroupsById,
});

export { GetGroupsById };
