import { prisma } from '@/lib/prisma';
import type { SaveCategoriesInput } from '@/schemas/category.schema';

// Tipo de retorno público
export type CategoriesDTO = Record<string, string[]>;

/**
 * Lista todas as categorias customizadas do usuário autenticado.
 * SEGURANÇA: sempre escopado por userId.
 */
export async function listCategories(userId: string): Promise<CategoriesDTO> {
  const rows = await prisma.custom_categories.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'asc' },
  });

  const categories: CategoriesDTO = {};
  for (const row of rows) {
    const subcats = row.subcategories;
    // Garante que o Json? do Prisma seja lido como string[]
    categories[row.category_name] = Array.isArray(subcats)
      ? (subcats as string[])
      : [];
  }

  return categories;
}

/**
 * Salva as categorias customizadas do usuário autenticado.
 * Substitui todas as categorias existentes pelas novas.
 * Utiliza transação para garantir atomicidade (exclusão e inserção juntas).
 * SEGURANÇA: user_id vem exclusivamente do contexto de auth.
 */
export async function saveCategories(
  userId: string,
  input: SaveCategoriesInput
): Promise<CategoriesDTO> {
  const toInsert = Object.entries(input).map(([categoryName, subcategories]) => ({
    user_id: userId,
    category_name: categoryName,
    subcategories: subcategories,
  }));

  await prisma.$transaction(async (tx) => {
    // Remove todas as categorias antigas do usuário
    await tx.custom_categories.deleteMany({
      where: { user_id: userId },
    });

    // Insere as novas categorias (se houver)
    if (toInsert.length > 0) {
      await tx.custom_categories.createMany({
        data: toInsert,
      });
    }
  });

  // Retorna o que foi salvo
  return input;
}
