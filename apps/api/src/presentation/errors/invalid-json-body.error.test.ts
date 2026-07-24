import { describe, expect, it } from "vitest";
import { InvalidJsonBodyError } from "./invalid-json-body.error";

describe("InvalidJsonBodyError", () => {
  it("固定の message と name を持ち、Error のサブクラスである", () => {
    const error = new InvalidJsonBodyError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(InvalidJsonBodyError);
    expect(error.message).toBe("Invalid JSON in request body");
    expect(error.name).toBe("InvalidJsonBodyError");
  });

  it("cause を渡さない場合は cause が undefined になる", () => {
    const error = new InvalidJsonBodyError();

    expect(error.cause).toBeUndefined();
  });

  it("cause を渡した場合は元の原因を保持する", () => {
    const cause = new SyntaxError("Unexpected end of JSON input");
    const error = new InvalidJsonBodyError(cause);

    expect(error.cause).toBe(cause);
  });
});
