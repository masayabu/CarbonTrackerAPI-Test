import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "UsersTable";
const partitionKey = "User";

async function GetUserByEmail(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

    try {
        const client = TableClient.fromConnectionString(connectionString, tableName);
        
        // URLパラメータからemailを取得
        const email = request.params.email;
        
        if (!email || email.trim() === '') {
            return {
                status: 400,
                headers: {
                    "Access-Control-Allow-Origin": corsOrigin,
                    "Access-Control-Allow-Credentials": "true",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ error: "Missing or empty email parameter" })
            };
        }

        // メールアドレスの形式を簡単に検証
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                status: 400,
                headers: {
                    "Access-Control-Allow-Origin": corsOrigin,
                    "Access-Control-Allow-Credentials": "true",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ error: "Invalid email format" })
            };
        }

        // 全ユーザーをスキャンしてemailでフィルタリング
        const entities = client.listEntities<{
            firstName: string;
            lastName: string;
            email: string;
            role?: string;
            isActive?: boolean;
        }>({
            queryOptions: {
                filter: `PartitionKey eq '${partitionKey}'`
            }
        });

        let foundUser = null;
        for await (const entity of entities) {
            if (entity.email === email) {
                foundUser = entity;
                break;
            }
        }

        if (!foundUser) {
            return {
                status: 404,
                headers: {
                    "Access-Control-Allow-Origin": corsOrigin,
                    "Access-Control-Allow-Credentials": "true",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ error: "User not found" })
            };
        }

        // RowKeyとユーザー情報を返す
        return {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                rowKey: foundUser.rowKey,
                email: foundUser.email,
                firstName: foundUser.firstName,
                lastName: foundUser.lastName,
                role: foundUser.role || "viewer",
                isActive: foundUser.isActive
            })
        };
    } catch (error) {
        context.error("Error fetching user by email:", error);
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

app.http("GetUserByEmail", {
    route: "users/email/{email}",
    methods: ["GET", "OPTIONS"],
    authLevel: "anonymous",
    handler: GetUserByEmail
});

export { GetUserByEmail };
