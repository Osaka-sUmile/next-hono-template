import { z } from "zod";
import { Response } from "express";
import { GetCurrentUserUseCase } from "../../application";
import { logger } from "../../infrastructure";
import { AuthenticatedRequest } from "../middleware/require-auth.middleware";
import { ErrorCodes } from "../error-codes";

const getUserMeRequestSchema = z.object({
  auth: z.object({
    user: z.object({
      id: z.string().min(1),
    }),
  }),
});

export class UserController {
  constructor(private readonly getCurrentUserUseCase: GetCurrentUserUseCase) {}

  getUserMe = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const dto = getUserMeRequestSchema.parse({ auth: req.auth });
      const user = await this.getCurrentUserUseCase.execute({ userId: dto.auth.user.id });
      if (!user) {
        logger.error({ userId: dto.auth.user.id }, "[UserController] user not found despite valid session — data inconsistency");
        res.status(404).json({ error: "User not found", code: ErrorCodes.USER_NOT_FOUND });
        return;
      }
      res.json(user);
    } catch (err) {
      logger.error({ err }, "[UserController] getUserMe failed");
      res.status(500).json({ error: "Internal Server Error", code: ErrorCodes.INTERNAL_ERROR });
    }
  };
}
