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

	async analyzeSpreadsheetData(
		headers: string[],
		rows: Record<string, any>[],
		existingMerchants: { id: string; name: string }[],
		existingBranches: { id: string; name: string }[],
		existingProducts: { name: string; merchantId: string }[],
	) {
		const prompt = `You are an AI assistant for an inventory management system. Analyze the following spreadsheet data and return a structured JSON response.

## YOUR TASKS:

### 1. COLUMN MAPPING
Map the spreadsheet column headers to these system fields:
- "product_name" (REQUIRED) — the product/item name
- "merchant_name" — the merchant/supplier/vendor name
- "branch_name" — the branch/store/location name
- "quantity" — stock quantity/count/qty
- "description" — product description/details
- "date_received" — date received/added
- "additional_info" — any extra info/notes/remarks
- "low_stock_alert" — low stock threshold/alert level

Detect the correct mapping by analyzing column header names intelligently. Headers may use different naming conventions (e.g., "Product", "Item Name", "product_name", "Merchant Name", "Supplier", "Vendor", etc.)

### 2. MERCHANT MATCHING
For each unique merchant name found in the spreadsheet, find the best matching merchant from the existing database list. Use fuzzy matching — names may have slight differences (e.g., "Daggo/Sonichoice" vs "Daggo Sonichoice", "E-Commart Enugu" vs "E-commart"). If no close match exists, mark it as "NEW".

### 3. BRANCH MATCHING
Same as merchant matching — match branch names from spreadsheet to existing branches in DB.

### 4. DUPLICATE DETECTION
Check each product row against the existing products list. A product is a duplicate if it has the SAME name AND belongs to the SAME merchant. Flag duplicates.

## INPUT DATA:

**Spreadsheet Headers:** ${JSON.stringify(headers)}

**Spreadsheet Rows (first 100 shown):**
${JSON.stringify(rows.slice(0, 100))}

**Total rows in spreadsheet:** ${rows.length}

**Existing Merchants in Database:**
${JSON.stringify(existingMerchants)}

**Existing Branches in Database:**
${JSON.stringify(existingBranches)}

**Existing Products in Database (name + merchantId):**
${JSON.stringify(existingProducts.slice(0, 500))}

## RESPONSE FORMAT (strict JSON, no markdown):
{
  "column_mapping": {
    "<original_header>": "<system_field or null if not mappable>"
  },
  "merchant_matches": {
    "<spreadsheet_merchant_name>": {
      "matched_id": "<existing merchant UUID or null>",
      "matched_name": "<existing merchant name or null>",
      "confidence": "high|medium|low",
      "is_new": false
    }
  },
  "branch_matches": {
    "<spreadsheet_branch_name>": {
      "matched_id": "<existing branch UUID or null>",
      "matched_name": "<existing branch name or null>",
      "confidence": "high|medium|low",
      "is_new": false
    }
  },
  "products": [
    {
      "row_index": 0,
      "name": "Product Name",
      "merchant_name": "Merchant from spreadsheet",
      "branch_name": "Branch from spreadsheet or null",
      "quantity": 10,
      "description": null,
      "date_received": null,
      "additional_info": null,
      "low_stock_alert": 10,
      "is_duplicate": false,
      "duplicate_reason": null
    }
  ],
  "summary": {
    "total_rows": 0,
    "new_products": 0,
    "duplicates": 0,
    "new_merchants": 0,
    "unmatched_branches": 0
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
