import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { authenticateJWT, JWTPayload } from "../../utils/auth";
import { corsOrigins } from "../../config";

// Azure Table Storage 接続設定
const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "ProductionTable";

async function GetProductions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    context.log(`Http function processed request for url "${request.url}" by user: ${userPayload.email}`);

    // クエリパラメータからgroupIdを取得
    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId');
    
    if (!groupId) {
        return {
            status: 400,
            body: JSON.stringify({ error: "groupId parameter is required" }),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true"
            }
        };
    }

    try {
        const client = TableClient.fromConnectionString(connectionString, tableName);

        // グループIDでフィルタリング
        const entities = client.listEntities({
            queryOptions: { filter: `groupId eq '${groupId}'` }
        });

        const productionEntities = [];
        for await (const entity of entities) {
          productionEntities.push(entity);
        }

        return {
            status: 200,
            body: JSON.stringify(productionEntities),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true"
            }
        };
    } catch (error) {
        if (error instanceof Error) {
            context.log(`Error: ${error.message}`);
            context.log(`Stack Trace: ${error.stack}`);
        } else {
            context.log(`Unknown error: ${JSON.stringify(error)}`);
        }
    };
    return {
        status: 500,
        body: "Internal Server Error",
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": corsOrigin,
            "Access-Control-Allow-Credentials": "true"
        }
    };
}

app.http('GetProductions', {
    methods: ['GET'],
    authLevel: 'function',
    route: "productions",
    handler: GetProductions
});

export { GetProductions };
