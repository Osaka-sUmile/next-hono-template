import { Response } from "express";
import { GetCurrentUserUseCase } from "../../application";
import { AuthenticatedRequest } from "../middleware/require-auth.middleware";

export class UserController {
  constructor(private readonly getCurrentUserUseCase: GetCurrentUserUseCase) {}

  getUserMe = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await this.getCurrentUserUseCase.execute({ userId: req.auth.user.id });
      if (!user) {
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
      res.json(user);
    } catch (err) {
      console.error("[UserController] getUserMe failed:", err);
      res.status(500).json({ error: "Internal Server Error", code: "INTERNAL_ERROR" });
    }
  };
}
