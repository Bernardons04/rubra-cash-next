import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, UnauthorizedError, InternalServerError } from './errors';
import { createAuthenticatedClient, extractBearerToken } from './supabaseClient';
import { Prisma } from '@prisma/client';

export type AuthenticatedContext = {
  userId: string;
};

// Tipo para a função handler real
// params já foi resolvido (await) pelo withAuth antes de repassar
export type RouteHandler<T = Record<string, string>> = (
  req: NextRequest,
  ctx: AuthenticatedContext,
  params?: T
) => Promise<NextResponse> | NextResponse;

/**
 * Wrapper para Route Handlers do Next.js.
 * Responsabilidades:
 * - Extrair e validar o Token JWT.
 * - Injetar o userId de forma segura (para contornar a falta do RLS do Prisma).
 * - Interceptar e padronizar todas as respostas de erro (Zod, Prisma, AppError, genéricos).
 */
export function withAuth<T = Record<string, string>>(handler: RouteHandler<T>) {
  // O segundo argumento do Next.js Route Handler em segmentos dinâmicos é
  // { params: Promise<T> } — precisamos await antes de repassar ao handler.
  return async (req: NextRequest, context: { params?: Promise<T> | T }) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        throw new UnauthorizedError('Token JWT não fornecido no cabeçalho Authorization.');
      }

      // Verificamos a autenticidade do token no próprio servidor do Supabase.
      // Passamos o token explicitamente — createAuthenticatedClient configura o header global,
      // mas getUser() sem argumento lê da sessão interna, não do header.
      const supabase = createAuthenticatedClient(token);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);


      if (authError || !user) {
        throw new UnauthorizedError('Token JWT inválido ou expirado.');
      }

      // Resolve params assíncronos (Next.js 16+) antes de repassar ao handler.
      const resolvedParams = context?.params instanceof Promise
        ? await context.params
        : context?.params;

      // Repassa para o Controller garantindo o ID autenticado.
      return await handler(req, { userId: user.id }, resolvedParams as T | undefined);

    } catch (error) {
      console.error('[API Error]:', error);

      // Erros de Validação Zod (v4: .issues substituiu .errors; path é PropertyKey[])
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Erro de validação',
            details: error.issues.map(issue => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
            }))
          },
          { status: 400 }
        );
      }

      // Nossos erros customizados (ex: AppError, UnauthorizedError)
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }

      // Erros do Prisma
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2025: Record not found
        if (error.code === 'P2025') {
          return NextResponse.json(
            { error: 'Recurso não encontrado no banco de dados.' },
            { status: 404 }
          );
        }
        // P2002: Unique constraint failed
        if (error.code === 'P2002') {
          return NextResponse.json(
            { error: 'Conflito de dados: o registro já existe.' },
            { status: 409 }
          );
        }
      }

      // Erro Genérico (fallback)
      return NextResponse.json(
        { error: 'Erro interno no servidor.' },
        { status: 500 }
      );
    }
  };
}
