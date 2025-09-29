import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";
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
    materialType: string;
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
    carbonContent: number;
    ipccLongTerm: number;
    createdAt: string;
    updatedAt: string;
}

interface CalcSettings {
    carbonContentFactors: {
        bamboo: number;
        pruning: number;
        herbaceous: number;
        other: number;
    };
    co2ConversionFactor: number;
    ipccLongTermFactors: {
        bamboo: number;
        pruning: number;
        herbaceous: number;
        other: number;
    };
}

// ストリームを文字列に変換するヘルパー関数
async function streamToString(readableStream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        readableStream.on('data', (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        readableStream.on('end', () => {
            resolve(Buffer.concat(chunks).toString('utf8'));
        });
        readableStream.on('error', reject);
    });
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

    // クエリパラメータからgroupIdを取得
    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId');
    
    if (!groupId) {
        return {
            status: 400,
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: "groupId parameter is required" })
        };
    }

    try {
        // calc-settingsから設定値を取得
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient("calc-settings");
        const blobClient = containerClient.getBlobClient("setting.json");
        
        let calcSettings: CalcSettings;
        try {
            const downloadResponse = await blobClient.download();
            const settingsText = await streamToString(downloadResponse.readableStreamBody!);
            calcSettings = JSON.parse(settingsText);
        } catch (error) {
            context.log(`Warning: Could not load calc settings, using defaults: ${error}`);
            // デフォルト値を使用
            calcSettings = {
                carbonContentFactors: {
                    bamboo: 0.8,
                    pruning: 0.8,
                    herbaceous: 0.65,
                    other: 0.8
                },
                co2ConversionFactor: 3.67,
                ipccLongTermFactors: {
                    bamboo: 0.8,
                    pruning: 0.8,
                    herbaceous: 0.65,
                    other: 0.8
                }
            };
        }

        // ProductionTableからデータを取得（指定されたグループのみ）
        const productionClient = TableClient.fromConnectionString(connectionString, productionTableName);
        const productionEntities = productionClient.listEntities<ProductionData>({
            queryOptions: { filter: `groupId eq '${groupId}'` }
        });

        // データを年、groupId、materialTypeでグループ化
        const groupedData = new Map<string, {
            year: string;
            groupId: string;
            materialType: string;
            materialAmount: number;
            charcoalProduced: number;
            charcoalVolume: number;
            co2Reduction: number;
            carbonContent: number;
            ipccLongTerm: number;
        }>();

        for await (const entity of productionEntities) {
            if (!entity.date || !entity.groupId || !entity.materialType) continue;

            // 日付から年を抽出
            const year = entity.date.split('-')[0];
            const groupKey = `${year}-${entity.groupId}-${entity.materialType}`;

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
                    materialType: entity.materialType,
                    materialAmount: 0,
                    charcoalProduced: 0,
                    charcoalVolume: 0,
                    co2Reduction: 0,
                    carbonContent: 0,
                    ipccLongTerm: 0
                });
            }

            const group = groupedData.get(groupKey)!;
            group.materialAmount += parseNumber(entity.materialAmount);
            group.charcoalProduced += parseNumber(entity.charcoalProduced);
            group.charcoalVolume += parseNumber(entity.charcoalVolume);
            group.co2Reduction += parseNumber(entity.co2Reduction);
        }

        // 各グループの計算を実行
        for (const [groupKey, data] of groupedData) {
            // carbonContent量の計算
            const carbonContentFactor = calcSettings.carbonContentFactors[data.materialType as keyof typeof calcSettings.carbonContentFactors] || calcSettings.carbonContentFactors.other;
            data.carbonContent = data.charcoalProduced * carbonContentFactor;

            // co2Reduction量の計算
            data.co2Reduction = data.carbonContent * calcSettings.co2ConversionFactor;

            // ipccLongTerm量の計算
            const ipccLongTermFactor = calcSettings.ipccLongTermFactors[data.materialType as keyof typeof calcSettings.ipccLongTermFactors] || calcSettings.ipccLongTermFactors.other;
            data.ipccLongTerm = data.co2Reduction * ipccLongTermFactor;
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
            // 指定されたグループの既存エンティティを取得して削除
            const existingEntities = productionSumClient.listEntities<ProductionSumData>({
                queryOptions: { filter: `groupId eq '${groupId}'` }
            });
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
                carbonContent: data.carbonContent,
                ipccLongTerm: data.ipccLongTerm,
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
                groupId: groupId,
                totalRecords: groupedData.size,
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
    authLevel: 'anonymous',
    route: "production-sum",
    handler: CreateProductionSum
});

export { CreateProductionSum };
