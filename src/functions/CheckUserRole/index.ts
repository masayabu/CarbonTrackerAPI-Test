import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

// Azure Table Storage 接続設定
const connectionString = process.env.AzureWebJobsStorage!;
const userTableName = "UserTable";

async function CheckUserRole(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // クエリパラメータからuserIdを取得
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
        return {
            status: 400,
            body: JSON.stringify({ error: "userId parameter is required" }),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        };
    }

    try {
        const client = TableClient.fromConnectionString(connectionString, userTableName);

        // ユーザーを検索
        const user = await client.getEntity("User", userId);

        if (!user) {
            return {
                status: 404,
                body: JSON.stringify({ error: "User not found" }),
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            };
        }

        const role = user.role || "user"; // デフォルトは"user"
        const isOperator = role === "operator";

        return {
            status: 200,
            body: JSON.stringify({
                userId,
                role,
                isOperator
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

app.http('CheckUserRole', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: "check-user-role",
    handler: CheckUserRole
});

export { CheckUserRole };
