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
		const allProducts: any[] = [];

		for (let i = 0; i < rows.length; i += BATCH_SIZE) {
			const batch = rows.slice(i, i + BATCH_SIZE);
			const batchNum = Math.floor(i / BATCH_SIZE) + 1;
			const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

			this.logger.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} rows)`);

			const prompt = `You are an AI assistant for an inventory management system. Extract structured product data from the spreadsheet rows below.

## YOUR TASK
Analyze the spreadsheet data and extract EVERY row into a structured format. You must identify which columns contain:
- **Product name** — the product/item name
- **Merchant name** — the merchant/supplier/vendor
- **Branch name** — the branch/store/location
- **Quantity** — the stock quantity (default to 0 if not present or empty)
- **Description** — product description (if present)
- **Additional info** — any extra notes/remarks (if present)

## MERCHANT MATCHING
Match spreadsheet merchant names to existing database merchants using fuzzy matching. Names may differ slightly (e.g., "Daggo/Sonichoice" vs "Daggo Sonichoice"). If no match, use the merchant name exactly as it appears in the spreadsheet — it will be created as a new merchant.

**Existing merchants in database:** ${JSON.stringify(existingMerchants.map(m => m.name))}

## BRANCH MATCHING
Same fuzzy matching for branches. If a branch name doesn't match any existing branch, use the name exactly as it appears — it will be created as a new branch.

**Existing branches in database:** ${JSON.stringify(existingBranches.map(b => b.name))}

## SPREADSHEET DATA
**Headers:** ${JSON.stringify(headers)}

**Rows:**
${JSON.stringify(batch)}

## RESPONSE FORMAT (strict JSON only):
{
  "products": [
    {
      "product_name": "string",
      "merchant_name": "string (matched to existing or exact from spreadsheet)",
      "branch_name": "string (matched to existing or exact from spreadsheet)",
      "quantity": number,
      "description": "string or null",
      "additional_info": "string or null"
    }
  ]
}

IMPORTANT:
- Extract EVERY row. Do not skip any.
- Use the quantity value from the spreadsheet exactly as-is. If empty, default to 0.
- Normalize merchant and branch names to match existing database entries when possible.
- If a row has no product name, skip it.`;

			try {
				const response = await this.client.chat.completions.create({
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
				});

				const content = response.choices[0]?.message?.content;
				if (!content) {
					throw new Error(`Empty response from OpenAI for batch ${batchNum}`);
				}

				const parsed = JSON.parse(content);
				if (parsed.products && Array.isArray(parsed.products)) {
					allProducts.push(...parsed.products);
				}
			} catch (error) {
				this.logger.error(`OpenAI batch ${batchNum} failed: ${error.message}`, error.stack);
				throw error;
			}
		}

		this.logger.log(`AI extracted ${allProducts.length} products from ${rows.length} rows`);
		return { products: allProducts };
	}
}
