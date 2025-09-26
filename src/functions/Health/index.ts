import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

/**
 * ヘルスチェックAPI
 * サーバーが起動しているかどうかを確認するためのシンプルなエンドポイント
 */
async function Health(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Health check requested from ${request.headers.get('x-forwarded-for') || 'unknown'}`);
    
    try {
        // 現在の時刻とサーバー情報を返す
        const healthData = {
            status: "healthy",
            timestamp: new Date().toISOString(),
            server: "CarbonTrackerAPI",
            version: "1.0.0",
            uptime: process.uptime()
        };

        return {
            status: 200,
            body: JSON.stringify(healthData),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        };
    } catch (error: any) {
        context.log(`Health check error: ${error.message}`);
        
        return {
            status: 500,
            body: JSON.stringify({
                status: "unhealthy",
                timestamp: new Date().toISOString(),
                error: error.message
            }),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        };
    }
}

// OPTIONSリクエストのハンドリング
async function HealthOptions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    return {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    };
}

// HTTPエンドポイントの設定
app.http('Health', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous', // 認証不要
    route: 'health',
    handler: Health
});

export { Health };
