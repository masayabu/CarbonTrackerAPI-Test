import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { jwtSecret, corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "UsersTable";
const partitionKey = "User";

async function UpdateUserPassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
  context.log("UpdateUserPassword: Requested rowKey:", rowKey);
  
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

  context.log("decoded:", decoded);

  // 権限チェック: 自分自身のパスワード更新または管理者・オペレーター権限
  if (decoded.userId !== rowKey && decoded.role !== "admin" && decoded.role !== "operator") {
    return {
      status: 403,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Forbidden: You can only update your own password or need admin/operator role" })
    };
  }

  let passwordData: { currentPassword?: string; newPassword: string };
  try {
    passwordData = await request.json() as { currentPassword?: string; newPassword: string };
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

  // バリデーション
  if (!passwordData.newPassword) {
    return {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "New password is required." }),
    };
  }

  // パスワードの長さチェック（最低8文字）
  if (passwordData.newPassword.length < 8) {
    return {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "New password must be at least 8 characters long." }),
    };
  }

  const client = TableClient.fromConnectionString(connectionString, tableName);

  try {
    context.log("UpdateUserPassword: Attempting to get entity with partitionKey:", partitionKey, "rowKey:", rowKey);
    const existing = await client.getEntity(partitionKey, rowKey);
    context.log("UpdateUserPassword: Found existing entity:", existing);

    // 自分自身のパスワード更新の場合、現在のパスワードの確認が必要
    if (decoded.userId === rowKey) {
      if (!passwordData.currentPassword) {
        return {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": corsOrigin,
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ error: "Current password is required for password update." }),
        };
      }

      // 現在のパスワードの検証
      const isCurrentPasswordValid = await bcrypt.compare(passwordData.currentPassword, existing.passwordHash as string);
      if (!isCurrentPasswordValid) {
        return {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": corsOrigin,
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ error: "Current password is incorrect." }),
        };
      }
    }

    // 新しいパスワードのハッシュ化
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(passwordData.newPassword, saltRounds);

    const updatedEntity = {
      ...existing,
      passwordHash: newPasswordHash,
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
      body: JSON.stringify({ message: "Password updated successfully", id: rowKey }),
    };
  } catch (error: any) {
    context.error(`Password update failed: ${error.message}`);
    context.error(`Password update failed details: partitionKey=${partitionKey}, rowKey=${rowKey}`);
    
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
      body: JSON.stringify({ error: "Failed to update password." }),
    };
  }
}

app.http("UpdateUserPassword", {
  methods: ["PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/update-password/{id}",
  handler: UpdateUserPassword,
});

export { UpdateUserPassword };
