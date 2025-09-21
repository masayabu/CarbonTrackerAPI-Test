import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { authenticateJWT, JWTPayload, isAdminOrOperator } from "../../utils/auth";
import { corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "GroupsTable";
const partitionKey = "Groups"; // 固定値でもユーザー別でもOK

async function DeleteGroup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

    const { id } = request.params;
    context.log(`Deleting group with ID: ${id} by user: ${userPayload.email}`);

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
