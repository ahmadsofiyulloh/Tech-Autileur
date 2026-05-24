# Share Caption Generation Diagnosis

**Date:** 2026-05-23  
**Issue:** Caption dari Gemini tidak muncul di UI setelah generation selesai  
**Status:** RESOLVED — Migration applied 2026-05-23

---

## Phase 1: Root Cause Investigation

### 1. Data Flow Trace

Saya telah melacak alur data lengkap dari form submission hingga UI display:

```
User submits form
  ↓
actions.ts:generateShareCaption() [Server Action]
  ↓
share-generations.ts:createShareGeneration()
  - Insert record dengan status="generating", output_json=null
  - Create AI task
  - Fire background worker: share-caption-task.ts:runRealShareCaptionTask()
  - Return generation record
  - revalidatePath("/share")
  ↓
Redirect ke /share/[platform]?detail=X&tab=output
  ↓
page.tsx loads
  - getLatestShareGeneration() → fetch generation record
  ↓
ShareOutputTab receives generation prop
  ↓
If status="generating" → ShareGeneratingState
  - Poll /api/share/generation-status?id=X setiap 3 detik
  - Endpoint returns: { status, error_message, output_json }
  ↓
When status="generated" → router.refresh()
  ↓
page.tsx re-renders dengan updated generation
  ↓
ShareOutputTab displays variants from generation.output_json
```

### 2. Background Worker Analysis

**File:** `src/lib/server/share-caption-task.ts`

**Key findings:**

1. **Worker menggunakan `serviceClient` (service role)** untuk semua database operations:
   ```typescript
   const serviceClient = createSupabaseServiceRoleClient();
   ```

2. **Update flow yang BENAR:**
   ```typescript
   // Line 205-212: SUCCESS path
   await serviceClient
     .from("share_generations")
     .update({
       output_json: parsed.variants,  // ✅ Data di-update
       status: "generated",
     })
     .eq("id", taskInput.generationId)
     .eq("user_id", userId);
   ```

3. **Prompt construction:**
   ```typescript
   // Line 43-78: buildShareCaptionPrompt()
   // ✅ Prompt structure looks correct
   // ✅ Uses platformCopyHints and angleHooks
   // ✅ Requests JSON with variants array
   ```

4. **Response parsing:**
   ```typescript
   // Line 194-203
   let parsed: ShareCaptionResponse;
   try {
     parsed = JSON.parse(response.text) as ShareCaptionResponse;
   } catch {
     throw new Error("Gemini response was not valid JSON.");
   }

   if (!parsed.variants || !Array.isArray(parsed.variants) || 
       parsed.variants.length !== taskInput.variantCount) {
     throw new Error(`Expected ${taskInput.variantCount} variants, got ${parsed.variants?.length ?? 0}.`);
   }
   ```

### 3. Schema Validation

**File:** `src/lib/gemini/json-schemas.ts`

**Schema definition (line 676-687):**
```typescript
export const GEMINI_SHARE_CAPTION_RESPONSE_SCHEMA = {
  type: "object",
  required: ["variants"],
  properties: {
    variants: {
      type: "array",
      items: shareCaptionVariantSchema,
      description: "Array of caption variants matching requested variant_count.",
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;
```

**Variant schema (line 652-674):**
```typescript
const shareCaptionVariantSchema = {
  type: "object",
  required: ["caption", "angle", "platform"],
  properties: {
    caption: {
      type: "string",
      description: "Indonesian social media caption grounded in product facts and affiliate URL.",
    },
    angle: {
      type: "string",
      enum: ["benefit_focused", "problem_solution", "social_proof", "urgency_scarcity", "educational", "storytelling"],
    },
    platform: {
      type: "string",
      enum: ["facebook", "threads", "x", "pinterest"],
    },
    platform_specific_fields: {
      type: "object",
      additionalProperties: true,
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;
```

✅ **Schema is correct and matches expected output structure.**

### 4. Polling Endpoint Analysis

**File:** `src/app/api/share/generation-status/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("share_generations")
    .select("status, error_message, output_json")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    status: data.status,
    error_message: data.error_message,
    output_json: data.output_json,
  });
}
```

✅ **Polling endpoint correctly fetches and returns output_json.**

### 5. UI Display Logic

**File:** `src/app/share/[platform]/share-output-tab.tsx`

```typescript
export function ShareOutputTab({ generation, productId, affiliateUrl }: ShareOutputTabProps) {
  const variants = generation.output_json ?? [];

  if (generation.status === "generating") {
    return (
      <ShareGeneratingState
        generationId={generation.id}
        onResolved={(result) => {
          if (result.status === "generated" || result.status === "error") {
            router.refresh();  // ✅ Triggers page re-render
          }
        }}
      />
    );
  }

  if (generation.status === "error") {
    return <ShareErrorState ... />;
  }

  if (!variants.length) {
    return <p className="helper-text">Belum ada caption yang di-generate.</p>;
  }

  return (
    <div className="share-output-tab">
      <ul className="share-output-list">
        {variants.map((variant, index) => (
          <li key={`${generation.id}-${index}`} className="share-output-item">
            <div className="share-output-item__caption">{variant.caption}</div>
            ...
          </li>
        ))}
      </ul>
    </div>
  );
}
```

✅ **UI logic correctly displays variants when available.**

---

## Phase 2: Pattern Analysis - Comparison with Working Metadata Generation

### Working Pattern: Metadata Generation

**File:** `src/lib/server/intake-vision-task.ts` (similar background worker pattern)

**Key similarities:**
1. ✅ Uses `serviceClient` for all DB operations
2. ✅ Fire-and-forget pattern with `void import().then()`
3. ✅ Updates record with `output_json` on success
4. ✅ Uses `generateTrackedGeminiJsonText()` for API call
5. ✅ Parses JSON response and validates structure

**Key differences:**
- Metadata generation has been tested and verified working
- Share caption is new and untested in production

---

## Phase 3: Root Cause Confirmed

### ✅ ACTUAL ROOT CAUSE: Missing Database Enum Value

**Confirmed via database inspection on 2026-05-23:**

The `SHARE_CAPTION` value exists in the TypeScript enum (`src/lib/ai-tasks/validation.ts:19`) but was **missing from the PostgreSQL `ai_task_type` enum**.

**Database enum values (before fix):**
```
{VISION_ANALYSIS, I2I_PROMPT, I2V_PROMPT, CONSISTENCY_CHECK, PROMPT_REPAIR, FALLBACK, PROMPT_PACK_GENERATION}
```

**Failure chain:**
1. User submits share form → `generateShareCaption` action runs
2. `createShareGeneration()` inserts `share_generations` row with `status="generating"` ✅
3. `createAITask({ taskType: "SHARE_CAPTION" })` is called
4. PostgreSQL rejects insert: `invalid input value for enum ai_task_type: "SHARE_CAPTION"` ❌
5. Error propagates up, but `share_generations` row is already created and orphaned
6. Background worker (`runRealShareCaptionTask`) is never invoked
7. UI polls forever, status stays "generating", caption never appears

**Evidence:**
- 2 orphaned `share_generations` rows stuck in "generating" status (created 2026-05-23 16:07 and 16:10)
- 0 `ai_tasks` rows with `task_type = 'SHARE_CAPTION'` — confirms worker never ran
- 3 active FALLBACK Gemini keys available — not a key availability issue
- Database query `SELECT enum_range(NULL::ai_task_type)` confirmed missing value

### ❌ REJECTED Hypotheses:

1. **"Worker tidak update database"** — Code structure was correct
2. **"Schema tidak match"** — JSON schema was correct
3. **"Polling tidak fetch output_json"** — Polling endpoint was correct
4. **"UI tidak render variants"** — UI logic was correct
5. **"Gemini API call failing"** — Worker never ran, so API was never called
6. **"Gemini key routing issue"** — Keys were available, but worker never reached that code

---

## Phase 4: Resolution Applied

### Fix Applied (2026-05-23 18:00 UTC)

**Migration created and applied:**
```sql
-- supabase/migrations/20260523180000_add_share_caption_enum_value.sql
ALTER TYPE ai_task_type ADD VALUE 'SHARE_CAPTION';
```

**Database cleanup:**
```sql
-- Reset 2 orphaned rows to error state with descriptive message
UPDATE share_generations 
SET status = 'error', 
    error_message = 'Generation failed: SHARE_CAPTION task type was missing from database enum. Enum has been fixed - please retry.'
WHERE id IN ('a5cb30f9-7878-44fd-8916-dd728a3eca82', 'a0ec5bd0-8c75-4df6-bceb-e0b4fda4fd85');
```

**Verification:**
```sql
SELECT enum_range(NULL::ai_task_type);
-- Result: {VISION_ANALYSIS,I2I_PROMPT,I2V_PROMPT,CONSISTENCY_CHECK,PROMPT_REPAIR,FALLBACK,PROMPT_PACK_GENERATION,SHARE_CAPTION}
```

### Status

✅ **RESOLVED** — Share caption generation should now work correctly. Users can retry the 2 failed generations from the UI.
