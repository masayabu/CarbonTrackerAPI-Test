import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

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
                "Access-Control-Allow-Origin": "*"
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
            body: JSON.stringify({ error: "Internal Server Error" }),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        };
    }
}

app.http('ExportData', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: "export-data",
    handler: ExportData
});

export { ExportData };
