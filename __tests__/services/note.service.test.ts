/**
 * note.service.test.ts
 *
 * Testes de integração do NoteService.
 */

import * as orchestrator from '../utils/orchestrator';
import {
  listNotes,
  createNote,
  deleteNote,
} from '../../src/services/note.service';
import { NotFoundError } from '../../src/lib/errors';

let user1: orchestrator.TestUser;
let user2: orchestrator.TestUser;

beforeAll(async () => {
  user1 = await orchestrator.setupUser('user1');
  user2 = await orchestrator.setupUser('user2');
}, 30000);

afterAll(async () => {
  await orchestrator.clearUserData(user1?.userId);
  await orchestrator.clearUserData(user2?.userId);
  await orchestrator.teardownAuth();
}, 30000);

beforeEach(async () => {
  await orchestrator.clearUserData(user1.userId);
  await orchestrator.clearUserData(user2.userId);
});


describe('NoteService - listNotes', () => {
  it('deve retornar apenas as notas do userId autenticado', async () => {
    await orchestrator.createNote(user1.userId, { title: 'Nota User1' });
    await orchestrator.createNote(user2.userId, { title: 'Nota User2' });

    const notes = await listNotes(user1.userId);
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('Nota User1');
  });
});

describe('NoteService - createNote', () => {
  it('deve criar uma nota com título e descrição', async () => {
    const note = await createNote(user1.userId, {
      title: 'Regra Ifood',
      description: 'Tudo do Ifood é alimentação',
    });

    expect(note.id).toBeDefined();
    expect(note.title).toBe('Regra Ifood');
    expect(note.description).toBe('Tudo do Ifood é alimentação');
  });

  it('deve criar uma nota sem descrição (opcional)', async () => {
    const note = await createNote(user1.userId, { title: 'Sem Descrição' });
    expect(note.description).toBeNull();
  });
});

describe('NoteService - deleteNote', () => {
  it('deve deletar uma nota do próprio usuário', async () => {
    const note = await orchestrator.createNote(user1.userId, { title: 'Para deletar' });
    await deleteNote(user1.userId, note.id);

    const remaining = await listNotes(user1.userId);
    expect(remaining.find(n => n.id === note.id)).toBeUndefined();
  });

  it('deve lançar NotFoundError ao tentar deletar nota de outro usuário', async () => {
    const theirNote = await orchestrator.createNote(user2.userId);
    await expect(deleteNote(user1.userId, theirNote.id)).rejects.toThrow(NotFoundError);
  });

  it('deve lançar NotFoundError ao tentar deletar nota inexistente', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await expect(deleteNote(user1.userId, fakeId)).rejects.toThrow(NotFoundError);
  });
});
