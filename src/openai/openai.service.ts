import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
	private readonly logger = new Logger(OpenAIService.name);
	private readonly client: OpenAI;

	constructor(private readonly configService: ConfigService) {
		this.client = new OpenAI({
			apiKey: this.configService.get<string>('OPENAI_API_KEY'),
		});
	}

	/**
	 * AI extracts structured product data from raw spreadsheet rows.
	 * Handles column identification, entity matching, and data normalization.
	 * Processes in batches to stay within token limits.
	 */
	async extractProductsFromSpreadsheet(
		headers: string[],
		rows: Record<string, any>[],
		existingMerchants: { id: string; name: string }[],
		existingBranches: { id: string; name: string }[],
	): Promise<{
		products: {
			product_name: string;
			merchant_name: string;
			branch_name: string;
			quantity: number;
			description?: string | null;
			additional_info?: string | null;
		}[];
	}> {
		const BATCH_SIZE = 200;

		// Build all batch promises upfront, then run in parallel
		const batches: { batch: Record<string, any>[]; batchNum: number }[] = [];
		const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

		for (let i = 0; i < rows.length; i += BATCH_SIZE) {
			batches.push({
				batch: rows.slice(i, i + BATCH_SIZE),
				batchNum: Math.floor(i / BATCH_SIZE) + 1,
			});
		}

		this.logger.log(`Processing ${totalBatches} batches in parallel`);

		const batchPromises = batches.map(({ batch, batchNum }) => {
			const prompt = `You are an AI assistant for an inventory management system. Extract structured product data from the spreadsheet rows below.

## YOUR TASK
Analyze the spreadsheet data and extract EVERY row into a structured format. You must identify which columns contain:
- **Product name** — the product/item name
- **Merchant name** — the merchant/supplier/vendor
- **Branch name** — the branch/store/location
- **Quantity** — the stock quantity (default to 0 if not present or empty)
- **Description** — product description (if present)
- **Additional info** — any extra notes/remarks (if present)

## CRITICAL: MERCHANT NAME MATCHING
You MUST match spreadsheet merchant names to the EXACT name from the existing database list below. Use fuzzy/intelligent matching:
- Case differences: "GLUTATHIONE" → use existing "Glutathione"
- Abbreviations: "E-Commart" → use existing "E-commart Enugu"
- Slashes/separators: "Daggo/Sonichoice" → use existing "Daggo Sonichoice"
- Partial matches: "577+377" → use existing "577+377 group"

**ALWAYS use the EXACT string from this list when a match is found (copy-paste it exactly):**
${JSON.stringify(existingMerchants.map(m => m.name))}

Only if there is truly NO matching merchant in the list above, use the spreadsheet name as-is (it will be created as new).

## CRITICAL: BRANCH NAME MATCHING
Same rules as merchant matching. You MUST use the EXACT branch name from the database when a match exists.
- "EBONYI" → use existing "Ebonyi" (if it exists)
- "Enugu Branch" and "Enugu" are the SAME branch — use whichever exists in the database
- "NSUKKA" → use existing "Nsukka" (if it exists)
- Never create a new branch if an existing one matches (even loosely)

**ALWAYS use the EXACT string from this list when a match is found (copy-paste it exactly):**
${JSON.stringify(existingBranches.map(b => b.name))}

Only if there is truly NO matching branch in the list above, use the spreadsheet name as-is (it will be created as new).

## SPREADSHEET DATA
**Headers:** ${JSON.stringify(headers)}

**Rows:**
${JSON.stringify(batch)}

## RESPONSE FORMAT (strict JSON only):
{
  "products": [
    {
      "product_name": "string",
      "merchant_name": "string — MUST be exact copy from existing merchants list if matched",
      "branch_name": "string — MUST be exact copy from existing branches list if matched",
      "quantity": number,
      "description": "string or null",
      "additional_info": "string or null"
    }
  ]
}

IMPORTANT:
- Extract EVERY row. Do not skip any.
- Use the quantity value from the spreadsheet exactly as-is. If empty, default to 0.
- NEVER create duplicate entities. If "EBONYI" and "Ebonyi" both exist in the database, pick one and use it consistently for ALL rows.
- If a row has no product name, skip it.
- Be consistent: use the SAME exact name string for the same merchant/branch across ALL rows.`;

			return this.client.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: [
					{
						role: 'system',
						content: 'You are a data extraction assistant. Always respond with valid JSON only. No markdown, no explanation, just JSON.',
					},
					{ role: 'user', content: prompt },
				],
				temperature: 0.1,
				response_format: { type: 'json_object' },
			}).then(response => {
				const content = response.choices[0]?.message?.content;
				if (!content) {
					throw new Error(`Empty response from OpenAI for batch ${batchNum}`);
				}
				const parsed = JSON.parse(content);
				this.logger.log(`Batch ${batchNum}/${totalBatches} completed (${batch.length} rows)`);
				return parsed.products && Array.isArray(parsed.products) ? parsed.products : [];
			}).catch(error => {
				this.logger.error(`OpenAI batch ${batchNum} failed: ${error.message}`, error.stack);
				throw error;
			});
		});

		const batchResults = await Promise.all(batchPromises);
		const allProducts = batchResults.flat();

		this.logger.log(`AI extracted ${allProducts.length} products from ${rows.length} rows`);
		return { products: allProducts };
	}
}
