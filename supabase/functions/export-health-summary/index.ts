import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

import { corsHeaders, errorResponse, HttpError, jsonResponse } from '../_shared/http.ts';

type SupabaseClient = ReturnType<typeof createClient>;

type AppUser = {
  id: string;
  authUserId: string | null;
  email: string | null;
  name: string;
  dob: string | null;
  sex: string | null;
  bloodGroup: string | null;
};

type ReadingRow = {
  parameterId: string;
  value: number | string;
  unit: string;
  recordedAt: string;
  rangeFlag: string;
  status: string;
};

type CatalogRow = {
  id: string;
  canonicalName: string;
  unit: string;
};

const EXPORT_BUCKET = Deno.env.get('EXPORT_BUCKET') ?? 'exports';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

function getAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(500, 'Supabase service configuration is missing');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(req: Request): string {
  const auth = req.headers.get('Authorization');
  const match = auth?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new HttpError(401, 'Missing bearer token');
  return match[1];
}

async function getAuthenticatedAppUser(
  admin: SupabaseClient,
  req: Request,
): Promise<{ appUser: AppUser; authUserId: string }> {
  const token = bearerToken(req);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid bearer token');

  const authUserId = data.user.id;
  const email = data.user.email ?? null;

  let result = await admin
    .from('User')
    .select('id, authUserId, email, name, dob, sex, bloodGroup')
    .eq('authUserId', authUserId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (result.data) return { appUser: result.data as AppUser, authUserId };

  result = await admin
    .from('User')
    .select('id, authUserId, email, name, dob, sex, bloodGroup')
    .eq('id', authUserId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (result.data) return { appUser: result.data as AppUser, authUserId };

  if (email) {
    result = await admin
      .from('User')
      .select('id, authUserId, email, name, dob, sex, bloodGroup')
      .eq('email', email)
      .maybeSingle();
    if (result.error) throw result.error;
    if (result.data) {
      const appUser = result.data as AppUser;
      if (!appUser.authUserId) {
        await admin.from('User').update({ authUserId }).eq('id', appUser.id);
      }
      return { appUser: { ...appUser, authUserId }, authUserId };
    }
  }

  throw new HttpError(404, 'HealthFolio profile not found for authenticated user');
}

async function assertProfileAccess(
  admin: SupabaseClient,
  requesterId: string,
  targetId: string,
): Promise<void> {
  if (requesterId === targetId) return;

  const { data, error } = await admin
    .from('FamilyLink')
    .select('id')
    .eq('ownerUserId', targetId)
    .eq('memberUserId', requesterId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(403, 'No access to this profile');
}

function ageYears(dob: string | null): string {
  if (!dob) return 'Unknown';
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return String(Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
}

function formatDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

async function buildPdf(user: AppUser, readings: ReadingRow[], catalog: CatalogRow[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 48;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  const draw = (
    text: string,
    opts: { x?: number; size?: number; font?: typeof regular; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const size = opts.size ?? 10;
    page.drawText(text.slice(0, 120), {
      x: opts.x ?? margin,
      y,
      size,
      font: opts.font ?? regular,
      color: opts.color ?? rgb(0.08, 0.1, 0.15),
    });
    y -= size + 8;
  };

  const ensureSpace = (needed = 64) => {
    if (y > margin + needed) return;
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
  };

  draw('HealthFolio Health Summary', { size: 19, font: bold, color: rgb(0.06, 0.36, 0.4) });
  draw(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, {
    size: 9,
    color: rgb(0.36, 0.43, 0.5),
  });
  y -= 10;

  draw('Patient', { size: 13, font: bold, color: rgb(0.06, 0.36, 0.4) });
  draw(`Name: ${user.name || 'Unnamed profile'}`);
  draw(`Age: ${ageYears(user.dob)}   Sex: ${user.sex ?? 'unknown'}${user.bloodGroup ? `   Blood group: ${user.bloodGroup}` : ''}`);
  y -= 10;

  const confirmed = readings.filter((reading) => reading.status === 'confirmed');
  if (confirmed.length === 0) {
    draw('No confirmed readings recorded.', { color: rgb(0.36, 0.43, 0.5) });
  } else {
    draw('Confirmed readings', { size: 13, font: bold, color: rgb(0.06, 0.36, 0.4) });
    y -= 4;
    for (const reading of confirmed) {
      ensureSpace();
      const entry = catalogById.get(reading.parameterId);
      const name = entry?.canonicalName ?? reading.parameterId;
      const unit = reading.unit || entry?.unit || '';
      draw(name, { size: 11, font: bold });
      draw(
        `${formatDate(reading.recordedAt)}   ${Number(reading.value)} ${unit}   ${reading.rangeFlag}`,
        { size: 10, color: rgb(0.18, 0.22, 0.28) },
      );
      y -= 4;
    }
  }

  y = Math.max(y, margin + 40);
  draw('This export organizes user-provided records and is not medical advice.', {
    size: 8,
    color: rgb(0.45, 0.49, 0.56),
  });

  return pdf.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const admin = getAdminClient();
    const { appUser, authUserId } = await getAuthenticatedAppUser(admin, req);
    const body = (await req.json().catch(() => ({}))) as { profileId?: string };
    const targetId = body.profileId ?? appUser.id;
    await assertProfileAccess(admin, appUser.id, targetId);

    const { data: targetUser, error: userError } = await admin
      .from('User')
      .select('id, authUserId, email, name, dob, sex, bloodGroup')
      .eq('id', targetId)
      .maybeSingle();
    if (userError) throw userError;
    if (!targetUser) throw new HttpError(404, 'Profile not found');

    const [{ data: readings, error: readingsError }, { data: catalog, error: catalogError }] =
      await Promise.all([
        admin
          .from('ParameterReading')
          .select('parameterId, value, unit, recordedAt, rangeFlag, status')
          .eq('userId', targetId)
          .order('parameterId', { ascending: true })
          .order('recordedAt', { ascending: false }),
        admin.from('ParameterCatalog').select('id, canonicalName, unit'),
      ]);
    if (readingsError) throw readingsError;
    if (catalogError) throw catalogError;

    const pdfBytes = await buildPdf(
      targetUser as AppUser,
      (readings ?? []) as ReadingRow[],
      (catalog ?? []) as CatalogRow[],
    );
    const fileName = `health-summary-${Date.now()}.pdf`;
    const path = `${authUserId}/exports/${fileName}`;
    const { error: uploadError } = await admin.storage
      .from(EXPORT_BUCKET)
      .upload(path, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const expiresIn = 60 * 10;
    const { data: signed, error: signedError } = await admin.storage
      .from(EXPORT_BUCKET)
      .createSignedUrl(path, expiresIn);
    if (signedError || !signed?.signedUrl) {
      throw signedError ?? new Error('Could not create signed export URL');
    }

    return jsonResponse({
      downloadUrl: signed.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
});
