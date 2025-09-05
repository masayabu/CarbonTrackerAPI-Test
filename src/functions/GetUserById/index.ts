import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "UsersTable";
const partitionKey = "User";

async function GetUserById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const rowKey = request.params.id;

  if (!rowKey) {
    return {
      status: 400,
      body: JSON.stringify({ error: "Missing user ID in URL." }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    };
  }

  const client = TableClient.fromConnectionString(connectionString, tableName);

  try {
    const user = await client.getEntity(partitionKey, rowKey);
    return {
      status: 200,
      body: JSON.stringify(user),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    };
  } catch (error: any) {
    context.error(`Get failed: ${error.message}`);
    return {
      status: 404,
      body: JSON.stringify({ error: "User not found." }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    };
  }
}

app.http("GetUserById", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "users/{id}",
  handler: GetUserById,
});

export { GetUserById };
