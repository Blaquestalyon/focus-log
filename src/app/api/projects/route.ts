import { z } from 'zod';
import { authed, body, json, dbFail, HttpError } from '@/lib/server/http';
import { PROJECT_COLORS } from '@/lib/types';
import { listProjects } from './helpers';

export const dynamic = 'force-dynamic';

export const GET = authed(async ({ req, supabase }) => {
  const inc = req.nextUrl.searchParams.get('include_archived') === '1';
  return json(await listProjects(supabase, inc));
});

const Create = z.strictObject({
  name: z.string().trim().min(1, 'Give the project a name.').max(60, 'Keep project names under 60 characters.'),
  color: z.enum(PROJECT_COLORS).default('azure'),
});

export const POST = authed(async ({ req, supabase }) => {
  const b = await body(req, Create);
  const { data, error } = await supabase.from('projects').insert({ name: b.name, color: b.color }).select('id').single();
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'DUPLICATE_NAME', `You already have a project called "${b.name}".`, 'name');
    dbFail(error, 'projects.insert');
  }
  const [item] = await listProjects(supabase, true, data.id);
  return json(item, 201);
});
