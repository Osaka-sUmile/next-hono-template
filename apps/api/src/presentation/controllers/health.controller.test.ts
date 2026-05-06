import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";
import { mockRequest, mockResponse } from "../../test-utils";

describe("HealthController", () => {
  it("returns ok status", () => {
    const controller = new HealthController();
    const req = mockRequest();
    const res = mockResponse();

    controller.check(req, res);

    expect(res.json).toHaveBeenCalledWith({ status: "ok" });
  });
});
