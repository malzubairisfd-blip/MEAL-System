/**
 *  * Lightweight ai client wrapper for your Genkit provider.
  *
   * Exports an `ai` object with a `generate` method that matches the usage in
    * generateClusterDescription.ts:
     *
      * await ai.generate({ model, prompt, config })
       *
        * The implementation below uses fetch to POST to a generic "generate" endpoint.
         * Adjust URL, request body shape, and response parsing to match your Genkit SDK/API.
          *
           * Required env:
            * - GENKIT_API_BASE      (e.g. https://api.genkit.example) - optional default provided
             * - GENKIT_API_KEY
              * - GENKIT_MODEL         (optional default used in caller)
               */

               const GENKIT_API_BASE = process.env.GENKIT_API_BASE ?? 'https://api.genkit.example';
               const GENKIT_API_KEY = process.env.GENKIT_API_KEY;

               if (!GENKIT_API_KEY) {
                 // Do not throw at import time in production if you prefer. Keeping this check helps fail fast.
                   // throw new Error('GENKIT_API_KEY is required');
                   }

                   /**
                    * Response shape we try to unify to { text?: string }
                     */
                     type GenResponse = {
                       text?: string;
                         // allow other shapes depending on provider
                           [k: string]: any;
                           };

                           export const ai = {
                             /**
                                * Generate text from the model.
                                   * - model: provider model id
                                      * - prompt: full prompt string
                                         * - config: provider options like temperature, maxOutputTokens, ...
                                            */
                                              async generate(opts: { model: string; prompt: string; config?: Record<string, any> }): Promise<GenResponse> {
                                                  if (!GENKIT_API_KEY) {
                                                        throw new Error('Missing GENKIT_API_KEY environment variable.');
                                                            }

                                                                const url = `${GENKIT_API_BASE.replace(/\/$/, '')}/v1/generate`;

                                                                    const body = {
                                                                          model: opts.model,
                                                                                prompt: opts.prompt,
                                                                                      // pass config directly; adapt shape if your provider expects different keys
                                                                                            ...(opts.config ? { options: opts.config } : {}),
                                                                                                };

                                                                                                    const resp = await fetch(url, {
                                                                                                          method: 'POST',
                                                                                                                headers: {
                                                                                                                        'Content-Type': 'application/json',
                                                                                                                                Authorization: `Bearer ${GENKIT_API_KEY}`,
                                                                                                                                      },
                                                                                                                                            body: JSON.stringify(body),
                                                                                                                                                });

                                                                                                                                                    if (!resp.ok) {
                                                                                                                                                          const text = await resp.text().catch(() => '');
                                                                                                                                                                throw new Error(`Genkit API error: ${resp.status} ${resp.statusText} ${text}`);
                                                                                                                                                                    }

                                                                                                                                                                        // Try to parse JSON response. Many providers return { text } or { output: [...] }.
                                                                                                                                                                            const json = await resp.json().catch(() => null);

                                                                                                                                                                                if (!json) {
                                                                                                                                                                                      // fallback: attempt to read as text
                                                                                                                                                                                            const txt = await resp.text().catch(() => '');
                                                                                                                                                                                                  return { text: txt };
                                                                                                                                                                                                      }

                                                                                                                                                                                                          // Common shapes:
                                                                                                                                                                                                              // - { text: "..." }
                                                                                                                                                                                                                  // - { output: [{ content: "..." }] }
                                                                                                                                                                                                                      // - { results: [{ text: "..." }] }
                                                                                                                                                                                                                          if (typeof json.text === 'string') return { text: json.text };
                                                                                                                                                                                                                              if (Array.isArray(json.output) && json.output.length > 0) {
                                                                                                                                                                                                                                    const first = json.output[0];
                                                                                                                                                                                                                                          if (typeof first.content === 'string') return { text: first.content };
                                                                                                                                                                                                                                                if (typeof first.text === 'string') return { text: first.text };
                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                        if (Array.isArray(json.results) && json.results.length > 0 && typeof json.results[0].text === 'string') {
                                                                                                                                                                                                                                                              return { text: json.results[0].text };
                                                                                                                                                                                                                                                                  }

                                                                                                                                                                                                                                                                      // If nothing matched, return a stringified fallback
                                                                                                                                                                                                                                                                          return { text: typeof json === 'string' ? json : JSON.stringify(json) };
                                                                                                                                                                                                                                                                            },
                                                                                                                                                                                                                                                                            };

                                                                                                                                                                                                                                                                            export default ai;