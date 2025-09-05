import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

const connectionString = process.env.AzureWebJobsStorage!;
const userGroupTable = "UserGroupTable";

async function removeUserFromGroup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const groupId = request.params.groupId;
  const userId = request.params.userId;

  if (!groupId || !userId) {
    return {
      status: 400,
      body: "Missing groupId or userId in route parameters",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
      },
    };
  }

  const client = TableClient.fromConnectionString(connectionString, userGroupTable);

  context.log(`1.Removing user ${userId} from group ${groupId}`);
  try {
    // 削除対象のエンティティを取得
    const entity = await client.getEntity(userId,groupId);
    if (!entity) {
      return {
        status: 404,
        body: "User not found in group",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
        },
      };
    }
    context.log(`2.Removing user ${userId} from group ${groupId}`);

    // 削除
    await client.deleteEntity(userId, groupId);
    context.log(`User ${userId} removed from group ${groupId}`);
    // 成功レスポンス
    return {
      status: 204, // No Content
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
      },
    };
  } catch (error: any) {
    context.log(`Error removing user from group: ${error.message}`);
    return {
      status: 404,
      body: "User not found in group",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
      },
    };
  }
}

app.http("RemoveUserFromGroup", {
  route: "groups/{groupId}/users/{userId}",
  methods: ["DELETE"],
  authLevel: "anonymous",
  handler: removeUserFromGroup,
});

export { removeUserFromGroup as RemoveUserFromGroup };
