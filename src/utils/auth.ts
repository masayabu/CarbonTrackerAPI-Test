import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import jwt from "jsonwebtoken";
import { jwtSecret, corsOrigins } from "../config";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthResult {
  success: boolean;
  payload?: JWTPayload;
  response?: HttpResponseInit;
}

/**
 * JWT認証を実行する共通関数
 * @param request HTTPリクエスト
 * @param context 実行コンテキスト
 * @returns 認証結果
 */
export function authenticateJWT(
  request: HttpRequest,
  context: InvocationContext
): AuthResult {
  context.log("authenticateJWT: 認証チェックを開始します");
  
  // CORS設定
  const allowedOrigins = corsOrigins.split(",").map((origin: string) => origin.trim());
  const origin = request.headers.get("Origin") || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  // JWT_SECRETの存在確認
  if (!jwtSecret) {
    context.error("JWT_SECRET is not set");
    return {
      success: false,
      response: {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Internal server error: JWT_SECRET missing" })
      }
    };
  }

  // Authorizationヘッダーからトークンを取得
  const authHeader = request.headers.get("Authorization");
  context.log(`authenticateJWT: Authorization header: ${authHeader}`);
  
  const token = authHeader?.replace("Bearer ", "");
  context.log(`authenticateJWT: Extracted token: ${token ? "存在" : "なし"}`);
  
  if (!token) {
    context.log("authenticateJWT: トークンが見つかりません - 401エラーを返します");
    return {
      success: false,
      response: {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Unauthorized: Missing token" })
      }
    };
  }

  // JWTトークンの検証
  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    // 必須フィールドの確認
    if (!decoded.userId || !decoded.email || !decoded.role) {
      return {
        success: false,
        response: {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": corsOrigin,
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ error: "Unauthorized: Invalid token payload" })
        }
      };
    }

    return {
      success: true,
      payload: decoded
    };
  } catch (error) {
    context.error("JWT verification error:", error);
    
    if (error instanceof Error && error.name === "JsonWebTokenError") {
      return {
        success: false,
        response: {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": corsOrigin,
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ error: `Unauthorized: Invalid token (${error.message})` })
        }
      };
    } else if (error instanceof Error && error.name === "TokenExpiredError") {
      return {
        success: false,
        response: {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": corsOrigin,
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ error: "Unauthorized: Token expired" })
        }
      };
    }
    
    // その他のエラー
    return {
      success: false,
      response: {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Unauthorized: Token verification failed" })
      }
    };
  }
}

/**
 * 管理者権限をチェックする関数
 * @param payload JWTペイロード
 * @returns 管理者権限があるかどうか
 */
export function isAdmin(payload: JWTPayload): boolean {
  return payload.role === "admin";
}

/**
 * オペレーター権限をチェックする関数
 * @param payload JWTペイロード
 * @returns オペレーター権限があるかどうか
 */
export function isOperator(payload: JWTPayload): boolean {
  return payload.role === "operator";
}

/**
 * 管理者またはオペレーター権限をチェックする関数
 * @param payload JWTペイロード
 * @returns 管理者またはオペレーター権限があるかどうか
 */
export function isAdminOrOperator(payload: JWTPayload): boolean {
  return isAdmin(payload) || isOperator(payload);
}

/**
 * ユーザー自身のリソースかどうかをチェックする関数
 * @param payload JWTペイロード
 * @param targetUserId 対象のユーザーID
 * @returns ユーザー自身のリソースかどうか
 */
export function isOwnResource(payload: JWTPayload, targetUserId: string): boolean {
  return payload.userId === targetUserId;
}

/**
 * 権限チェック用のレスポンスを生成する関数
 * @param corsOrigin CORSオリジン
 * @param message エラーメッセージ
 * @returns 403 Forbiddenレスポンス
 */
export function createForbiddenResponse(corsOrigin: string, message: string = "Forbidden: Insufficient permissions"): HttpResponseInit {
  return {
    status: 403,
    headers: {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ error: message })
  };
}
