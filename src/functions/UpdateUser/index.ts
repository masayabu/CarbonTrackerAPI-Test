import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import jwt from "jsonwebtoken";
import { jwtSecret, corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "UsersTable";
const partitionKey = "User";

async function UpdateUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
        "Access-Control-Allow-Methods": "PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      }
    };
  }

  const rowKey = request.params.id;
  context.log("UpdateUser: Requested rowKey:", rowKey); // デバッグ用
  
  if (!rowKey) {
    return {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Missing user ID in URL." }),
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

  context.log("decoded:", decoded); // デバッグ用

  // 権限チェック: 自分自身の更新または管理者・オペレーター権限
  if (decoded.userId !== rowKey && decoded.role !== "admin" && decoded.role !== "operator") {
    return {
      status: 403,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Forbidden: You can only update your own profile or need admin/operator role" })
    };
  }

  let updateData: any;
  try {
    updateData = await request.json();
  } catch {
    return {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Invalid JSON in request body." }),
    };
  }

  const client = TableClient.fromConnectionString(connectionString, tableName);

  try {
    context.log("UpdateUser: Attempting to get entity with partitionKey:", partitionKey, "rowKey:", rowKey); // デバッグ用
    const existing = await client.getEntity(partitionKey, rowKey);
    context.log("UpdateUser: Found existing entity:", existing); // デバッグ用

    const updatedEntity = {
      ...existing,
      ...updateData,
      partitionKey,
      rowKey,
      updatedAt: new Date().toISOString(),
    };

    await client.updateEntity(updatedEntity, "Merge");

    return {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "User updated successfully", id: rowKey }),
    };
  } catch (error: any) {
    context.error(`Update failed: ${error.message}`);
    context.error(`Update failed details: partitionKey=${partitionKey}, rowKey=${rowKey}`); // デバッグ用
    
    // エラーの種類に応じて適切なステータスコードを返す
    if (error.message.includes("EntityNotFound")) {
      return {
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "User not found" }),
      };
    }
    
    return {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Failed to update user." }),
    };
  }
}

app.http("UpdateUser", {
  methods: ["PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/update/{id}",
  handler: UpdateUser,
});

export { UpdateUser };
