import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import jwt from "jsonwebtoken";
import { connectionString, tableName, partitionKey, jwtSecret, corsOrigins } from "../../config";

async function DeleteProduction(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const allowedOrigins = corsOrigins.split(",").map((origin: string) => origin.trim());
  const origin = request.headers.get("Origin") || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  // Preflight (OPTIONS)
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    };
  }

  const { id } = request.params;
  context.log(`Deleting production with ID: ${id}`);

  if (!id) {
    return {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Missing ID" }),
    };
  }

  // JWT 検証
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return {
      status: 401,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Unauthorized: Missing token" }),
    };
  }

  let decoded: { userId: string; email: string; role: string };
  try {
    decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string; role: string };
  } catch (error: any) {
    context.error("JWT verification error:", error);
    const message = error?.name === "TokenExpiredError"
      ? "Unauthorized: Token expired"
      : `Unauthorized: Invalid token${error?.message ? ` (${error.message})` : ""}`;
    return {
      status: 401,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: message }),
    };
  }

  // 権限チェック（admin または operator のみ許可）
  if (decoded.role !== "admin" && decoded.role !== "operator") {
    return {
      status: 403,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Forbidden: Admin or operator role required" }),
    };
  }

  const client = TableClient.fromConnectionString(connectionString, tableName);

  try {
    await client.deleteEntity(partitionKey, id);
    return {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
    };
  } catch (error: any) {
    context.log(`Error deleting entity: ${error?.message || JSON.stringify(error)}`);
    // 存在しない場合は 404、それ以外は 500
    const notFound = (error?.statusCode === 404) || (error?.code === "ResourceNotFound");
    return {
      status: notFound ? 404 : 500,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: notFound ? "Production not found or already deleted" : "Failed to delete production" }),
    };
  }
}

app.http("DeleteProduction", {
  methods: ["DELETE", "OPTIONS"],
  route: "productions/{id}",
  authLevel: "anonymous",
  handler: DeleteProduction,
});

export { DeleteProduction };
