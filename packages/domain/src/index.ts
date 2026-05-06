// Domain層の公開インターフェースやベースクラスを一元的にエクスポートします
// 個別ファイルへの参照は各ディレクトリの index.ts に集約する。

export * from "./models";
export * from "./repositories";
// 今後追加する value-objects/services/errors も同パターンで束ねる
// export * from "./value-objects";
