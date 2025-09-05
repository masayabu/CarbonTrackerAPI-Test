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

async function SaveCalcSettings(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // CORSヘッダーを設定
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    // リクエストボディを取得
    const settings = await request.json() as Partial<CalculationSettings>;

    // バリデーション
    if (!settings) {
      return {
        status: 400,
        headers,
        body: JSON.stringify({
          error: '計算パラメータが必要です'
        })
      };
    }

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

    // 既存の設定を取得（存在する場合）
    let existingSettings = {};
    try {
      const downloadResponse = await blockBlobClient.download();
      const existingData = await streamToString(downloadResponse.readableStreamBody!);
      existingSettings = JSON.parse(existingData);
    } catch (error) {
      // ファイルが存在しない場合は空のオブジェクトを使用
      context.log('既存の設定ファイルが見つかりません。新規作成します。');
    }

    // 既存の設定と新しい設定をマージ
    const mergedSettings = {
      ...existingSettings,
      ...settings,
      lastUpdated: new Date().toISOString()
    };

    // 設定をJSONとして保存
    const settingsJson = JSON.stringify(mergedSettings, null, 2);
    const buffer = Buffer.from(settingsJson, 'utf-8');

    context.log(`設定保存開始: ${settingsFileName}`);

    // Blobにアップロード
    try {
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: 'application/json',
        }
      });
    } catch (uploadError) {
      context.error('設定アップロードエラー:', uploadError);
      return {
        status: 500,
        headers,
        body: JSON.stringify({
          error: '設定の保存に失敗しました',
          details: uploadError instanceof Error ? uploadError.message : 'Unknown error'
        })
      };
    }

    context.log(`設定が保存されました: ${settingsFileName}`);

    return {
      status: 200,
      headers,
      body: JSON.stringify({
        success: true,
        settings: mergedSettings,
        message: '設定が正常に保存されました'
      })
    };

  } catch (error) {
    context.error('設定保存エラー:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: '設定の保存に失敗しました',
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

app.http('SaveCalcSettings', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'save-calc-settings',
  handler: SaveCalcSettings
});

export { SaveCalcSettings };
