import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

// Azure Table Storage 接続設定
const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "ProductionTable";

async function GetProductions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // クエリパラメータからgroupIdを取得
    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId');
    
    if (!groupId) {
        return {
            status: 400,
            body: JSON.stringify({ error: "groupId parameter is required" }),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
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
    };
    return {
        status: 500,
        body: "Internal Server Error",
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        }
    };
}

app.http('GetProductions', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: "productions",
    handler: GetProductions
});

export { GetProductions };
