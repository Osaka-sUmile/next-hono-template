import { DomainInvariantError } from "./domain-invariant.error"

export class InvalidArgumentError extends DomainInvariantError {
  constructor(message: string) {
    super(message)
  }
}
