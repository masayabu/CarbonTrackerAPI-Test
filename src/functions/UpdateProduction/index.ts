import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

// Azure Table Storage 接続設定
const connectionString = process.env.AzureWebJobsStorage!;
const tableName = "ProductionTable";
const partitionKey = "Production"; // 固定値でもユーザー別でもOK

interface UpdateProductionRequestBody {
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

async function UpdateProduction(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    const { id } = request.params;
    let body: UpdateProductionRequestBody;
    try {
        body = await request.json() as UpdateProductionRequestBody;
    } catch (error) {
        context.log("Error parsing request body:", error);
        return {
            status: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json",
            },
            body: "Invalid request body",
        };
    }

    context.log("Request ID:", id);
    context.log("Request body:", JSON.stringify(body));

    if (!id || !body) {
        return {
            status: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json",
            },
            body: "Missing id or request body",
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

    // 必須フィールドのバリデーション
    if (!date || !materialType || !extinguishingMethod || !userId || !groupId) {
        return {
            status: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json",
            },
            body: "Missing required fields",
        };
    }

    const client = TableClient.fromConnectionString(connectionString, tableName);

    try {
        // 既存のエンティティを取得
        const existingEntity = await client.getEntity(partitionKey, id);

        // 更新するエンティティを作成
        const updatedEntity = {
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
            createdAt: existingEntity.createdAt,
            updatedAt: new Date().toISOString(),
        };

        // エンティティを更新
        await client.updateEntity(updatedEntity);

        return {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                message: "Entity updated successfully",
                production: updatedEntity
            })
        };
    } catch (error) {
        if (error instanceof Error) {
            context.log(`Error: ${error.message}`);
            context.log(`Stack Trace: ${error.stack}`);
        } else {
            context.log(`Unknown error: ${JSON.stringify(error)}`);
        }
        return {
            status: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json",
            },
            body: "Internal Server Error",
        };
    }
}

app.http('UpdateProduction', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: "productions/{id}",
    handler: UpdateProduction
});

export { UpdateProduction };
