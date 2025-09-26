import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { authenticateJWT, JWTPayload } from "../../utils/auth";
import { corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "GroupsTable";
const partitionKey = "Groups";

async function GetGroup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const allowedOrigins = corsOrigins.split(",").map((origin: string) => origin.trim());
    const origin = request.headers.get("Origin") || "";
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    // OPTIONS リクエストの処理
    if (request.method === "OPTIONS") {
        return {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Max-Age": "86400"
            }
        };
    }

    // JWT認証
    const authResult = authenticateJWT(request, context);
    if (!authResult.success) {
        return authResult.response!;
    }

    const userPayload = authResult.payload!;
    context.log(`Http function processed request for url "${request.url}" by user: ${userPayload.email}`);

    try {
        const client = TableClient.fromConnectionString(connectionString, tableName);

        const groupId = request.params.groupId;
        if (!groupId) {
            return {
                status: 400,
                headers: {
                    "Access-Control-Allow-Origin": corsOrigin,
                    "Access-Control-Allow-Credentials": "true",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ error: "Group ID is required" })
            };
        }

        // グループ情報を取得
        const groupEntity = await client.getEntity<{
            name: string;
            description?: string;
        }>(partitionKey, groupId);

        if (!groupEntity) {
            return {
                status: 404,
                headers: {
                    "Access-Control-Allow-Origin": corsOrigin,
                    "Access-Control-Allow-Credentials": "true",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ error: "Group not found" })
            };
        }

        return {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                rowKey: groupId,
                name: groupEntity.name,
                description: groupEntity.description
            })
        };
    } catch (error) {
        context.error("Error fetching group:", error);
        return {
            status: 500,
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: "Internal server error" })
        };
    }
}

app.http("GetGroup", {
    route: "groups/{groupId}",
    methods: ["GET", "OPTIONS"],
    authLevel: "anonymous",
    handler: GetGroup
});

export { GetGroup };
