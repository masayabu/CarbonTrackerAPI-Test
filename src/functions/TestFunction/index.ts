import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

// 環境変数に設定された接続文字列とテーブル名
const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "UserGroupTable";

async function AddUserGroup(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = request.params.userId;
  const groupId = request.params.groupId;

  context.log(`Adding user ${userId} to group ${groupId}`);

  if (!userId || !groupId) {
    return {
      status: 400,
      body: "userId and groupId are required in the route parameters",
      headers: corsHeaders(),
    };
  }

  const client = TableClient.fromConnectionString(connectionString, tableName);

  const entity = {
    partitionKey: userId,
    rowKey: groupId,
    joinedAt: new Date().toISOString(),
    role: "member"
  };

  try {
    await client.createEntity(entity);

    return {
      status: 201,
      body: JSON.stringify({ message: "User added to group successfully", entity }),
      headers: corsHeaders(),
    };
  } catch (error: any) {
    context.log(`Error adding user to group: ${error.message}`);
    return {
      status: error.statusCode || 500,
      body: JSON.stringify({ message: "Failed to add user to group", error: error.message }),
      headers: corsHeaders(),
    };
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "http://localhost:5000",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json"
  };
}

app.http("AddUserGroup", {
  route: "groups/{groupId}/users/{userId}",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: AddUserGroup
});

export { AddUserGroup };
