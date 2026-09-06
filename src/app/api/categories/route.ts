import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedContext } from '@/lib/api-handler';
import { saveCategoriesSchema } from '@/schemas/category.schema';
import { listCategories, saveCategories } from '@/services/category.service';

// ─── Contrato: GET /api/categories ────────────────────────────────────────────
// Auth:     Bearer JWT obrigatório
// Response: 200 { categories: Record<string, string[]> }
// Erros:    401
//
// ─── Contrato: PUT /api/categories ────────────────────────────────────────────
// Auth:     Bearer JWT obrigatório
// Body:     Record<string, string[]> (Ex: { "Alimentação": ["Mercado", "Restaurante"] })
// Response: 200 { categories: Record<string, string[]> }
// Erros:    400 (Zod), 401, 500

export const GET = withAuth(async (_req: NextRequest, ctx: AuthenticatedContext) => {
  const categories = await listCategories(ctx.userId);
  return NextResponse.json({ categories }, { status: 200 });
});

export const PUT = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await req.json();
  const input = saveCategoriesSchema.parse(body);
  const categories = await saveCategories(ctx.userId, input);
  return NextResponse.json({ categories }, { status: 200 });
});
