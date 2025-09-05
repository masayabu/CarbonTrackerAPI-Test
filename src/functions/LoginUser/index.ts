import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { corsOrigins, jwtSecret } from "../../config";

const connectionString = process.env.AzureWebJobsStorage;
if (!connectionString) {
    console.error("Error: AzureWebJobsStorage environment variable is not set.");
    throw new Error("Missing AzureWebJobsStorage connection string.");
}

const tableName = "UsersTable";

async function loginUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
    // 許可するオリジンのリスト（config.tsから読み取り）
  const allowedOrigins = corsOrigins.split(",").map((origin: string) => origin.trim());
  console.log("allowedOrigins:", allowedOrigins);
  const origin = request.headers.get("Origin") || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  if (request.method === "OPTIONS") {
    const headers = {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
    };
    context.log("CORS headers for OPTIONS:", headers);
    return {
      status: 200,
      headers,
    };
  }

  const { email, password } = (await request.json()) as {
    email: string;
    password: string;
  };

  if (!email || !password) {
    return {
      status: 400,
      headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "emailとpasswordが必要です" }),
    };
  }

  const client = TableClient.fromConnectionString(connectionString as string, tableName);

  try {
    const users = client.listEntities({
      queryOptions: {
        filter: `email eq '${email}'`,
      },
    });

    for await (const user of users) {
      const isMatch = await bcrypt.compare(
        password,
        user.passwordHash as string
      );
      console.log("isMatch:", isMatch);
    if (!jwtSecret) {
      context.error("JWT_SECRET is not set");
      return {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Internal server error: JWT_SECRET missing" })
      };
    }
    const token = jwt.sign(
        { userId: user.rowKey, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn: "1h" }
      );
      if (isMatch) {
        return {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": corsOrigin,
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "ログイン成功",
            userId: user.rowKey,
            email: user.email,
            name: user.name,
            role: user.role,
            token: token,
          }),
        };
      } else {
        return {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": corsOrigin,
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ error: "パスワードが正しくありません" }),
        };
      }
    }

    return {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "ユーザーが見つかりません" }),
    };
  } catch (err) {
    context.error("ログインエラー:", err);
    return {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "サーバーエラー" }),
    };
  }
}

app.http("LoginUser", {
  route: "auth/login",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: loginUser,
});

export { loginUser as LoginUser };
