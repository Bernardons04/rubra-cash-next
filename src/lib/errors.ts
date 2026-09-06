export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Não autorizado.') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso negado.') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso não encontrado.') {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Erro de validação.') {
    super(message, 400);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Erro interno no servidor.') {
    super(message, 500);
  }
}
