import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { jwtSecret, corsOrigins } from "../../config";

const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "UsersTable";
const partitionKey = "User";

interface UserInput {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  password: string;
}

async function CreateUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log("CreateUser function processed a request.");

  const origin = request.headers.get("Origin") || "";
  const corsOrigin = origin || "https://carbontrackerstorage.z31.web.core.windows.net";

  // OPTIONS リクエストの処理
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      }
    };
  }

  if (request.headers.get("content-type") !== "application/json") {
    return {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Content-Type must be application/json" }),
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

  // 管理者権限チェック（admin or operator）
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

  const input = await request.json() as UserInput;

  if (!input.username || !input.email || !input.password) {
    return {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }

  try {
    const client = TableClient.fromConnectionString(connectionString, tableName);
    const rowKey = uuidv4();
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const timestamp = new Date().toISOString();

    const user = {
      partitionKey,
      rowKey,
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      isActive: input.isActive,
      passwordHash: hashedPassword,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await client.createEntity(user);

    return {
      status: 201,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "User created successfully",
        id: rowKey,
      }),
    };
  } catch (error) {
    context.error("Error creating user:", error);
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

app.http("CreateUser", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "users",
  handler: CreateUser,
});

export { CreateUser };
