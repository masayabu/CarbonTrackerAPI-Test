import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import jwt from "jsonwebtoken";
import { jwtSecret, corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "UsersTable";
const partitionKey = "User";

async function ListUsers(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
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

  // JWTトークンの検証
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return {
      status: 401,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Unauthorized: Missing token" })
    };
  }

  let decoded: { userId: string; email: string; role: string };
  try {
    decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string; role: string };
  } catch (error) {
    context.error("JWT verification error:", error);
    if (error instanceof Error && error.name === "JsonWebTokenError") {
      return {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: `Unauthorized: Invalid token (${error.message})` })
      };
    } else if (error instanceof Error && error.name === "TokenExpiredError") {
      return {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Unauthorized: Token expired" })
      };
    }
    throw error;
  }

  context.log("ListUsers: decoded:", decoded); // デバッグ用

  // 権限チェック: 管理者・オペレーター権限が必要
  if (decoded.role !== "admin" && decoded.role !== "operator") {
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

  const client = TableClient.fromConnectionString(connectionString, tableName);

  try {
    const entities = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${partitionKey}'` } });

    const users: any[] = [];
    for await (const entity of entities) {
      users.push(entity);
    }

    context.log("ListUsers: Found users count:", users.length); // デバッグ用

    return {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(users),
    };
  } catch (error: any) {
    context.error(`List failed: ${error.message}`);
    return {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Failed to fetch users." }),
    };
  }
}

app.http("ListUsers", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "listusers",
  handler: ListUsers,
});

export { ListUsers };
