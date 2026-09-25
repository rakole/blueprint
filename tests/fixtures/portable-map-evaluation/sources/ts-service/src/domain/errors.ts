export class DomainError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "validation_error");
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} was not found`, "not_found");
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "conflict");
  }
}
