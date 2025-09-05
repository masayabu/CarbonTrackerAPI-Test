import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

const connectionString = process.env.AzureWebJobsStorage!;
const userGroupTable = "UserGroupTable";
const groupsTable = "GroupsTable";

async function GetUserGroups(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = request.params.userId;
  context.log(`Fetching groups for user: ${userId}`);

  if (!userId) {
    return {
      status: 400,
      body: "userId is required",
      headers: corsHeaders(),
    };
  }

  const userGroupClient = TableClient.fromConnectionString(connectionString, userGroupTable);
  const groupsClient = TableClient.fromConnectionString(connectionString, groupsTable);

  try {
    // ① ユーザーが所属する groupId を取得
    const groupRelations = userGroupClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${userId}'` }
    });

    const groupList: any[] = [];

    for await (const relation of groupRelations) {
      const groupId = relation.rowKey;
      if (!groupId) {
        context.log("Skipping entity with undefined rowKey");
        continue;
      }

      context.log(`Fetching group with ID: ${groupId}`);
      // ② groupId を使って GroupsTable からグループ情報を取得
      try {
        const groupEntity = await groupsClient.getEntity("Groups", groupId); // 固定パーティションキーを使う場合
        groupList.push({
          groupId: groupEntity.rowKey,
          name: groupEntity.name,
          description: groupEntity.description ?? "",
          createdAt: groupEntity.createdAt ?? null,
        });
      } catch (err: any) {
        context.log(`Group ${groupId} not found in GroupsTable`);
      }
    }

    return {
      status: 200,
      body: JSON.stringify(groupList),
      headers: corsHeaders(),
    };
  } catch (error: any) {
    context.log(`Error fetching user groups: ${error.message}`);
    return {
      status: 500,
      body: JSON.stringify({ message: "Failed to fetch user groups", error: error.message }),
      headers: corsHeaders(),
    };
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
}

app.http("GetUserGroups", {
  route: "users/{userId}/groups",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: GetUserGroups
});

export { GetUserGroups };
