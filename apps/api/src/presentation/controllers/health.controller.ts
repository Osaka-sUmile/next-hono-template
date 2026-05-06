import { Request, Response } from "express";

export class HealthController {
  check = (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  };
}

