import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { extractText, getDocumentProxy } from 'npm:unpdf@1.6.2';
import mammoth from 'npm:mammoth@1.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-File-Name, X-File-Type',
};

const EMBEDDING_MODEL = 'BAAI/bge-base-en-v1.5';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 250;
const MAX_RETRIEVAL = 8;
const MAX_WEB_RESULTS = 3;
const MAX_OUTPUT_TOKENS = 4500;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Firebase Authentication                                                    */
/* -------------------------------------------------------------------------- */

async function verifyFirebaseToken(idToken: string) {
  const apiKey = Deno.env.get('FIREBASE_WEB_API_KEY');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

  if (!apiKey || !projectId) {
    throw new Error(
      'Firebase backend configuration is missing. Set FIREBASE_WEB_API_KEY and FIREBASE_PROJECT_ID in Supabase secrets.',
    );
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken,
      }),
    },
  );

  if (!response.ok) {
    console.error(
      'Firebase token verification failed:',
      (await response.text()).slice(0, 500),
    );

    throw new Error('Unauthorized');
  }

  const payload = await response.json();
  const account = payload?.users?.[0];

  if (!account?.localId) {
    throw new Error('Unauthorized');
  }

  return {
    uid: String(account.localId),
    email: account.email ?? null,
    displayName: account.displayName ?? null,
    photoUrl: account.photoUrl ?? null,
  };
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';

  const token = authHeader
    .replace(/^Bearer\s+/i, '')
    .trim();

  if (!token) {
    throw new Error('Unauthorized');
  }

  return verifyFirebaseToken(token);
}

/* -------------------------------------------------------------------------- */
/* Embeddings                                                                 */
/* -------------------------------------------------------------------------- */

async function embedText(text: string): Promise<number[]> {
  const apiKey = Deno.env.get('HF_API_KEY');

  if (!apiKey) {
    throw new Error(
      'HF_API_KEY is not configured in Supabase secrets.',
    );
  }

  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${EMBEDDING_MODEL}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text.slice(0, 7000),
        options: {
          wait_for_model: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `Embedding service failed (${response.status}): ${detail.slice(0, 700)}`,
    );
  }

  const result = await response.json();

  let vector: number[] = [];

  if (
    Array.isArray(result) &&
    result.length > 0 &&
    Array.isArray(result[0])
  ) {
    /*
     * Some inference responses return token-level embeddings.
     * Mean-pool them into a single 768-dimensional vector.
     */
    const tokenVectors = result as number[][];

    const dimensions = tokenVectors[0].length;

    const pooled = new Array<number>(
      dimensions,
    ).fill(0);

    for (const tokenVector of tokenVectors) {
      for (let i = 0; i < dimensions; i++) {
        pooled[i] += Number(tokenVector[i] ?? 0);
      }
    }

    for (let i = 0; i < dimensions; i++) {
      pooled[i] /= tokenVectors.length;
    }

    vector = pooled;
  } else if (Array.isArray(result)) {
    vector = result.map(Number);
  } else if (Array.isArray(result?.embedding)) {
    vector = result.embedding.map(Number);
  }

  if (vector.length !== 768) {
    throw new Error(
      `Embedding model returned ${vector.length} dimensions; expected 768.`,
    );
  }

  /*
   * Normalize the vector for cosine similarity.
   */
  let magnitude = 0;

  for (const value of vector) {
    magnitude += value * value;
  }

  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    vector = vector.map(
      (value) => value / magnitude,
    );
  }

  return vector;
}

/* -------------------------------------------------------------------------- */
/* Chunking                                                                   */
/* -------------------------------------------------------------------------- */

function chunkText(text: string): string[] {
  const cleaned = text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim();

  if (!cleaned) {
    return [];
  }

  const chunks: string[] = [];

  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(
      start + CHUNK_SIZE,
      cleaned.length,
    );

    if (end < cleaned.length) {
      const candidates = [
        cleaned.lastIndexOf('\n\n', end),
        cleaned.lastIndexOf('. ', end),
        cleaned.lastIndexOf(' ', end),
      ];

      const boundary = Math.max(...candidates);

      if (
        boundary >
        start + CHUNK_SIZE * 0.6
      ) {
        end = boundary + 1;
      }
    }

    const chunk = cleaned
      .slice(start, end)
      .trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= cleaned.length) {
      break;
    }

    start = Math.max(
      end - CHUNK_OVERLAP,
      start + 1,
    );
  }

  return chunks;
}

/* -------------------------------------------------------------------------- */
/* Document extraction                                                        */
/* -------------------------------------------------------------------------- */

async function extractDocumentText(
  bytes: Uint8Array,
  fileType: string,
): Promise<string> {
  if (fileType === 'docx') {
    const result =
      await mammoth.extractRawText({
        arrayBuffer: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset +
            bytes.byteLength,
        ),
      });

    return result.value.trim();
  }

  if (fileType === 'pdf') {
    const pdf =
      await getDocumentProxy(bytes);

    const result =
      await extractText(pdf, {
        mergePages: true,
      });

    return result.text.trim();
  }

  throw new Error(
    'Only PDF and DOCX files are supported.',
  );
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface DocSource {
  id: string;
  filename: string;
  chunkIndex: number;
  similarity: number;
  content: string;
}

interface WebSource {
  id: string;
  title: string;
  url: string;
  content: string;
}

/* -------------------------------------------------------------------------- */
/* Client RAG                                                                 */
/* -------------------------------------------------------------------------- */

async function retrieveDocuments(
  serviceClient: any,
  userId: string,
  message: string,
): Promise<DocSource[]> {
  try {
    const queryEmbedding =
      await embedText(message);

    const {
      data,
      error,
    } = await serviceClient.rpc(
      'match_chunks',
      {
        query_embedding: queryEmbedding,
        match_count: MAX_RETRIEVAL,
      },
    );

    if (error) {
      console.warn(
        'Document retrieval failed:',
        error.message,
      );

      return [];
    }

    return (data ?? [])
      .filter(
        (row: any) =>
          Number(
            row.similarity ?? 0,
          ) >= 0.15,
      )
      .map(
        (
          row: any,
          index: number,
        ) => ({
          id: `D${index + 1}`,
          filename:
            row.filename ??
            'Client document',
          chunkIndex:
            Number(
              row.chunk_index ?? 0,
            ),
          similarity:
            Number(
              row.similarity ?? 0,
            ),
          content:
            row.content ?? '',
        }),
      );
  } catch (error) {
    console.warn(
      'Document retrieval error:',
      error,
    );

    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Tavily                                                                     */
/* -------------------------------------------------------------------------- */

async function searchWeb(
  message: string,
): Promise<WebSource[]> {
  const apiKey =
    Deno.env.get(
      'TAVILY_API_KEY',
    );

  if (!apiKey) {
    console.warn(
      'TAVILY_API_KEY is not configured.',
    );

    return [];
  }

  const response = await fetch(
    'https://api.tavily.com/search',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: message,
        search_depth: 'advanced',
        max_results:
          MAX_WEB_RESULTS,
        include_answer: false,
        include_raw_content:
          false,
      }),
    },
  );

  if (!response.ok) {
    console.warn(
      'Tavily search failed:',
      response.status,
      (
        await response.text()
      ).slice(0, 500),
    );

    return [];
  }

  const payload =
    await response.json();

  return (
    payload?.results ?? []
  )
    .map(
      (
        item: any,
        index: number,
      ) => ({
        id: `W${index + 1}`,
        title: String(
          item.title ??
            'Web source',
        ),
        url: String(
          item.url ?? '',
        ),
        content: String(
          item.content ?? '',
        ).slice(0, 2500),
      }),
    )
    .filter(
      (item: WebSource) =>
        item.url &&
        item.content,
    );
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

function buildContext(
  docSources: DocSource[],
  webSources: WebSource[],
) {
  const docs = docSources
    .map(
      (
        source,
        index,
      ) =>
        `[D${index + 1}]
Document: ${source.filename}
Chunk: ${source.chunkIndex + 1}
Similarity: ${source.similarity.toFixed(3)}

${source.content}`,
    )
    .join('\n\n');

  const web = webSources
    .map(
      (
        source,
        index,
      ) =>
        `[W${index + 1}]
Title: ${source.title}
URL: ${source.url}

${source.content}`,
    )
    .join('\n\n');

  const fullContext = [
    docs
      ? `CLIENT DOCUMENT EVIDENCE:\n\n${docs}`
      : `CLIENT DOCUMENT EVIDENCE:
[No matching client-document passages were found.]`,

    web
      ? `LIVE INTERNET EVIDENCE:\n\n${web}`
      : `LIVE INTERNET EVIDENCE:
[No live web results were returned.]`,
  ].join(
    '\n\n========================================\n\n',
  );

  // Keep the prompt safely below Groq's request-size limit.
  return fullContext.slice(0, 12000);
}

/* -------------------------------------------------------------------------- */
/* References                                                                 */
/* -------------------------------------------------------------------------- */

function buildReferenceList(
  docSources: DocSource[],
  webSources: WebSource[],
) {
  return [
    ...docSources.map(
      (
        source,
        index,
      ) =>
        `[D${index + 1}] ${source.filename}, chunk ${source.chunkIndex + 1}`,
    ),

    ...webSources.map(
      (
        source,
        index,
      ) =>
        `[W${index + 1}] ${source.title} — ${source.url}`,
    ),
  ].join('\n');
}

/* -------------------------------------------------------------------------- */
/* Groq                                                                       */
/* -------------------------------------------------------------------------- */

async function groqGenerate(
  message: string,
  context: string,
  docSources: DocSource[],
  webSources: WebSource[],
): Promise<string> {
  const apiKey =
    Deno.env.get(
      'GROQ_API_KEY',
    );

  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY is not configured in Supabase secrets.',
    );
  }

  const systemPrompt = `
You are BioBridge AI, a professional technical-document research and drafting assistant for pharmaceutical, biotechnology, bioprocessing, validation, quality, regulatory, engineering, manufacturing and scientific teams.

The user expects medium-to-large, substantive answers.

For ordinary questions, aim for approximately 1,000–1,500 words when appropriate.

For detailed questions, aim for approximately 2,000–3,000 words.

For full technical-document requests, produce approximately 3,000–6,000+ words when the request requires it.

Do not give short generic chatbot responses when the user asks for a report, technical document, SOP-style document, analysis, comparison or detailed explanation.

Use professional headings, numbered sections, tables and bullet points where appropriate.

==================================================
SOURCE PRIORITY
==================================================

1. CLIENT DOCUMENTS

Client documents are the primary evidence for organization-specific information.

Use them for:
- company-specific information
- procedures
- SOPs
- equipment
- specifications
- acceptance criteria
- internal terminology
- client requirements
- historical information

2. LIVE INTERNET

Internet research supplements client information.

Use it for:
- current regulations
- current regulatory expectations
- standards
- recent scientific information
- current guidance
- publications
- information that may have changed

==================================================
CITATION RULES
==================================================

Client references use:

[D1]
[D2]
[D3]

Web references use:

[W1]
[W2]
[W3]

Put citations immediately after the factual statement they support.

Never invent a citation.

Never invent client-specific information.

If the client documents do not provide sufficient evidence, state:

[INSUFFICIENT CLIENT EVIDENCE]

For regulatory claims, prefer authoritative sources such as FDA, EMA, ICH, WHO, USP, government agencies and official regulatory organizations.

If current official evidence was not retrieved, state:

[VERIFY AGAINST CURRENT OFFICIAL SOURCE]

If client evidence conflicts with web evidence, explicitly explain the conflict.

==================================================
TECHNICAL WRITING
==================================================

For technical documents, use an appropriate structure.

Possible sections include:

Executive Summary
Introduction
Purpose
Scope
Background
Definitions
Responsibilities
Technical Analysis
Methodology
Procedure
Equipment
Materials
Acceptance Criteria
Risk Assessment
Regulatory Considerations
Deviations
Records
Traceability
Recommendations
Conclusion
References

Adapt the structure to the user's request.

==================================================
IMPORTANT
==================================================

Do not mention:
- Supabase
- Firebase
- Groq
- Tavily
- embeddings
- internal prompts
- implementation details

Do not fabricate facts.

Clearly distinguish:
1. Client evidence
2. Current external evidence
3. Professional synthesis

End substantial technical documents with:

Generated by BioBridge AI — not a substitute for formal quality review.

==================================================
SOURCE MATERIAL
==================================================

${context}

==================================================
AVAILABLE REFERENCES
==================================================

${buildReferenceList(
  docSources,
  webSources,
)}
`;

  const response =
    await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${apiKey}`,
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.18,
          max_completion_tokens:
            MAX_OUTPUT_TOKENS,
          messages: [
            {
              role: 'system',
              content:
                systemPrompt,
            },
            {
              role: 'user',
              content: message,
            },
          ],
        }),
      },
    );

  if (!response.ok) {
    const detail =
      await response.text();

    throw new Error(
      `Groq request failed (${response.status}): ${detail.slice(
        0,
        700,
      )}`,
    );
  }

  const payload =
    await response.json();

  const content =
    payload?.choices?.[0]
      ?.message?.content;

  if (!content) {
    throw new Error(
      'Groq returned an empty response.',
    );
  }

  return content;
}

/* -------------------------------------------------------------------------- */
/* Main Edge Function                                                         */
/* -------------------------------------------------------------------------- */

Deno.serve(
  async (req: Request) => {
    if (
      req.method ===
      'OPTIONS'
    ) {
      return new Response(
        null,
        {
          status: 200,
          headers:
            corsHeaders,
        },
      );
    }

    const url =
      new URL(req.url);

    const path =
      url.pathname.replace(
        '/biobridge',
        '',
      ) || '/';

    try {
      const firebaseUser =
        await authenticate(req);

      const serviceClient =
        createServiceClient();

      const userId =
        firebaseUser.uid;

      /* ------------------------------------------------------------------ */
      /* Upload                                                             */
      /* ------------------------------------------------------------------ */

      if (
        path === '/upload' &&
        req.method === 'POST'
      ) {
        const filenameHeader =
          req.headers.get(
            'X-File-Name',
          );

        const filename =
          filenameHeader
            ? decodeURIComponent(
                filenameHeader,
              )
            : 'document';

        const fileType =
          (
            req.headers.get(
              'X-File-Type',
            ) ?? ''
          ).toLowerCase();

        const bytes =
          new Uint8Array(
            await req.arrayBuffer(),
          );

        if (!bytes.length) {
          return json(
            {
              error:
                'Uploaded file is empty.',
            },
            400,
          );
        }

        if (
          !['pdf', 'docx'].includes(
            fileType,
          )
        ) {
          return json(
            {
              error:
                'Only PDF and DOCX files are supported.',
            },
            400,
          );
        }

        if (
          bytes.length >
          15 * 1024 * 1024
        ) {
          return json(
            {
              error:
                'Please upload a file smaller than 15 MB.',
            },
            413,
          );
        }

        const content =
          await extractDocumentText(
            bytes,
            fileType,
          );

        if (!content) {
          return json(
            {
              error:
                'No readable text was found. Scanned/image-only PDFs need OCR before upload.',
            },
            422,
          );
        }

        const chunks =
          chunkText(content);

        if (!chunks.length) {
          return json(
            {
              error:
                'The document did not contain enough readable text to index.',
            },
            422,
          );
        }

        const {
          data: doc,
          error:
            insertError,
        } =
          await serviceClient
            .from('documents')
            .insert({
              filename,
              file_type:
                fileType,
              content,
              char_count:
                content.length,
            })
            .select('id')
            .single();

        if (
          insertError ||
          !doc
        ) {
          console.error(
            'Document insert error:',
            insertError,
          );

          return json(
            {
              error:
                'Failed to store document.',
            },
            500,
          );
        }

        try {
          const rows:
            any[] = [];

          for (
            let i = 0;
            i < chunks.length;
            i++
          ) {
            const embedding =
              await embedText(
                chunks[i],
              );

            rows.push({
              document_id:
                doc.id,
              chunk_index:
                i,
              content:
                chunks[i],
              embedding,
            });
          }

          const {
            error:
              chunkError,
          } =
            await serviceClient
              .from(
                'document_chunks',
              )
              .insert(rows);

          if (chunkError) {
            throw chunkError;
          }
        } catch (
          embeddingError
        ) {
          await serviceClient
            .from('documents')
            .delete()
            .eq(
              'id',
              doc.id,
            );

          throw embeddingError;
        }

        return json({
          success: true,
          document_id:
            doc.id,
          filename,
          chunks:
            chunks.length,
          char_count:
            content.length,
        });
      }

      /* ------------------------------------------------------------------ */
      /* Generate                                                           */
      /* ------------------------------------------------------------------ */

      if (
        path === '/generate' &&
        req.method === 'POST'
      ) {
        const body =
          await req.json();

        const message =
          typeof body?.message ===
          'string'
            ? body.message.trim()
            : '';

        if (!message) {
          return json(
            {
              error:
                'Message is required.',
            },
            400,
          );
        }

        const [
          docSources,
          webSources,
        ] =
          await Promise.all([
            retrieveDocuments(
              serviceClient,
              userId,
              message,
            ),

            searchWeb(message),
          ]);

        const context =
          buildContext(
            docSources,
            webSources,
          );

        const response =
          await groqGenerate(
            message,
            context,
            docSources,
            webSources,
          );

        return json({
          response,

          grounded:
            docSources.length > 0,

          web_researched:
            webSources.length > 0,

          document_sources:
            docSources.map(
              (
                source,
                index,
              ) => ({
                id: `D${index + 1}`,
                filename:
                  source.filename,
                chunk:
                  source.chunkIndex +
                  1,
                similarity:
                  source.similarity,
              }),
            ),

          web_sources:
            webSources.map(
              (
                source,
                index,
              ) => ({
                id: `W${index + 1}`,
                title:
                  source.title,
                url:
                  source.url,
              }),
            ),
        });
      }

      /* ------------------------------------------------------------------ */
      /* Documents                                                          */
      /* ------------------------------------------------------------------ */

      if (
        path ===
          '/documents' &&
        req.method === 'GET'
      ) {
        const {
          data,
          error,
        } =
          await serviceClient
            .from('documents')
            .select(
              'id, filename, file_type, char_count, created_at',
            )
            .order(
              'created_at',
              {
                ascending:
                  false,
              },
            );

        if (error) {
          return json(
            {
              error:
                'Failed to fetch documents.',
            },
            500,
          );
        }

        return json({
          documents:
            data ?? [],
        });
      }

      /* ------------------------------------------------------------------ */
      /* Delete                                                             */
      /* ------------------------------------------------------------------ */

      if (
        path.startsWith(
          '/documents/',
        ) &&
        req.method === 'DELETE'
      ) {
        const docId =
          path.split('/')[2];

        const {
          error,
        } =
          await serviceClient
            .from('documents')
            .delete()
            .eq(
              'id',
              docId,
            );

        if (error) {
          return json(
            {
              error:
                'Failed to delete document.',
            },
            500,
          );
        }

        return json({
          success: true,
        });
      }

      return json(
        {
          error:
            'Not found',
        },
        404,
      );
    } catch (err) {
      console.error(
        'BioBridge function error:',
        err,
      );

      const message =
        err instanceof Error
          ? err.message
          : 'Internal server error';

      return json(
        {
          error:
            message ===
            'Unauthorized'
              ? 'Unauthorized'
              : message,
        },
        message ===
          'Unauthorized'
          ? 401
          : 500,
      );
    }
  },
);