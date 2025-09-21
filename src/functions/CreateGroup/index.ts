import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { v4 as uuidv4 } from "uuid";
import { authenticateJWT, JWTPayload, isAdminOrOperator } from "../../utils/auth";
import { corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "GroupsTable";
const partitionKey = "Groups"; // 固定値でもユーザー別でもOK

async function CreateGroup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

    interface GroupBody {
        PartitionKey: string; // 例: "Groups"
        RowKey: string; // グループの一意な ID（UUID）
        name: string; // グループ名
        description: string; // 説明
        timestamp: string; // 作成日時
        createdAt?: string; // 作成日時（オプション）
        updatedAt?: string; // 更新日時（オプション）
    }

    let body: GroupBody;
    try {
        body = await request.json() as GroupBody;
    } catch (error) {
        if (error instanceof Error) {
            context.log(`Failed to parse request body: ${error.message}`);
        } else {
            context.log(`Unknown error while parsing request body: ${JSON.stringify(error)}`);
        }
        return {
            status: 400,
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Content-Type": "application/json",
              },
            body: "Invalid JSON format"
        };
    }
    const { name, description } = body;
    if (!name) {
        return {
            status: 400,
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Content-Type": "application/json",
              },
            body: "Name is required"
        };
    }
    if (!description) {
        return {
            status: 400,
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Content-Type": "application/json",
              },
            body: "Description is required"
        };
    }

    const id = uuidv4();
    const groupEntity = {
        partitionKey: partitionKey,
        rowKey: id,
        name,
        description,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
    };

    const tableClient = TableClient.fromConnectionString(connectionString, tableName);
    try {
        await tableClient.createEntity(groupEntity);
        return {
            status: 201,
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Content-Type": "application/json",
              },
            body: JSON.stringify(groupEntity),
        };
    } catch (error) {
        if (error instanceof Error) {
            context.log(`Failed to create entity: ${error.message}`);
        } else {
            context.log(`Unknown error while creating entity: ${JSON.stringify(error)}`);
        }
        return {
            status: 500,
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Content-Type": "application/json",
              },
            body: "Internal Server Error"
        };
    }
}

app.http('CreateGroup', {
    methods: ['POST'],
    authLevel: 'function',
    route: "group",
    handler: CreateGroup
});

export { CreateGroup };
