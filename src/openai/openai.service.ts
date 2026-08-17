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
	 * AI only handles the LIGHTWEIGHT tasks:
	 * 1. Column mapping (headers → system fields)
	 * 2. Merchant fuzzy matching (spreadsheet names → DB merchants)
	 * 3. Branch fuzzy matching (spreadsheet names → DB branches)
	 *
	 * Row-by-row processing and duplicate detection is done in code — NOT by AI.
	 */
	async analyzeSpreadsheetStructure(
		headers: string[],
		sampleRows: Record<string, any>[],
		uniqueMerchantNames: string[],
		uniqueBranchNames: string[],
		existingMerchants: { id: string; name: string }[],
		existingBranches: { id: string; name: string }[],
	) {
		const prompt = `You are an AI assistant for an inventory management system. Analyze the spreadsheet structure and match entities. Return a structured JSON response.

## TASK 1: COLUMN MAPPING
Map these spreadsheet column headers to system fields. Analyze header names intelligently — they may use any naming convention.

System fields to map to:
- "product_name" (REQUIRED) — the product/item name column
- "merchant_name" — the merchant/supplier/vendor column
- "branch_name" — the branch/store/location column
- "quantity" — stock quantity/count/qty column
- "description" — product description/details column
- "date_received" — date received/added column
- "additional_info" — any extra info/notes/remarks column
- "low_stock_alert" — low stock threshold/alert level column

**Spreadsheet Headers:** ${JSON.stringify(headers)}

**Sample rows (first 5, for context):**
${JSON.stringify(sampleRows.slice(0, 5))}

## TASK 2: MERCHANT MATCHING
For each unique merchant name from the spreadsheet, find the best matching merchant from the database. Use fuzzy matching — names may differ slightly (e.g., "Daggo/Sonichoice" vs "Daggo Sonichoice", "E-Commart Enugu" vs "E-commart").

**Unique merchant names from spreadsheet:** ${JSON.stringify(uniqueMerchantNames)}

**Existing merchants in database:** ${JSON.stringify(existingMerchants)}

## TASK 3: BRANCH MATCHING
Same as merchant matching but for branches.

**Unique branch names from spreadsheet:** ${JSON.stringify(uniqueBranchNames)}

**Existing branches in database:** ${JSON.stringify(existingBranches)}

## RESPONSE FORMAT (strict JSON only):
{
  "column_mapping": {
    "<original_header>": "<system_field or null if not mappable>"
  },
  "merchant_matches": {
    "<spreadsheet_merchant_name>": {
      "matched_id": "<existing merchant UUID or null if no match>",
      "matched_name": "<existing merchant name or null>",
      "confidence": "high|medium|low",
      "is_new": true
    }
  },
  "branch_matches": {
    "<spreadsheet_branch_name>": {
      "matched_id": "<existing branch UUID or null if no match>",
      "matched_name": "<existing branch name or null>",
      "confidence": "high|medium|low",
      "is_new": true
    }
  }
}`;

		try {
			const response = await this.client.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: [
					{
						role: 'system',
						content: 'You are a data processing assistant. Always respond with valid JSON only. No markdown, no explanation, just JSON.',
					},
					{ role: 'user', content: prompt },
				],
				temperature: 0.1,
				response_format: { type: 'json_object' },
			});

			const content = response.choices[0]?.message?.content;
			if (!content) {
				throw new Error('Empty response from OpenAI');
			}

			return JSON.parse(content);
		} catch (error) {
			this.logger.error(`OpenAI analysis failed: ${error.message}`, error.stack);
			throw error;
		}
	}
}
