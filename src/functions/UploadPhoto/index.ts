import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";

interface UploadPhotoRequest {
  fileName: string;
  contentType: string;
  base64Data: string;
  userId: string;
  groupId: string;
}

async function UploadPhoto(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const body = await request.json() as UploadPhotoRequest;
    const { fileName, contentType, base64Data, userId, groupId } = body;

    // バリデーション
    if (!fileName || !contentType || !base64Data || !userId || !groupId) {
      return {
        status: 400,
        headers,
        body: JSON.stringify({
          error: '必要なパラメータが不足しています'
        })
      };
    }

    // Azure Storage接続文字列を取得（複数の環境変数を試行）
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 
                            process.env.AzureWebJobsStorage ||
                            process.env.STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
      context.error('Azure Storage接続文字列が設定されていません。以下の環境変数を確認してください: AZURE_STORAGE_CONNECTION_STRING, AzureWebJobsStorage, STORAGE_CONNECTION_STRING');
      return {
        status: 500,
        headers,
        body: JSON.stringify({
          error: 'ストレージ設定エラー: 接続文字列が設定されていません'
        })
      };
    }

    context.log(`接続文字列を使用: ${connectionString}`);

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
        headers,
        body: JSON.stringify({
          error: 'Azure Storage クライアントの作成に失敗しました',
          details: clientError instanceof Error ? clientError.message : 'Unknown error',
          suggestion: 'Azuriteが起動しているか確認してください (docker run -d -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite)'
        })
      };
    }
    const containerName = 'photos';
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // 接続テスト
    try {
      context.log('Azure Storage接続テスト中...');
      await blobServiceClient.getAccountInfo();
      context.log('Azure Storage接続成功');
    } catch (connectionError) {
      context.error('Azure Storage接続エラー:', connectionError);
      return {
        status: 500,
        headers,
        body: JSON.stringify({
          error: 'Azure Storageへの接続に失敗しました',
          details: connectionError instanceof Error ? connectionError.message : 'Unknown error',
          suggestion: 'Azure Storage Emulatorが起動しているか確認してください'
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

    // ファイル名を生成（重複を避けるためUUIDを使用）
    const fileExtension = fileName.split('.').pop() || 'jpg';
    const uniqueFileName = `${userId}/${groupId}/${uuidv4()}.${fileExtension}`;
    const blockBlobClient = containerClient.getBlockBlobClient(uniqueFileName);

    // Base64データをデコード
    const buffer = Buffer.from(base64Data, 'base64');

    context.log(`ファイルアップロード開始: ${uniqueFileName}, サイズ: ${buffer.length} bytes`);

    // Blobにアップロード
    try {
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: contentType,
        }
      });
    } catch (uploadError) {
      context.error('Blobアップロードエラー:', uploadError);
      return {
        status: 500,
        headers,
        body: JSON.stringify({
          error: 'ファイルのアップロードに失敗しました',
          details: uploadError instanceof Error ? uploadError.message : 'Unknown error'
        })
      };
    }

    // アップロードされたファイルのURLを取得
    const photoUrl = blockBlobClient.url;

    context.log(`写真がアップロードされました: ${photoUrl}`);

    return {
      status: 200,
      headers,
      body: JSON.stringify({
        success: true,
        photoUrl,
        fileName: uniqueFileName
      })
    };

  } catch (error) {
    context.error('写真アップロードエラー:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: '写真のアップロードに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

app.http('UploadPhoto', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'upload-photo',
  handler: UploadPhoto
});

export { UploadPhoto };
