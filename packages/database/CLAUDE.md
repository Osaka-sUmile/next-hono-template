# データベース層の制約
- **責務**: データの永続化とドメインモデルへの変換のみ。ビジネスルールの実装はここで行わないこと。
- **変換ルール**: 
  - **Command (書き込み)**: Prismaモデルをドメインエンティティへ変換して返すこと。
  - **Query (読み取り)**: 読み取り専用 DTO (UserQueryResult等) で返し、Entity 復元は不要。`docs/architecture.md` の「Query は Entity 復元必須ではない」に従うこと。
  - 変換ロジック（Mapper）はこのディレクトリ内に記述すること。
- **依存ルール**: `packages/domain` のインターフェースを直接 `implements` すること。実装例: `src/repositories/user.prisma-repository.ts`
- **エクスポート規則 (Barrel Pattern)**: 
  - `repositories/` や `query-services/` などの各ディレクトリ内に `index.ts` を配置し、ディレクトリ外へ公開するファイルを束ねること。
  - パッケージルートの `src/index.ts` は、個別のファイルを直接指定するのではなく、各ディレクトリ単位でまとめてエクスポートすること（例: `export * from "./repositories";`）。
