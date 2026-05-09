// このディレクトリ配下の公開モジュールを束ねる (Barrel)。
// 上位層からは個別ファイルではなくこの index.ts 経由で参照すること。
export * from "./base.prisma-repository";
export * from "./user.prisma-repository";
