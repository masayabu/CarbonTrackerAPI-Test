import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { authenticateJWT, JWTPayload, isAdminOrOperator } from "../../utils/auth";
import { corsOrigins } from "../../config";

// Azure Table Storage 接続設定
const connectionString = process.env.AzureWebJobsStorage!;
const productionTableName = "ProductionTable";
const userTableName = "UsersTable";
const groupTableName = "GroupsTable";

interface ImportData {
    productions: any[];
    users: any[];
    groups: any[];
    exportDate: string;
    version: string;
}

async function ImportData(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    if (request.method !== 'POST') {
        return {
            status: 405,
            body: JSON.stringify({ error: "Method not allowed" }),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        };
    }

    try {
        const body = await request.json() as ImportData;
        
        if (!body || !body.productions || !body.users || !body.groups) {
            return {
                status: 400,
                body: JSON.stringify({ error: "Invalid backup data format" }),
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            };
        }

        const results = {
            productions: { imported: 0, errors: 0 },
            users: { imported: 0, errors: 0 },
            groups: { imported: 0, errors: 0 }
        };

        // グループデータをインポート
        const groupClient = TableClient.fromConnectionString(connectionString, groupTableName);
        for (const group of body.groups) {
            try {
                // 既存のデータをチェック
                const existingGroup = await groupClient.getEntity(group.partitionKey, group.rowKey);
                if (existingGroup) {
                    // 既存データを更新
                    await groupClient.updateEntity(group, "Replace");
                } else {
                    // 新規データを作成
                    await groupClient.createEntity(group);
                }
                results.groups.imported++;
            } catch (error) {
                context.log(`Error importing group ${group.rowKey}: ${error}`);
                results.groups.errors++;
            }
        }

        // ユーザーデータをインポート
        const userClient = TableClient.fromConnectionString(connectionString, userTableName);
        for (const user of body.users) {
            try {
                // 既存のデータをチェック
                const existingUser = await userClient.getEntity(user.partitionKey, user.rowKey);
                if (existingUser) {
                    // 既存データを更新
                    await userClient.updateEntity(user, "Replace");
                } else {
                    // 新規データを作成
                    await userClient.createEntity(user);
                }
                results.users.imported++;
            } catch (error) {
                context.log(`Error importing user ${user.rowKey}: ${error}`);
                results.users.errors++;
            }
        }

        // 生産データをインポート
        const productionClient = TableClient.fromConnectionString(connectionString, productionTableName);
        for (const production of body.productions) {
            try {
                // 既存のデータをチェック
                const existingProduction = await productionClient.getEntity(production.partitionKey, production.rowKey);
                if (existingProduction) {
                    // 既存データを更新
                    await productionClient.updateEntity(production, "Replace");
                } else {
                    // 新規データを作成
                    await productionClient.createEntity(production);
                }
                results.productions.imported++;
            } catch (error) {
                context.log(`Error importing production ${production.rowKey}: ${error}`);
                results.productions.errors++;
            }
        }

        return {
            status: 200,
            body: JSON.stringify({
                message: "Data import completed",
                results,
                importDate: new Date().toISOString()
            }),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
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

app.http('ImportData', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: "import-data",
    handler: ImportData
});

export { ImportData };
