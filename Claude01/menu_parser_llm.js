/**
 * eckasse Menu Parser with LLM Integration
 * 
 * Автоматически конвертирует отсканированные меню в OOP-POS-MDF формат
 * Поддерживает Google Gemini, OpenAI GPT, и Claude
 * 
 * Features:
 * - OCR для обработки изображений меню
 * - LLM для извлечения структурированных данных
 * - Автоматическое определение категорий и цен
 * - Многоязычная поддержка
 * - Валидация и коррекция данных
 * 
 * @author eckasse Development Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

class MenuParserLLM {
  constructor(options = {}) {
    this.logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/menu-parser.log' })
      ]
    });

    // Initialize LLM clients
    this.initializeLLMClients(options);
    
    this.defaultBusinessType = options.businessType || 'restaurant';
    this.defaultLanguage = options.defaultLanguage || 'de';
    this.supportedLanguages = options.supportedLanguages || ['de', 'en'];
    this.enableValidation = options.enableValidation !== false;
    
    // Menu parsing configuration
    this.parsingConfig = {
      maxRetries: 3,
      confidenceThreshold: 0.8,
      enableOCRPreprocessing: true,
      useMultipleModels: true,
      fallbackToManualReview: true
    };
  }

  initializeLLMClients(options) {
    // Google Gemini
    if (options.geminiApiKey || process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(options.geminiApiKey || process.env.GEMINI_API_KEY);
      this.geminiModel = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }

    // OpenAI GPT
    if (options.openaiApiKey || process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: options.openaiApiKey || process.env.OPENAI_API_KEY
      });
    }

    // Anthropic Claude
    if (options.anthropicApiKey || process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: options.anthropicApiKey || process.env.ANTHROPIC_API_KEY
      });
    }

    if (!this.gemini && !this.openai && !this.anthropic) {
      throw new Error('At least one LLM API key must be provided');
    }
  }

  /**
   * Главная функция парсинга меню
   */
  async parseMenu(input, options = {}) {
    const requestId = uuidv4();
    this.logger.info('Starting menu parsing', { requestId, inputType: typeof input });

    try {
      // Step 1: Extract text from input
      let menuText;
      if (typeof input === 'string') {
        // Input is already text
        menuText = input;
      } else {
        // Input is image file path or buffer
        menuText = await this.extractTextFromImage(input, requestId);
      }

      // Step 2: Preprocess text
      const preprocessedText = await this.preprocessMenuText(menuText);

      // Step 3: Parse with LLM
      const parsedData = await this.parseWithLLM(preprocessedText, options, requestId);

      // Step 4: Validate and enhance
      const enhancedData = await this.enhanceAndValidate(parsedData, options);

      // Step 5: Convert to OOP-POS-MDF format
      const oopPosMdf = await this.convertToOOPPOSMDF(enhancedData, options);

      this.logger.info('Menu parsing completed successfully', { 
        requestId,
        itemsFound: enhancedData.items?.length || 0,
        categoriesFound: enhancedData.categories?.length || 0
      });

      return {
        success: true,
        requestId,
        configuration: oopPosMdf,
        metadata: {
          itemsFound: enhancedData.items?.length || 0,
          categoriesFound: enhancedData.categories?.length || 0,
          confidence: enhancedData.confidence || 0,
          language: enhancedData.detectedLanguage || this.defaultLanguage,
          processingTime: Date.now()
        },
        rawData: {
          extractedText: menuText,
          parsedData: enhancedData
        }
      };

    } catch (error) {
      this.logger.error('Menu parsing failed', { requestId, error: error.message });
      throw error;
    }
  }

  /**
   * OCR для извлечения текста из изображений
   */
  async extractTextFromImage(imagePath, requestId) {
    this.logger.info('Starting OCR extraction', { requestId });

    try {
      // Preprocessing image for better OCR results
      let processedImagePath = imagePath;
      
      if (this.parsingConfig.enableOCRPreprocessing) {
        processedImagePath = await this.preprocessImage(imagePath);
      }

      // Extract text using Tesseract
      const { data: { text } } = await Tesseract.recognize(processedImagePath, 'deu+eng', {
        logger: m => this.logger.debug('OCR progress', { requestId, progress: m })
      });

      // Cleanup processed image if it was created
      if (processedImagePath !== imagePath) {
        await fs.unlink(processedImagePath).catch(() => {});
      }

      this.logger.info('OCR extraction completed', { 
        requestId, 
        textLength: text.length,
        confidence: 'high' // Tesseract provides confidence per word, simplified here
      });

      return text;

    } catch (error) {
      this.logger.error('OCR extraction failed', { requestId, error: error.message });
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  /**
   * Предварительная обработка изображения для улучшения OCR
   */
  async preprocessImage(imagePath) {
    const outputPath = path.join(path.dirname(imagePath), `processed_${path.basename(imagePath)}`);

    await sharp(imagePath)
      .resize({ width: 2000, withoutEnlargement: true })
      .greyscale()
      .normalize()
      .sharpen()
      .toFile(outputPath);

    return outputPath;
  }

  /**
   * Предварительная обработка текста меню
   */
  async preprocessMenuText(text) {
    // Clean up OCR artifacts
    let cleaned = text
      .replace(/[^\w\s\d\.,€$£¥\-()\/\[\]]/g, ' ') // Remove strange characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Remove common OCR errors
    cleaned = cleaned
      .replace(/(\d)\s+[,.](\d)/g, '$1.$2') // Fix decimal separators
      .replace(/€\s+(\d)/g, '€$1') // Fix currency spacing
      .replace(/(\d)\s+€/g, '$1€')
      .replace(/\b(\d+)[oO](\d+)\b/g, '$1.0$2'); // Fix OCR 'o' -> '0' in prices

    return cleaned;
  }

  /**
   * Парсинг меню с помощью LLM
   */
  async parseWithLLM(menuText, options, requestId) {
    const businessType = options.businessType || this.defaultBusinessType;
    const language = options.language || this.defaultLanguage;

    const systemPrompt = this.createSystemPrompt(businessType, language);
    const userPrompt = this.createUserPrompt(menuText, options);

    let bestResult = null;
    let attempts = 0;

    // Try different models for best results
    const models = this.getAvailableModels();

    for (const model of models) {
      if (attempts >= this.parsingConfig.maxRetries) break;

      try {
        attempts++;
        this.logger.info('Attempting LLM parsing', { requestId, model: model.name, attempt: attempts });

        const result = await this.callLLM(model, systemPrompt, userPrompt);
        const parsed = this.parseLLMResponse(result);

        if (this.validateParsedData(parsed)) {
          bestResult = { ...parsed, model: model.name, confidence: this.calculateConfidence(parsed) };
          
          if (bestResult.confidence > this.parsingConfig.confidenceThreshold) {
            break; // Good enough result
          }
        }

      } catch (error) {
        this.logger.warn('LLM parsing attempt failed', { 
          requestId, 
          model: model.name, 
          attempt: attempts, 
          error: error.message 
        });
      }
    }

    if (!bestResult) {
      throw new Error('Failed to parse menu with any available LLM model');
    }

    this.logger.info('LLM parsing successful', { 
      requestId, 
      model: bestResult.model, 
      confidence: bestResult.confidence 
    });

    return bestResult;
  }

  /**
   * Создание system prompt для LLM
   */
  createSystemPrompt(businessType, language) {
    return `Du bist ein Experte für die Analyse von Restaurant-Menüs und POS-Systemen. 
Deine Aufgabe ist es, gescannten Menütext in strukturierte JSON-Daten zu konvertieren.

BUSINESS TYPE: ${businessType}
OUTPUT LANGUAGE: ${language}

WICHTIGE ANWEISUNGEN:
1. Extrahiere alle Artikel mit Namen, Preisen und Beschreibungen
2. Organisiere Artikel in logische Kategorien (Vorspeisen, Hauptspeisen, Getränke, etc.)
3. Erkenne Allergene und besondere Eigenschaften (vegan, glutenfrei, etc.)
4. Normalisiere Preise im Format "X.XX" (Dezimaltrennzeichen: Punkt)
5. Identifiziere Währung automatisch
6. Berücksichtige verschiedene Portionsgrößen und Varianten

ANTWORT-FORMAT (JSON):
{
  "restaurant_info": {
    "name": "Restaurantname (falls erkennbar)",
    "type": "restaurant/cafe/bar/fastfood",
    "detected_language": "de/en/fr/etc",
    "currency": "€/$£/etc"
  },
  "categories": [
    {
      "id": 1,
      "name": "Kategoriename",
      "type": "food/drink",
      "description": "Optional"
    }
  ],
  "items": [
    {
      "id": "unique_id",
      "name": "Artikelname",
      "short_name": "Kurzer Name für Button",
      "description": "Beschreibung",
      "price": 12.50,
      "category_id": 1,
      "allergens": ["gluten", "dairy"],
      "dietary_info": ["vegetarian", "vegan", "gluten_free"],
      "portion_size": "Normal/Klein/Groß",
      "variants": [
        {"name": "Klein", "price": 10.50},
        {"name": "Groß", "price": 15.50}
      ]
    }
  ],
  "parsing_notes": [
    "Hinweise auf Unsicherheiten oder Besonderheiten"
  ]
}

Achte auf häufige OCR-Fehler und korrigiere sie intelligent.`;
  }

  /**
   * Создание user prompt с текстом меню
   */
  createUserPrompt(menuText, options) {
    return `Analysiere bitte das folgende Restaurant-Menü und konvertiere es in das angegebene JSON-Format:

MENÜTEXT:
${menuText}

ZUSÄTZLICHE ANFORDERUNGEN:
- Erstelle sinnvolle Kategorien basierend auf dem Menüinhalt
- Achte auf Preisangaben und korrigiere OCR-Fehler
- Erkenne automatisch die Sprache des Menüs
- Identifiziere Allergene und besondere Eigenschaften
- Erstelle eindeutige IDs für alle Artikel

Antworte nur mit dem validen JSON-Objekt.`;
  }

  /**
   * Получение доступных моделей LLM
   */
  getAvailableModels() {
    const models = [];

    if (this.gemini) {
      models.push({ name: 'gemini-1.5-flash', client: this.gemini, type: 'gemini' });
    }

    if (this.openai) {
      models.push({ name: 'gpt-4o', client: this.openai, type: 'openai' });
      models.push({ name: 'gpt-3.5-turbo', client: this.openai, type: 'openai' });
    }

    if (this.anthropic) {
      models.push({ name: 'claude-3-sonnet-20240229', client: this.anthropic, type: 'anthropic' });
    }

    return models;
  }

  /**
   * Вызов LLM API
   */
  async callLLM(model, systemPrompt, userPrompt) {
    switch (model.type) {
      case 'gemini':
        const chat = model.client.getGenerativeModel({ model: 'gemini-1.5-flash' }).startChat({
          history: [
            {
              role: 'user',
              parts: [{ text: systemPrompt }]
            },
            {
              role: 'model',
              parts: [{ text: 'Ich verstehe. Ich werde das Menü analysieren und in das angegebene JSON-Format konvertieren.' }]
            }
          ]
        });
        
        const result = await chat.sendMessage(userPrompt);
        return result.response.text();

      case 'openai':
        const completion = await model.client.chat.completions.create({
          model: model.name,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 4000
        });
        return completion.choices[0].message.content;

      case 'anthropic':
        const message = await model.client.messages.create({
          model: model.name,
          max_tokens: 4000,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        });
        return message.content[0].text;

      default:
        throw new Error(`Unsupported model type: ${model.type}`);
    }
  }

  /**
   * Парсинг ответа LLM
   */
  parseLLMResponse(response) {
    try {
      // Clean response text
      let cleanedResponse = response.trim();
      
      // Remove markdown code blocks if present
      cleanedResponse = cleanedResponse.replace(/```json\s*|\s*```/g, '');
      
      // Find JSON object
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      return JSON.parse(cleanedResponse);
    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}`);
    }
  }

  /**
   * Валидация парсеных данных
   */
  validateParsedData(data) {
    // Basic validation
    if (!data || typeof data !== 'object') return false;
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) return false;
    if (!data.categories || !Array.isArray(data.categories) || data.categories.length === 0) return false;

    // Check items have required fields
    for (const item of data.items) {
      if (!item.name || typeof item.price !== 'number' || !item.category_id) {
        return false;
      }
    }

    // Check categories have required fields
    for (const category of data.categories) {
      if (!category.name || !category.id) {
        return false;
      }
    }

    return true;
  }

  /**
   * Расчет уверенности в результате
   */
  calculateConfidence(data) {
    let score = 0.5; // Base score

    // Items with prices
    const itemsWithPrices = data.items.filter(item => typeof item.price === 'number' && item.price > 0);
    score += (itemsWithPrices.length / data.items.length) * 0.3;

    // Categories coverage
    const categoriesUsed = new Set(data.items.map(item => item.category_id));
    score += (categoriesUsed.size / data.categories.length) * 0.2;

    // Items with descriptions
    const itemsWithDescriptions = data.items.filter(item => item.description && item.description.length > 5);
    score += (itemsWithDescriptions.length / data.items.length) * 0.1;

    // Language detection
    if (data.restaurant_info?.detected_language) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Улучшение и валидация данных
   */
  async enhanceAndValidate(parsedData, options) {
    // Add missing IDs
    parsedData.categories.forEach((category, index) => {
      if (!category.id) category.id = index + 1;
    });

    parsedData.items.forEach((item, index) => {
      if (!item.id) item.id = 1000 + index;
      if (!item.short_name) item.short_name = this.generateShortName(item.name);
    });

    // Validate price formats
    parsedData.items.forEach(item => {
      if (typeof item.price === 'string') {
        item.price = parseFloat(item.price.replace(/[^\d.,]/g, '').replace(',', '.'));
      }
      item.price = Math.round(item.price * 100) / 100; // Round to 2 decimal places
    });

    // Enhance categories
    parsedData.categories.forEach(category => {
      if (!category.type) {
        category.type = this.guesseCategoryType(category.name);
      }
    });

    // Add allergen information if missing
    parsedData.items.forEach(item => {
      if (!item.allergens) item.allergens = [];
      if (!item.dietary_info) item.dietary_info = [];
      
      // Try to detect allergens from description
      this.detectAllergensFromText(item.name + ' ' + (item.description || ''), item);
    });

    return parsedData;
  }

  /**
   * Генерация короткого названия для кнопки
   */
  generateShortName(fullName) {
    if (fullName.length <= 12) return fullName;
    
    // Try to create meaningful abbreviation
    const words = fullName.split(' ');
    if (words.length > 1) {
      return words.slice(0, 2).join(' ').substring(0, 12);
    }
    
    return fullName.substring(0, 12);
  }

  /**
   * Определение типа категории
   */
  guesseCategoryType(categoryName) {
    const drinkKeywords = ['getränk', 'drink', 'beverage', 'wein', 'wine', 'bier', 'beer', 'cocktail', 'saft', 'juice', 'kaffee', 'coffee', 'tee', 'tea'];
    const nameL lower = categoryName.toLowerCase();
    
    return drinkKeywords.some(keyword => nameLower.includes(keyword)) ? 'drink' : 'food';
  }

  /**
   * Определение аллергенов из текста
   */
  detectAllergensFromText(text, item) {
    const textLower = text.toLowerCase();
    
    const allergenMap = {
      'gluten': ['weizen', 'dinkel', 'roggen', 'gerste', 'hafer', 'gluten'],
      'dairy': ['milch', 'käse', 'butter', 'sahne', 'joghurt', 'quark'],
      'nuts': ['nuss', 'mandel', 'haselnuss', 'walnuss', 'erdnuss'],
      'fish': ['fisch', 'lachs', 'thunfisch', 'forelle'],
      'crustaceans': ['garnele', 'krebs', 'hummer', 'languste'],
      'eggs': ['ei', 'eigelb', 'eiweiß'],
      'soy': ['soja', 'tofu'],
      'sulfites': ['wein', 'trockenfrüchte']
    };

    for (const [allergen, keywords] of Object.entries(allergenMap)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        if (!item.allergens.includes(allergen)) {
          item.allergens.push(allergen);
        }
      }
    }

    // Dietary info detection
    if (textLower.includes('vegan')) item.dietary_info.push('vegan');
    if (textLower.includes('vegetarisch') || textLower.includes('vegetarian')) item.dietary_info.push('vegetarian');
    if (textLower.includes('glutenfrei') || textLower.includes('gluten-free')) item.dietary_info.push('gluten_free');
    if (textLower.includes('bio') || textLower.includes('organic')) item.dietary_info.push('organic');
  }

  /**
   * Конвертация в OOP-POS-MDF формат
   */
  async convertToOOPPOSMDF(parsedData, options) {
    const restaurantName = parsedData.restaurant_info?.name || options.restaurantName || 'Parsed Restaurant';
    const currency = parsedData.restaurant_info?.currency || '€';
    const detectedLanguage = parsedData.restaurant_info?.detected_language || this.defaultLanguage;

    // Create audit trail
    const auditTrail = {
      created_at: new Date().toISOString(),
      created_by: 'menu-parser@eckasse.com',
      last_modified_at: new Date().toISOString(),
      last_modified_by: 'menu-parser@eckasse.com',
      version: 1,
      change_log: [
        {
          timestamp: new Date().toISOString(),
          user: 'menu-parser@eckasse.com',
          action: 'menu_parsed',
          description: 'Automatically parsed from menu image/text'
        }
      ]
    };

    // Convert categories to multilingual format
    const categories = parsedData.categories.map(cat => ({
      category_unique_identifier: cat.id,
      category_names: this.createMultilingualObject(cat.name, detectedLanguage),
      category_type: cat.type,
      parent_category_unique_identifier: null,
      default_linked_main_group_unique_identifier: cat.type === 'drink' ? 1 : 2,
      audit_trail: { ...auditTrail }
    }));

    // Convert items to multilingual format
    const items = parsedData.items.map(item => ({
      item_unique_identifier: item.id,
      display_names: {
        menu: this.createMultilingualObject(item.name, detectedLanguage),
        button: this.createMultilingualObject(item.short_name, detectedLanguage),
        receipt: this.createMultilingualObject(item.name, detectedLanguage)
      },
      item_price_value: item.price,
      pricing_schedules: item.variants ? item.variants.map(variant => ({
        schedule_id: `variant_${variant.name.toLowerCase()}`,
        price: variant.price,
        valid_days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
      })) : [],
      availability_schedule: {
        always_available: true,
        schedules: []
      },
      associated_category_unique_identifier: item.category_id,
      additional_item_attributes: {
        description: item.description || '',
        allergens: item.allergens || [],
        dietary_info: item.dietary_info || [],
        portion_size: item.portion_size || 'normal',
        menu_parser_generated: true
      },
      item_flags: {
        is_sellable: true,
        has_negative_price: false,
        requires_age_verification: false,
        is_organic: item.dietary_info?.includes('organic') || false
      },
      audit_trail: { ...auditTrail }
    }));

    // Create full OOP-POS-MDF configuration
    const config = {
      "$schema": "https://schemas.eckasse.com/oop-pos-mdf/v2.0.0/schema.json",
      company_details: {
        company_unique_identifier: 1,
        company_full_name: restaurantName,
        meta_information: {
          format_version: "2.0.0",
          previous_versions: [],
          date_generated: new Date().toISOString(),
          generated_by: "eckasse-menu-parser-v2.0.0",
          default_currency_symbol: currency,
          default_language: detectedLanguage,
          supported_languages: this.supportedLanguages,
          audit_trail: { ...auditTrail }
        },
        global_configurations: {
          tax_rates_definitions: [
            {
              tax_rate_unique_identifier: 1,
              tax_rate_names: this.createMultilingualObject("Standard (19%)", detectedLanguage),
              rate_percentage: 19.0,
              fiscal_mapping_type: "NORMAL"
            },
            {
              tax_rate_unique_identifier: 2,
              tax_rate_names: this.createMultilingualObject("Ermäßigt (7%)", detectedLanguage),
              rate_percentage: 7.0,
              fiscal_mapping_type: "REDUCED"
            }
          ],
          main_groups_definitions: [
            {
              main_group_unique_identifier: 1,
              main_group_names: this.createMultilingualObject("Getränke", detectedLanguage)
            },
            {
              main_group_unique_identifier: 2,
              main_group_names: this.createMultilingualObject("Speisen", detectedLanguage)
            }
          ],
          payment_methods_definitions: [
            {
              payment_method_unique_identifier: 1,
              payment_method_names: this.createMultilingualObject("Bar", detectedLanguage),
              payment_method_type: "CASH"
            },
            {
              payment_method_unique_identifier: 2,
              payment_method_names: this.createMultilingualObject("Karte", detectedLanguage),
              payment_method_type: "CARD"
            }
          ],
          promotions_definitions: [],
          workflows: [],
          integrations: {},
          security_settings: {
            encryption: { at_rest: true, in_transit: true, algorithm: "AES-256" },
            access_control: { session_timeout: 3600, max_failed_attempts: 3, lockout_duration: 900, require_2fa: false },
            data_privacy: { gdpr_compliance: true, data_retention_days: 2555, anonymization_rules: [] }
          }
        },
        branches: [
          {
            branch_unique_identifier: 1,
            branch_names: this.createMultilingualObject("Hauptfiliale", detectedLanguage),
            branch_address: "Automatisch generiert aus Menü",
            point_of_sale_devices: [
              {
                pos_device_unique_identifier: 1,
                pos_device_names: this.createMultilingualObject("Hauptkasse", detectedLanguage),
                pos_device_type: "DESKTOP",
                pos_device_external_number: 1,
                pos_device_settings: {
                  default_currency_identifier: currency,
                  default_linked_drink_tax_rate_unique_identifier: 1,
                  default_linked_food_tax_rate_unique_identifier: 2
                },
                categories_for_this_pos: categories,
                items_for_this_pos: items
              }
            ]
          }
        ]
      }
    };

    return config;
  }

  /**
   * Создание многоязычного объекта
   */
  createMultilingualObject(text, primaryLanguage) {
    const obj = {};
    obj[primaryLanguage] = text;
    
    // Add fallback to default language if different
    if (primaryLanguage !== this.defaultLanguage) {
      obj[this.defaultLanguage] = text;
    }

    return obj;
  }

  /**
   * CLI интерфейс для парсинга меню
   */
  static async parseMenuFromCLI(args) {
    const parser = new MenuParserLLM({
      geminiApiKey: process.env.GEMINI_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY
    });

    try {
      const inputPath = args[0];
      const outputPath = args[1] || 'parsed-menu-config.json';
      
      if (!inputPath) {
        console.error('Usage: node menu-parser.js <input-image-or-text> [output-file]');
        process.exit(1);
      }

      console.log(`🔍 Parsing menu from: ${inputPath}`);
      const result = await parser.parseMenu(inputPath);

      // Save configuration
      await fs.writeFile(outputPath, JSON.stringify(result.configuration, null, 2));
      
      console.log(`✅ Menu parsed successfully!`);
      console.log(`📊 Found ${result.metadata.itemsFound} items in ${result.metadata.categoriesFound} categories`);
      console.log(`🎯 Confidence: ${(result.metadata.confidence * 100).toFixed(1)}%`);
      console.log(`💾 Configuration saved to: ${outputPath}`);

      // Generate Vectron import if requested
      if (args.includes('--vectron')) {
        const vectronConverter = require('./vectron-converter');
        const vectronData = vectronConverter.convert(result.configuration);
        const vectronPath = outputPath.replace('.json', '-vectron.txt');
        await fs.writeFile(vectronPath, vectronData);
        console.log(`🔄 Vectron import file saved to: ${vectronPath}`);
      }

    } catch (error) {
      console.error('❌ Menu parsing failed:', error.message);
      process.exit(1);
    }
  }
}

// Export for use as module
module.exports = MenuParserLLM;

// Run CLI if called directly
if (require.main === module) {
  MenuParserLLM.parseMenuFromCLI(process.argv.slice(2));
}