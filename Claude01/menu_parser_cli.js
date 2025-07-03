#!/usr/bin/env node

/**
 * eckasse Menu Parser CLI
 * 
 * Комманда для интеграции в основной CLI
 * 
 * Примеры использования:
 * eckasse parse-menu menu.jpg --output restaurant-config.json
 * eckasse parse-menu menu.pdf --business-type cafe --language de
 * eckasse parse-menu menu.txt --vectron --output-dir ./configs
 * 
 * @author eckasse Development Team
 * @version 2.0.0
 */

const { program } = require('commander');
const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const MenuParserLLM = require('./menu-parser-llm');

// Extend main CLI with menu parsing commands
function addMenuParsingCommands(mainProgram) {
  
  // Main menu parsing command
  mainProgram
    .command('parse-menu <input>')
    .description('Parse restaurant menu from image, PDF, or text file')
    .option('-o, --output <file>', 'Output configuration file', 'parsed-menu.json')
    .option('-t, --business-type <type>', 'Business type (restaurant, cafe, bar, fastfood)', 'restaurant')
    .option('-l, --language <lang>', 'Primary language', 'de')
    .option('--languages <langs>', 'Supported languages (comma-separated)', 'de,en')
    .option('--restaurant-name <name>', 'Restaurant name override')
    .option('--vectron', 'Generate Vectron import file')
    .option('--csv', 'Generate CSV export')
    .option('--validate', 'Validate generated configuration')
    .option('--interactive', 'Interactive mode for corrections')
    .option('--confidence-threshold <threshold>', 'Minimum confidence threshold', '0.7')
    .option('--llm-provider <provider>', 'Preferred LLM provider (gemini, openai, anthropic)', 'gemini')
    .action(async (input, options) => {
      await parseMenuCommand(input, options);
    });

  // Interactive menu setup wizard
  mainProgram
    .command('menu-wizard')
    .description('Interactive wizard for menu parsing and configuration')
    .action(async () => {
      await menuWizard();
    });

  // Batch processing command
  mainProgram
    .command('parse-menu-batch <directory>')
    .description('Parse multiple menu files from directory')
    .option('-o, --output-dir <dir>', 'Output directory', './parsed-menus')
    .option('--pattern <pattern>', 'File pattern (glob)', '*.{jpg,jpeg,png,pdf,txt}')
    .option('--parallel <number>', 'Number of parallel processing', '3')
    .action(async (directory, options) => {
      await batchParseMenus(directory, options);
    });

  // Menu correction command
  mainProgram
    .command('correct-menu <config>')
    .description('Interactive correction of parsed menu configuration')
    .action(async (config) => {
      await correctMenuInteractive(config);
    });
}

/**
 * Основная команда парсинга меню
 */
async function parseMenuCommand(input, options) {
  console.log(chalk.blue('🍽️  eckasse Menu Parser v2.0.0\n'));

  const spinner = ora('Initializing menu parser...').start();

  try {
    // Check if input file exists
    await fs.access(input);
    
    // Initialize parser
    const parser = new MenuParserLLM({
      businessType: options.businessType,
      defaultLanguage: options.language,
      supportedLanguages: options.languages.split(','),
      enableValidation: options.validate
    });

    spinner.text = 'Extracting text from menu...';
    
    // Parse menu
    const parseOptions = {
      businessType: options.businessType,
      language: options.language,
      restaurantName: options.restaurantName
    };

    const result = await parser.parseMenu(input, parseOptions);
    
    spinner.succeed('Menu parsed successfully!');

    // Display results
    console.log(chalk.green('\n📊 Parsing Results:'));
    console.log(`   Items found: ${chalk.bold(result.metadata.itemsFound)}`);
    console.log(`   Categories: ${chalk.bold(result.metadata.categoriesFound)}`);
    console.log(`   Confidence: ${chalk.bold((result.metadata.confidence * 100).toFixed(1))}%`);
    console.log(`   Language: ${chalk.bold(result.metadata.language)}`);

    // Check confidence threshold
    if (result.metadata.confidence < parseFloat(options.confidenceThreshold)) {
      console.log(chalk.yellow(`\n⚠️  Warning: Confidence below threshold (${options.confidenceThreshold})`));
      
      if (options.interactive) {
        const { proceed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: 'Confidence is low. Do you want to review and correct the results?',
          default: true
        }]);

        if (proceed) {
          await interactiveCorrection(result.configuration);
        }
      }
    }

    // Save main configuration
    await fs.writeFile(options.output, JSON.stringify(result.configuration, null, 2));
    console.log(chalk.green(`\n💾 Configuration saved: ${options.output}`));

    // Generate additional formats
    if (options.vectron) {
      await generateVectronExport(result.configuration, options.output);
    }

    if (options.csv) {
      await generateCSVExport(result.configuration, options.output);
    }

    // Validate if requested
    if (options.validate) {
      await validateConfiguration(result.configuration);
    }

    // Success summary
    console.log(chalk.green('\n✅ Menu parsing completed successfully!'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('  1. Review the generated configuration'));
    console.log(chalk.gray('  2. Make any necessary adjustments'));
    console.log(chalk.gray('  3. Deploy to your POS system'));

  } catch (error) {
    spinner.fail('Menu parsing failed');
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    
    if (error.message.includes('API key')) {
      console.log(chalk.yellow('\n💡 Tip: Make sure to set your LLM API keys:'));
      console.log(chalk.gray('   export GEMINI_API_KEY=your_api_key'));
      console.log(chalk.gray('   export OPENAI_API_KEY=your_api_key'));
      console.log(chalk.gray('   export ANTHROPIC_API_KEY=your_api_key'));
    }
    
    process.exit(1);
  }
}

/**
 * Интерактивный мастер настройки меню
 */
async function menuWizard() {
  console.log(chalk.blue('🧙 eckasse Menu Parsing Wizard\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'inputFile',
      message: 'Path to your menu file (image, PDF, or text):',
      validate: async (input) => {
        try {
          await fs.access(input);
          return true;
        } catch {
          return 'File not found. Please provide a valid file path.';
        }
      }
    },
    {
      type: 'input',
      name: 'restaurantName',
      message: 'Restaurant name:',
      default: 'My Restaurant'
    },
    {
      type: 'list',
      name: 'businessType',
      message: 'Business type:',
      choices: [
        { name: '🍽️  Restaurant (Fine Dining)', value: 'restaurant' },
        { name: '☕  Café', value: 'cafe' },
        { name: '🍺  Bar/Pub', value: 'bar' },
        { name: '🍟  Fast Food', value: 'fastfood' },
        { name: '🍕  Pizzeria', value: 'pizzeria' },
        { name: '🥡  Asian Restaurant', value: 'asian' },
        { name: '🌮  Mexican Restaurant', value: 'mexican' }
      ]
    },
    {
      type: 'list',
      name: 'language',
      message: 'Primary language:',
      choices: [
        { name: '🇩🇪  Deutsch', value: 'de' },
        { name: '🇺🇸  English', value: 'en' },
        { name: '🇫🇷  Français', value: 'fr' },
        { name: '🇪🇸  Español', value: 'es' },
        { name: '🇮🇹  Italiano', value: 'it' }
      ]
    },
    {
      type: 'checkbox',
      name: 'additionalLanguages',
      message: 'Additional languages (optional):',
      choices: [
        { name: '🇩🇪  Deutsch', value: 'de' },
        { name: '🇺🇸  English', value: 'en' },
        { name: '🇫🇷  Français', value: 'fr' },
        { name: '🇪🇸  Español', value: 'es' },
        { name: '🇮🇹  Italiano', value: 'it' }
      ]
    },
    {
      type: 'list',
      name: 'llmProvider',
      message: 'Preferred AI provider:',
      choices: [
        { name: '🤖  Google Gemini (Recommended)', value: 'gemini' },
        { name: '🧠  OpenAI GPT', value: 'openai' },
        { name: '🎭  Anthropic Claude', value: 'anthropic' }
      ]
    },
    {
      type: 'confirm',
      name: 'generateVectron',
      message: 'Generate Vectron Commander import file?',
      default: true
    },
    {
      type: 'confirm',
      name: 'interactiveCorrection',
      message: 'Enable interactive correction if confidence is low?',
      default: true
    },
    {
      type: 'input',
      name: 'outputFile',
      message: 'Output file name:',
      default: (answers) => `${answers.restaurantName.toLowerCase().replace(/\s+/g, '-')}-config.json`
    }
  ]);

  // Prepare languages
  const supportedLanguages = [answers.language, ...answers.additionalLanguages].filter((lang, index, array) => array.indexOf(lang) === index);

  // Run parsing
  const options = {
    output: answers.outputFile,
    businessType: answers.businessType,
    language: answers.language,
    languages: supportedLanguages.join(','),
    restaurantName: answers.restaurantName,
    vectron: answers.generateVectron,
    interactive: answers.interactiveCorrection,
    llmProvider: answers.llmProvider
  };

  await parseMenuCommand(answers.inputFile, options);
}

/**
 * Пакетная обработка меню
 */
async function batchParseMenus(directory, options) {
  console.log(chalk.blue('📁 Batch Menu Processing\n'));

  const glob = require('glob');
  const path = require('path');

  try {
    // Find all menu files
    const files = glob.sync(path.join(directory, options.pattern));
    
    if (files.length === 0) {
      console.log(chalk.yellow('No menu files found in directory.'));
      return;
    }

    console.log(chalk.green(`Found ${files.length} menu files to process\n`));

    // Create output directory
    await fs.mkdir(options.outputDir, { recursive: true });

    // Process files in parallel batches
    const parallelLimit = parseInt(options.parallel);
    const results = [];

    for (let i = 0; i < files.length; i += parallelLimit) {
      const batch = files.slice(i, i + parallelLimit);
      
      console.log(chalk.blue(`Processing batch ${Math.floor(i/parallelLimit) + 1}/${Math.ceil(files.length/parallelLimit)}...`));

      const batchPromises = batch.map(async (file) => {
        try {
          const basename = path.basename(file, path.extname(file));
          const outputFile = path.join(options.outputDir, `${basename}-config.json`);
          
          const parser = new MenuParserLLM();
          const result = await parser.parseMenu(file);
          
          await fs.writeFile(outputFile, JSON.stringify(result.configuration, null, 2));
          
          return {
            file,
            outputFile,
            success: true,
            items: result.metadata.itemsFound,
            confidence: result.metadata.confidence
          };
        } catch (error) {
          return {
            file,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Show batch progress
      batchResults.forEach(result => {
        if (result.success) {
          console.log(chalk.green(`  ✅ ${path.basename(result.file)} → ${result.items} items (${(result.confidence * 100).toFixed(1)}%)`));
        } else {
          console.log(chalk.red(`  ❌ ${path.basename(result.file)} → ${result.error}`));
        }
      });
    }

    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(chalk.green(`\n✅ Batch processing completed!`));
    console.log(`   Successful: ${successful.length}/${results.length}`);
    console.log(`   Failed: ${failed.length}/${results.length}`);
    console.log(`   Output directory: ${options.outputDir}`);

    if (failed.length > 0) {
      console.log(chalk.yellow('\n⚠️  Failed files:'));
      failed.forEach(result => {
        console.log(chalk.red(`   ${path.basename(result.file)}: ${result.error}`));
      });
    }

  } catch (error) {
    console.error(chalk.red(`Batch processing failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Интерактивная коррекция конфигурации
 */
async function interactiveCorrection(configuration) {
  console.log(chalk.blue('\n🔧 Interactive Menu Correction\n'));

  const device = configuration.company_details.branches[0].point_of_sale_devices[0];
  const categories = device.categories_for_this_pos;
  const items = device.items_for_this_pos;

  // Review categories
  console.log(chalk.yellow('📂 Categories Review:'));
  for (const category of categories) {
    const categoryName = category.category_names[Object.keys(category.category_names)[0]];
    console.log(`   ${category.category_unique_identifier}. ${categoryName} (${category.category_type})`);
  }

  const { reviewCategories } = await inquirer.prompt([{
    type: 'confirm',
    name: 'reviewCategories',
    message: 'Do you want to modify categories?',
    default: false
  }]);

  if (reviewCategories) {
    // Category modification logic here
    console.log(chalk.gray('Category modification not implemented in this demo'));
  }

  // Review items
  console.log(chalk.yellow('\n📋 Items Review (showing first 10):'));
  items.slice(0, 10).forEach(item => {
    const itemName = item.display_names.menu[Object.keys(item.display_names.menu)[0]];
    console.log(`   ${item.item_unique_identifier}. ${itemName} - €${item.item_price_value}`);
  });

  const { reviewItems } = await inquirer.prompt([{
    type: 'confirm',
    name: 'reviewItems',
    message: 'Do you want to modify items?',
    default: false
  }]);

  if (reviewItems) {
    // Item modification logic here
    console.log(chalk.gray('Item modification not implemented in this demo'));
  }

  console.log(chalk.green('\n✅ Interactive correction completed!'));
}

/**
 * Генерация Vectron экспорта
 */
async function generateVectronExport(configuration, outputPath) {
  try {
    const VectronConverter = require('./vectron-converter');
    const converter = new VectronConverter();
    const vectronData = converter.convert(configuration);
    
    const vectronPath = outputPath.replace('.json', '-vectron.txt');
    await fs.writeFile(vectronPath, vectronData);
    
    console.log(chalk.green(`🔄 Vectron import file: ${vectronPath}`));
  } catch (error) {
    console.log(chalk.red(`Failed to generate Vectron export: ${error.message}`));
  }
}

/**
 * Генерация CSV экспорта
 */
async function generateCSVExport(configuration, outputPath) {
  try {
    const device = configuration.company_details.branches[0].point_of_sale_devices[0];
    const items = device.items_for_this_pos;
    
    const csv = ['ID,Name,Price,Category,Type'].concat(
      items.map(item => {
        const name = item.display_names.menu[Object.keys(item.display_names.menu)[0]];
        const category = device.categories_for_this_pos.find(c => c.category_unique_identifier === item.associated_category_unique_identifier);
        const categoryName = category ? category.category_names[Object.keys(category.category_names)[0]] : 'Unknown';
        
        return `${item.item_unique_identifier},"${name}",${item.item_price_value},"${categoryName}",${category?.category_type || 'other'}`;
      })
    ).join('\n');
    
    const csvPath = outputPath.replace('.json', '.csv');
    await fs.writeFile(csvPath, csv);
    
    console.log(chalk.green(`📊 CSV export file: ${csvPath}`));
  } catch (error) {
    console.log(chalk.red(`Failed to generate CSV export: ${error.message}`));
  }
}

/**
 * Валидация конфигурации
 */
async function validateConfiguration(configuration) {
  try {
    const Ajv = require('ajv');
    const addFormats = require('ajv-formats');
    
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    
    // Load schema
    const schemaPath = path.join(__dirname, '..', 'schemas', 'v2.0.0', 'schema.json');
    const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
    
    const validate = ajv.compile(schema);
    const valid = validate(configuration);
    
    if (valid) {