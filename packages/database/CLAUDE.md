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

## テスト方針（この層は「結合テストが標準、単体テストは例外」）
この層の責務は「Prisma を正しく使うこと」そのものであるため、一般的なテストピラミッド（単体を厚く）は適用しない。

- **標準: 実 DB への結合テスト**。repository / query-service の実装と同じ階層に `*.test.ts` を co-located で置き、実 DB（docker の Postgres + wsproxy、`createPrismaClient(url, { localProxy: true })` 経由）に対して実行する。最低限カバーすべきケースは責務ごとに異なる:
  - **repository（書き込み）**: 「往復（save → findById で復元一致）」「null 系」「制約違反系」。
  - **query-service（読み取り専用）**: 「期待する DTO の形と値」「空結果 / null 系」「条件分岐・境界値」。query-service は書き込みを持たないため `save` からの往復は要求しない（前提データはテストの事前投入 or truncate ヘルパーで用意する）。
- **禁止: PrismaClient のモックによる単体テスト**。「`upsert` がこの引数で呼ばれた」という assertion は実装の写経であり、この層で実際に起きるバグ（where 句の誤り・スキーマとコードのドリフト・制約違反・select 漏れ）を検出できない。原則書かないこと。
- **例外: 変換ロジックが複雑化した場合のみ単体テストを書く**。JSON カラムの解釈や集計 DTO の組み立てなど、純粋な変換が数行を超えて育ったら、mapper を export された純関数（`mappers/` 配下）に切り出し、そこだけ DB なしの単体テストを書く。「複雑さが生まれたら純粋関数に押し出す」がルール。private メソッド内の複雑な変換ロジックを結合テストだけで済ませてはならない。
- **テスト間の独立性**: `src/test-utils/` の truncate ヘルパー等で担保する。テストの実行順序に依存するテストを書かないこと。
