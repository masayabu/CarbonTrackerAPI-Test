import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { authenticateJWT, JWTPayload } from "../../utils/auth";
import { corsOrigins } from "../../config";

// Azure Table Storage 接続設定
const connectionString = process.env.AzureWebJobsStorage!;
const productionTableName = "ProductionTable";
const productionSumTableName = "ProductionSumTable";
const partitionKey = "ProductionSum";

interface ProductionData {
    partitionKey: string;
    rowKey: string;
    date: string;
    materialAmount?: string;
    charcoalProduced?: string;
    charcoalVolume?: string;
    co2Reduction?: string;
    groupId: string;
}

interface ProductionSumData {
    partitionKey: string;
    rowKey: string;
    year: string;
    groupId: string;
    materialAmount: number;
    charcoalProduced: number;
    charcoalVolume: number;
    co2Reduction: number;
    createdAt: string;
    updatedAt: string;
}

async function CreateProductionSum(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
        // ProductionTableからデータを取得
        const productionClient = TableClient.fromConnectionString(connectionString, productionTableName);
        const productionEntities = productionClient.listEntities<ProductionData>();

        // データを年とgroupIdでグループ化
        const groupedData = new Map<string, {
            year: string;
            groupId: string;
            materialAmount: number;
            charcoalProduced: number;
            charcoalVolume: number;
            co2Reduction: number;
        }>();

        for await (const entity of productionEntities) {
            if (!entity.date || !entity.groupId) continue;

            // 日付から年を抽出
            const year = entity.date.split('-')[0];
            const groupKey = `${year}-${entity.groupId}`;

            // 数値変換用のヘルパー関数
            const parseNumber = (value: string | undefined): number => {
                if (!value) return 0;
                const parsed = parseFloat(value);
                return isNaN(parsed) ? 0 : parsed;
            };

            if (!groupedData.has(groupKey)) {
                groupedData.set(groupKey, {
                    year,
                    groupId: entity.groupId,
                    materialAmount: 0,
                    charcoalProduced: 0,
                    charcoalVolume: 0,
                    co2Reduction: 0
                });
            }

            const group = groupedData.get(groupKey)!;
            group.materialAmount += parseNumber(entity.materialAmount);
            group.charcoalProduced += parseNumber(entity.charcoalProduced);
            group.charcoalVolume += parseNumber(entity.charcoalVolume);
            group.co2Reduction += parseNumber(entity.co2Reduction);
        }

        // ProductionSumテーブルの作成と既存データの削除（洗い替え）
        const productionSumClient = TableClient.fromConnectionString(connectionString, productionSumTableName);
        
        try {
            // テーブルが存在するかチェックし、存在しない場合は作成
            await productionSumClient.createTable();
            context.log(`Created ProductionSumTable`);
        } catch (error) {
            // テーブルが既に存在する場合は無視
            context.log(`ProductionSumTable already exists or creation failed: ${error}`);
        }
        
        try {
            // 既存のエンティティを取得して削除
            const existingEntities = productionSumClient.listEntities<ProductionSumData>();
            const deletePromises: Promise<void>[] = [];

            for await (const entity of existingEntities) {
                deletePromises.push(
                    productionSumClient.deleteEntity(entity.partitionKey, entity.rowKey).then(() => {})
                );
            }

            await Promise.all(deletePromises);
            context.log(`Deleted ${deletePromises.length} existing entities from ProductionSumTable`);
        } catch (error) {
            context.log(`Warning: Could not delete existing entities: ${error}`);
            // テーブルが存在しない場合は無視
        }

        // 新しいデータをProductionSumテーブルに保存
        const savePromises: Promise<void>[] = [];
        const currentTime = new Date().toISOString();

        for (const [groupKey, data] of groupedData) {
            const productionSumData: ProductionSumData = {
                partitionKey,
                rowKey: groupKey,
                year: data.year,
                groupId: data.groupId,
                materialAmount: data.materialAmount,
                charcoalProduced: data.charcoalProduced,
                charcoalVolume: data.charcoalVolume,
                co2Reduction: data.co2Reduction,
                createdAt: currentTime,
                updatedAt: currentTime
            };

            savePromises.push(
                productionSumClient.createEntity(productionSumData).then(() => {})
            );
        }

        await Promise.all(savePromises);

        context.log(`Created ${savePromises.length} production sum entities`);

        return {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: "Production sum data created successfully",
                totalGroups: groupedData.size,
                data: Array.from(groupedData.values())
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
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
}

app.http('CreateProductionSum', {
    methods: ['GET', 'POST'],
    authLevel: 'function',
    route: "production-sum",
    handler: CreateProductionSum
});

export { CreateProductionSum };
