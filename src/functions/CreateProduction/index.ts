import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { v4 as uuidv4 } from "uuid";
import { authenticateJWT, JWTPayload } from "../../utils/auth";
import { corsOrigins } from "../../config";

// Azure Table Storage 接続設定
const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "ProductionTable";
const partitionKey = "Production"; // 固定値でもユーザー別でもOK

async function CreateProduction(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    // CORS設定
    const allowedOrigins = corsOrigins.split(",").map((origin: string) => origin.trim());
    const origin = request.headers.get("Origin") || "";
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    // JWT認証
    const authResult = authenticateJWT(request, context);
    if (!authResult.success) {
        return authResult.response!;
    }

    const userPayload = authResult.payload!;
    context.log(`Http function processed request for url "${request.url}" by user: ${userPayload.email}`);
        
    try {
        interface ProductionRequestBody {
            date: string;
            materialType: string;
            materialAmount?: number;
            charcoalProduced?: number;
            charcoalVolume?: number;
            charcoalScale?: string;
            charcoalScaleInput?: number;
            inputMethod?: string;
            extinguishingMethod: string;
            co2Reduction?: number;
            batchNumber?: string;
            notes?: string;
            photoUrl?: string;
            userId: string;
            groupId: string;
        }

        let body: ProductionRequestBody;
        try {
            body = await request.json() as ProductionRequestBody;
        } catch (error) {
            if (error instanceof Error) {
                context.log(`Failed to parse request body: ${error.message}`);
            } else {
                context.log(`Unknown error while parsing request body: ${JSON.stringify(error)}`);
            }
            return {
                status: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Content-Type": "application/json",
                },
                body: "Invalid JSON format"
            };
        }

        const {
            date,
            materialType,
            materialAmount,
            charcoalProduced,
            charcoalVolume,
            charcoalScale,
            charcoalScaleInput,
            inputMethod,
            extinguishingMethod,
            co2Reduction,
            batchNumber,
            notes,
            photoUrl,
            userId,
            groupId
        } = body;

        if (!date || !materialType || !extinguishingMethod || !userId || !groupId) {
            return {
              status: 400,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json",
              },
              body: "Missing required fields"
            };
        }

        const id = uuidv4();

        const production = {
            partitionKey,
            rowKey: id,
            date,
            materialType,
            materialAmount: materialAmount?.toString() || null,
            charcoalProduced: charcoalProduced?.toString() || null,
            charcoalVolume: charcoalVolume?.toString() || null,
            charcoalScale: charcoalScale || null,
            charcoalScaleInput: charcoalScaleInput?.toString() || null,
            inputMethod: inputMethod || null,
            extinguishingMethod,
            co2Reduction: co2Reduction?.toString() || null,
            batchNumber: batchNumber || null,
            notes: notes || null,
            photoUrl: photoUrl || null,
            userId,
            groupId,
            createdAt: new Date().toISOString(),
            updatedAt: null
        };
        const client = TableClient.fromConnectionString(connectionString, tableName);
        await client.createEntity(production);

        context.log(`Entity created with ID: ${id}`);
        return {
            status: 201,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                id,
                message: "Entity created successfully",
                production
            })
        };
    } catch (error) {
        if (error instanceof Error) {
            context.log(`Error: ${error.message}`);
            context.log(`Stack Trace: ${error.stack}`); // スタックトレースを追加
        } else {
            context.log(`Unknown error: ${JSON.stringify(error)}`);
        }
    };
    return {
        status: 500,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json",
        },
        body: "Internal Server Error"
    };
}

app.http('CreateProduction', {
    methods: ['GET', 'POST'],
    authLevel: 'function',
    route: "production",
    handler: CreateProduction
});

export { CreateProduction };
