import { IRepository } from "./base.repository";
import { UserEntity } from "../models/user.entity";

export type IUserRepository = IRepository<UserEntity, string>;
