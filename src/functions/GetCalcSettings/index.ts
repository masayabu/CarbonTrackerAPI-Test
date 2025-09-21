import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

// 計算パラメータ用のインターフェース
interface CalculationSettings {
  extinguishingCorrections: {
    water: number;
    oxygen: number;
  };
  volumeToWeightFactors: {
    bamboo: number;
    pruning: number;
    herbaceous: number;
    other: number;
  };
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

async function GetCalcSettings(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // CORSヘッダーを設定
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // OPTIONSリクエストの処理
    if (request.method === 'OPTIONS') {
      return {
        status: 200,
        headers,
        body: ''
      };
    }

    // 計算パラメータはシステム全体で共有されるため、固定パスを使用
    const userId = "system";
    const groupId = "global";

    // Azure Storage接続文字列を取得
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 
                            process.env.AzureWebJobsStorage ||
                            process.env.STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
      context.error('Azure Storage接続文字列が設定されていません');
      return {
        status: 500,
        headers,
        body: JSON.stringify({
          error: 'ストレージ設定エラー: 接続文字列が設定されていません'
        })
      };
    }

    // BlobServiceClientを作成
    let blobServiceClient: BlobServiceClient;
    
    try {
      if (connectionString === "UseDevelopmentStorage=true") {
        const azuriteConnectionString = "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";

        blobServiceClient = BlobServiceClient.fromConnectionString(azuriteConnectionString);
      } else {
        blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      }
    } catch (clientError) {
      context.error('BlobServiceClient作成エラー:', clientError);
      return {
        status: 500,
        headers,
        body: JSON.stringify({
          error: 'Azure Storage クライアントの作成に失敗しました',
          details: clientError instanceof Error ? clientError.message : 'Unknown error'
        })
      };
    }

    const containerName = 'calc-settings';
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // 接続テスト
    try {
      await blobServiceClient.getAccountInfo();
    } catch (connectionError) {
      context.error('Azure Storage接続エラー:', connectionError);
      return {
        status: 500,
        headers,
        body: JSON.stringify({
          error: 'Azure Storageへの接続に失敗しました',
          details: connectionError instanceof Error ? connectionError.message : 'Unknown error'
        })
      };
    }

    // コンテナが存在しない場合は作成
    try {
      await containerClient.createIfNotExists();
      context.log(`コンテナ '${containerName}' の確認/作成完了`);
    } catch (containerError) {
      context.error('コンテナ作成エラー:', containerError);
      return {
        status: 500,
        headers,
        body: JSON.stringify({
          error: 'ストレージコンテナの作成に失敗しました',
          details: containerError instanceof Error ? containerError.message : 'Unknown error'
        })
      };
    }

    // 計算パラメータファイル名を生成
    const settingsFileName = 'settings.json';
    const blockBlobClient = containerClient.getBlockBlobClient(settingsFileName);

    // 設定ファイルの存在確認
    try {
      const exists = await blockBlobClient.exists();
      if (!exists) {
        // ファイルが存在しない場合はデフォルト計算パラメータを返す
        const defaultSettings: CalculationSettings = {
          extinguishingCorrections: {
            water: 1.1,
            oxygen: 1
          },
          volumeToWeightFactors: {
            bamboo: 0.13,
            pruning: 0.12,
            herbaceous: 0.07,
            other: 0.12
          },
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

        return {
          status: 200,
          headers,
          body: JSON.stringify({
            success: true,
            settings: defaultSettings,
            isDefault: true,
            message: 'デフォルト設定を返しました'
          })
        };
      }

      // 設定ファイルをダウンロード
      const downloadResponse = await blockBlobClient.download();
      const settingsData = await streamToString(downloadResponse.readableStreamBody!);
      const settings = JSON.parse(settingsData);

      // lastUpdatedフィールドを除外して返す
      const { lastUpdated, ...settingsWithoutTimestamp } = settings;

      return {
        status: 200,
        headers,
        body: JSON.stringify({
          success: true,
          settings: settingsWithoutTimestamp,
          isDefault: false,
          lastUpdated: lastUpdated,
          message: '設定を正常に取得しました'
        })
      };

    } catch (downloadError) {
      context.error('設定ファイル取得エラー:', downloadError);
      
      // ファイル取得に失敗した場合はデフォルト計算パラメータを返す
      const defaultSettings: CalculationSettings = {
        extinguishingCorrections: {
          water: 1.1,
          oxygen: 1
        },
        volumeToWeightFactors: {
          bamboo: 0.13,
          pruning: 0.12,
          herbaceous: 0.07,
          other: 0.12
        },
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

      return {
        status: 200,
        headers,
        body: JSON.stringify({
          success: true,
          settings: defaultSettings,
          isDefault: true,
          message: '設定ファイルの取得に失敗したため、デフォルト設定を返しました'
        })
      };
    }

  } catch (error) {
    context.error('設定取得エラー:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: '設定の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

// ストリームを文字列に変換するヘルパー関数
async function streamToString(readableStream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    readableStream.on('error', reject);
  });
}

app.http('GetCalcSettings', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'get-calc-settings',
  handler: GetCalcSettings
});

export { GetCalcSettings };
