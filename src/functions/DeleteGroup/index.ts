import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "GroupsTable";
const partitionKey = "Groups"; // 固定値でもユーザー別でもOK

async function DeleteGroup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const { id } = request.params;
    context.log(`Deleting group with ID: ${id}`);

    if (!id) {
        return { 
            status: 400, 
            body: "Missing ID",
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        };
    }
    
    const client = TableClient.fromConnectionString(connectionString, tableName);
    
    try {
        await client.deleteEntity(partitionKey, id);
        return { 
            status: 204, // No Content
            headers: {
                "Access-Control-Allow-Origin": "*"
            }
        };
    } catch (error) {
        context.log(`Error deleting entity: ${JSON.stringify(error)}`);
        return {
            status: 404,
            body: "Group not found or already deleted",
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        };
    }
}

app.http("DeleteGroup", {
    methods: ["DELETE"],
    route: "group/{id}",
    authLevel: "anonymous",
    handler: DeleteGroup,
});

export { DeleteGroup };
