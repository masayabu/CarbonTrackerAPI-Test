import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { authenticateJWT, JWTPayload, isAdminOrOperator } from "../../utils/auth";
import { corsOrigins } from "../../config";

// Azure Table Storage 接続設定
const connectionString = process.env.AzureWebJobsStorage!;
const productionTableName = "ProductionTable";
const userTableName = "UsersTable";
const groupTableName = "GroupsTable";

interface ExportData {
    productions: any[];
    users: any[];
    groups: any[];
    exportDate: string;
    version: string;
}

async function ExportData(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // CORS設定
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

    // 権限チェック: 管理者権限が必要
    if (!isAdminOrOperator(userPayload)) {
        return {
            status: 403,
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: "Forbidden: Admin role required" })
        };
    }

    // 管理者用のため、groupIdは不要
    const url = new URL(request.url);

    try {
        const exportData: ExportData = {
            productions: [],
            users: [],
            groups: [],
            exportDate: new Date().toISOString(),
            version: "1.0.0"
        };

        // 生産データをエクスポート（すべて）
        const productionClient = TableClient.fromConnectionString(connectionString, productionTableName);
        const productionEntities = productionClient.listEntities();

        for await (const entity of productionEntities) {
            exportData.productions.push(entity);
        }

        // ユーザーデータをエクスポート（すべて）
        const userClient = TableClient.fromConnectionString(connectionString, userTableName);
        const userEntities = userClient.listEntities();

        for await (const entity of userEntities) {
            exportData.users.push(entity);
        }

        // グループデータをエクスポート（すべて）
        const groupClient = TableClient.fromConnectionString(connectionString, groupTableName);
        const groupEntities = groupClient.listEntities();

        for await (const entity of groupEntities) {
            exportData.groups.push(entity);
        }

        return {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="carbon-tracker-backup-all-${new Date().toISOString().split('T')[0]}.json"`,
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true"
            },
            body: JSON.stringify(exportData, null, 2)
        };
    } catch (error) {
        if (error instanceof Error) {
            context.log(`Error: ${error.message}`);
            context.log(`Stack Trace: ${error.stack}`);
        } else {
            context.log(`Unknown error: ${JSON.stringify(error)}`);
        }
        
        return {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true"
            },
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
}

app.http('ExportData', {
    methods: ['GET'],
    authLevel: 'function',
    route: "export-data",
    handler: ExportData
});

export { ExportData };
