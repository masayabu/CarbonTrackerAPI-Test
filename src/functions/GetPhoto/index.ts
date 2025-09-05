import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

async function GetPhoto(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // CORSヘッダーを設定
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    // URLパラメータからファイル名を取得
    const url = new URL(request.url);
    const fileName = url.searchParams.get('fileName');

    if (!fileName) {
      return {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'fileNameパラメータが必要です'
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
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'ストレージ設定エラー: 接続文字列が設定されていません'
        })
      };
    }

    // BlobServiceClientを作成
    let blobServiceClient: BlobServiceClient;
    
    try {
      // ローカル開発環境の場合のAzurite接続を改善
      if (connectionString === "UseDevelopmentStorage=true") {
        // Azurite用の明示的な接続文字列を使用
        const azuriteConnectionString = "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";

        blobServiceClient = BlobServiceClient.fromConnectionString(azuriteConnectionString);
        context.log('Azurite用接続文字列を使用');
      } else {
        blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      }
    } catch (clientError) {
      context.error('BlobServiceClient作成エラー:', clientError);
      return {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Azure Storage クライアントの作成に失敗しました'
        })
      };
    }

    const containerName = 'photos';
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    // Blobが存在するかチェック
    try {
      const exists = await blockBlobClient.exists();
      if (!exists) {
        return {
          status: 404,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            error: '指定された写真が見つかりません'
          })
        };
      }
    } catch (checkError) {
      context.error('Blob存在チェックエラー:', checkError);
      return {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: '写真の存在確認に失敗しました'
        })
      };
    }

    // Blobのプロパティを取得してContent-Typeを決定
    let contentType = 'image/jpeg'; // デフォルト
    try {
      const properties = await blockBlobClient.getProperties();
      contentType = properties.contentType || 'image/jpeg';
    } catch (propertiesError) {
      context.log('プロパティ取得エラー、デフォルトContent-Typeを使用:', propertiesError);
    }

    // Blobをダウンロード
    try {
      const downloadResponse = await blockBlobClient.download();
      const chunks: Uint8Array[] = [];
      
      for await (const chunk of downloadResponse.readableStreamBody!) {
        if (typeof chunk === 'string') {
          chunks.push(new TextEncoder().encode(chunk));
        } else if (Buffer.isBuffer(chunk)) {
          chunks.push(new Uint8Array(chunk));
        } else {
          chunks.push(chunk);
        }
      }
      
      const buffer = Buffer.concat(chunks);

      context.log(`写真を取得しました: ${fileName}, サイズ: ${buffer.length} bytes`);

      return {
        status: 200,
        headers: {
          ...headers,
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=3600' // 1時間キャッシュ
        },
        body: buffer
      };

    } catch (downloadError) {
      context.error('Blobダウンロードエラー:', downloadError);
      return {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: '写真のダウンロードに失敗しました'
        })
      };
    }

  } catch (error) {
    context.error('写真取得エラー:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: '写真の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

app.http('GetPhoto', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'get-photo',
  handler: GetPhoto
});

export { GetPhoto };
