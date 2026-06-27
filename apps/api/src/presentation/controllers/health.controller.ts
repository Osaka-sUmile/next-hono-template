import { Request, Response } from "express";

export class HealthController {
  check = (_req: Request, res: Response) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ status: "ok" });
  };
}

