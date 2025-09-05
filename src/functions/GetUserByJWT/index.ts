import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import jwt from "jsonwebtoken";
import { jwtSecret, corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "UsersTable";
const partitionKey = "User";

async function getUser(
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

  try {
    const client = TableClient.fromConnectionString(connectionString, tableName);

    // 認証情報から userId を取得（JWTより）
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
      throw error; // その他のエラーはキャッチ
    }

    const userId = decoded.userId;
    if (!userId) {
      return {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Unauthorized: Missing userId in token" })
      };
    }

    // UserTable からユーザー情報を取得
    const userEntity = await client.getEntity<{ firstName: string; lastName: string; email: string; role?: string }>(partitionKey, userId);

    if (!userEntity) {
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

    // 必要なフィールドを返す
    return {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: userEntity.lastName + userEntity.firstName,
        email: userEntity.email,
        role: userEntity.role || "viewer" // デフォルトは viewer
      })
    };
  } catch (error) {
    context.error("Error fetching user:", error);
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

app.http("GetUserByJWT", {
  route: "auth/getuserjwt",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: getUser
});

export { getUser as GetUserByJWT };
