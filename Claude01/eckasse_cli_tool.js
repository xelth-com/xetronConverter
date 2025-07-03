#!/usr/bin/env node

/**
 * eckasse CLI Tool
 * Command-line utility for managing eckasse POS configurations
 * 
 * Features:
 * - Validate configurations against JSON Schema
 * - Migrate between versions
 * - Generate sample configurations
 * - Convert between formats
 * 
 * @author eckasse Development Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const chalk = require('chalk');
const inquirer = require('inquirer');

// Import migration script
const Migration_1_0_0_to_2_0_0 = require('./migrations/1.0.0-to-2.0.0.js');

class EckasseCLI {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.schemas = new Map();
    this.migrations = new Map();
    
    // Register migrations
    this.migrations.set('1.0.0->2.0.0', Migration_1_0_0_to_2_0_0);
    
    this.initCLI();
  }

  initCLI() {
    program
      .name('eckasse')
      .description('CLI tool for managing eckasse POS configurations')
      .version('2.0.0');

    // Validate command
    program
      .command('validate <file>')
      .description('Validate a configuration file against JSON Schema')
      .option('-s, --schema <version>', 'Schema version to validate against', '2.0.0')
      .option('-v, --verbose', 'Show detailed validation results')
      .action((file, options) => {
        this.validateConfig(file, options);
      });

    // Migrate command
    program
      .command('migrate <file>')
      .description('Migrate configuration between versions')
      .option('-t, --target <version>', 'Target version', '2.0.0')
      .option('-o, --output <file>', 'Output file path')
      .option('-b, --backup', 'Create backup of original file')
      .option('--dry-run', 'Show migration preview without saving')
      .action((file, options) => {
        this.migrateConfig(file, options);
      });

    // Generate command
    program
      .command('generate')
      .description('Generate a sample configuration file')
      .option('-t, --type <type>', 'Configuration type', 'restaurant')
      .option('-v, --version <version>', 'Schema version', '2.0.0')
      .option('-o, --output <file>', 'Output file path', 'sample-config.json')
      .action((options) => {
        this.generateConfig(options);
      });

    // Convert command  
    program
      .command('convert <file>')
      .description('Convert configuration to different formats')
      .option('-f, --format <format>', 'Output format', 'vectron')
      .option('-o, --output <file>', 'Output file path')
      .action((file, options) => {
        this.convertConfig(file, options);
      });

    // Info command
    program
      .command('info <file>')
      .description('Show information about a configuration file')
      .action((file) => {
        this.showConfigInfo(file);
      });

    // Interactive setup
    program
      .command('setup')
      .description('Interactive setup wizard for new configuration')
      .action(() => {
        this.interactiveSetup();
      });

    program.parse();
  }

  /**
   * Load and cache JSON schema
   */
  async loadSchema(version) {
    if (this.schemas.has(version)) {
      return this.schemas.get(version);
    }

    const schemaPath = path.join(__dirname, 'schemas', `v${version}`, 'schema.json');
    
    try {
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      const schema = JSON.parse(schemaContent);
      this.schemas.set(version, schema);
      return schema;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to load schema v${version}: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Validate configuration file
   */
  async validateConfig(filePath, options) {
    console.log(chalk.blue(`🔍 Validating ${filePath} against schema v${options.schema}...`));

    try {
      // Load configuration
      const configContent = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(configContent);

      // Load schema
      const schema = await this.loadSchema(options.schema);
      const validate = this.ajv.compile(schema);

      // Validate
      const valid = validate(config);

      if (valid) {
        console.log(chalk.green('✅ Configuration is valid!'));
        
        if (options.verbose) {
          this.showConfigStats(config);
        }
      } else {
        console.log(chalk.red('❌ Configuration validation failed:'));
        
        validate.errors.forEach((error, index) => {
          console.log(chalk.red(`  ${index + 1}. ${error.instancePath || 'root'}: ${error.message}`));
          if (error.allowedValues) {
            console.log(chalk.gray(`     Allowed values: ${error.allowedValues.join(', ')}`));
          }
        });
        
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Migrate configuration
   */
  async migrateConfig(filePath, options) {
    console.log(chalk.blue(`🔄 Migrating ${filePath} to version ${options.target}...`));

    try {
      // Load configuration
      const configContent = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(configContent);

      // Detect current version
      const currentVersion = config.company_details?.meta_information?.format_version;
      if (!currentVersion) {
        throw new Error('Unable to detect current configuration version');
      }

      console.log(chalk.gray(`Current version: ${currentVersion}`));
      console.log(chalk.gray(`Target version: ${options.target}`));

      if (currentVersion === options.target) {
        console.log(chalk.yellow('⚠️  Configuration is already at target version'));
        return;
      }

      // Find migration path
      const migrationKey = `${currentVersion}->${options.target}`;
      const MigrationClass = this.migrations.get(migrationKey);

      if (!MigrationClass) {
        throw new Error(`No migration available from ${currentVersion} to ${options.target}`);
      }

      // Create backup if requested
      if (options.backup) {
        const backupPath = `${filePath}.backup.${Date.now()}`;
        fs.copyFileSync(filePath, backupPath);
        console.log(chalk.gray(`Backup created: ${backupPath}`));
      }

      // Run migration
      const migrator = new MigrationClass({
        defaultLanguage: 'de',
        supportedLanguages: ['de', 'en', 'fr'],
        migrationUser: 'cli@eckasse.com'
      });

      const result = migrator.migrate(config);

      if (!result.success) {
        console.error(chalk.red('❌ Migration failed:'));
        result.errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
        process.exit(1);
      }

      // Show warnings
      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`⚠️  ${result.warnings.length} warnings:`));
        result.warnings.forEach(warning => console.log(chalk.yellow(`  - ${warning}`)));
      }

      // Dry run or save
      if (options.dryRun) {
        console.log(chalk.blue('🔍 Dry run - showing migration preview:'));
        console.log(JSON.stringify(result.config, null, 2));
      } else {
        const outputPath = options.output || filePath;
        fs.writeFileSync(outputPath, JSON.stringify(result.config, null, 2));
        console.log(chalk.green(`✅ Migration completed successfully!`));
        console.log(chalk.gray(`Output saved to: ${outputPath}`));
      }

    } catch (error) {
      console.error(chalk.red(`❌ Migration failed: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Generate sample configuration
   */
  generateConfig(options) {
    console.log(chalk.blue(`🚀 Generating ${options.type} configuration v${options.version}...`));

    const config = this.createSampleConfig(options.type, options.version);
    
    fs.writeFileSync(options.output, JSON.stringify(config, null, 2));
    console.log(chalk.green(`✅ Sample configuration generated: ${options.output}`));
  }

  /**
   * Convert configuration to different format
   */
  async convertConfig(filePath, options) {
    console.log(chalk.blue(`🔄 Converting ${filePath} to ${options.format} format...`));

    try {
      const configContent = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(configContent);

      let convertedData;
      let outputExtension;

      switch (options.format.toLowerCase()) {
        case 'vectron':
          convertedData = this.convertToVectron(config);
          outputExtension = '.txt';
          break;
        case 'csv':
          convertedData = this.convertToCSV(config);
          outputExtension = '.csv';
          break;
        case 'xml':
          convertedData = this.convertToXML(config);
          outputExtension = '.xml';
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      const outputPath = options.output || filePath.replace(/\.[^/.]+$/, outputExtension);
      fs.writeFileSync(outputPath, convertedData);
      
      console.log(chalk.green(`✅ Conversion completed: ${outputPath}`));

    } catch (error) {
      console.error(chalk.red(`❌ Conversion failed: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Show configuration information
   */
  showConfigInfo(filePath) {
    console.log(chalk.blue(`📋 Configuration Information: ${filePath}`));

    try {
      const configContent = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(configContent);

      const meta = config.company_details?.meta_information;
      if (meta) {
        console.log(chalk.green('\n📊 Metadata:'));
        console.log(`  Version: ${meta.format_version}`);
        console.log(`  Generated: ${meta.date_generated}`);
        console.log(`  Default Language: ${meta.default_language}`);
        console.log(`  Supported Languages: ${meta.supported_languages?.join(', ')}`);
      }

      this.showConfigStats(config);

    } catch (error) {
      console.error(chalk.red(`❌ Error reading configuration: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Interactive setup wizard
   */
  async interactiveSetup() {
    console.log(chalk.blue('🧙 eckasse Configuration Setup Wizard\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'companyName',
        message: 'Company name:',
        default: 'My Restaurant'
      },
      {
        type: 'list',
        name: 'businessType',
        message: 'Business type:',
        choices: ['restaurant', 'retail', 'cafe', 'bar', 'other']
      },
      {
        type: 'list',
        name: 'defaultLanguage',
        message: 'Default language:',
        choices: ['de', 'en', 'fr', 'es', 'it']
      },
      {
        type: 'checkbox',
        name: 'supportedLanguages',
        message: 'Additional languages:',
        choices: ['de', 'en', 'fr', 'es', 'it'],
        validate: (input, answers) => {
          if (!input.includes(answers.defaultLanguage)) {
            input.push(answers.defaultLanguage);
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'posDeviceCount',
        message: 'Number of POS devices:',
        default: '1',
        validate: (input) => {
          const num = parseInt(input);
          return num > 0 && num <= 99 ? true : 'Please enter a number between 1 and 99';
        }
      },
      {
        type: 'input',
        name: 'outputFile',
        message: 'Output file path:',
        default: 'pos-config.json'
      }
    ]);

    console.log(chalk.blue('\n🚀 Generating configuration...'));

    const config = this.createCustomConfig(answers);
    fs.writeFileSync(answers.outputFile, JSON.stringify(config, null, 2));

    console.log(chalk.green(`✅ Configuration created: ${answers.outputFile}`));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  1. Review and customize the generated configuration'));
    console.log(chalk.gray('  2. Validate: eckasse validate pos-config.json'));
    console.log(chalk.gray('  3. Deploy to your POS system'));
  }

  /**
   * Show configuration statistics
   */
  showConfigStats(config) {
    console.log(chalk.green('\n📊 Configuration Statistics:'));

    const company = config.company_details;
    console.log(`  Company: ${company.company_full_name}`);
    console.log(`  Branches: ${company.branches?.length || 0}`);

    let totalDevices = 0;
    let totalCategories = 0;
    let totalItems = 0;

    company.branches?.forEach(branch => {
      const devices = branch.point_of_sale_devices?.length || 0;
      totalDevices += devices;

      branch.point_of_sale_devices?.forEach(device => {
        totalCategories += device.categories_for_this_pos?.length || 0;
        totalItems += device.items_for_this_pos?.length || 0;
      });
    });

    console.log(`  POS Devices: ${totalDevices}`);
    console.log(`  Categories: ${totalCategories}`);
    console.log(`  Items: ${totalItems}`);

    const globalConfig = company.global_configurations;
    if (globalConfig) {
      console.log(`  Tax Rates: ${globalConfig.tax_rates_definitions?.length || 0}`);
      console.log(`  Payment Methods: ${globalConfig.payment_methods_definitions?.length || 0}`);
      console.log(`  Promotions: ${globalConfig.promotions_definitions?.length || 0}`);
      console.log(`  Workflows: ${globalConfig.workflows?.length || 0}`);
    }
  }

  /**
   * Create sample configuration
   */
  createSampleConfig(type, version) {
    const timestamp = new Date().toISOString();
    
    return {
      "$schema": `https://schemas.eckasse.com/oop-pos-mdf/v${version}/schema.json`,
      company_details: {
        company_unique_identifier: 1,
        company_full_name: "Sample Company",
        meta_information: {
          format_version: version,
          date_generated: timestamp,
          generated_by: "eckasse-cli-v2.0.0",
          default_currency_symbol: "€",
          default_language: "de",
          supported_languages: ["de", "en"]
        },
        global_configurations: {
          tax_rates_definitions: [
            {
              tax_rate_unique_identifier: 1,
              tax_rate_names: { "de": "Standard (19%)", "en": "Standard (19%)" },
              rate_percentage: 19.0,
              fiscal_mapping_type: "NORMAL"
            }
          ],
          main_groups_definitions: [
            {
              main_group_unique_identifier: 1,
              main_group_names: { "de": "Hauptgruppe 1", "en": "Main Group 1" }
            }
          ],
          payment_methods_definitions: [
            {
              payment_method_unique_identifier: 1,
              payment_method_names: { "de": "Bar", "en": "Cash" },
              payment_method_type: "CASH"
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
            branch_names: { "de": "Hauptfiliale", "en": "Main Branch" },
            branch_address: "Sample Street 1, 12345 Sample City",
            point_of_sale_devices: [
              {
                pos_device_unique_identifier: 1,
                pos_device_names: { "de": "Kasse 1", "en": "POS 1" },
                pos_device_type: "DESKTOP",
                pos_device_external_number: 1,
                pos_device_settings: {
                  default_currency_identifier: "€",
                  default_linked_drink_tax_rate_unique_identifier: 1,
                  default_linked_food_tax_rate_unique_identifier: 1
                },
                categories_for_this_pos: [],
                items_for_this_pos: []
              }
            ]
          }
        ]
      }
    };
  }

  /**
   * Create custom configuration based on user input
   */
  createCustomConfig(answers) {
    const config = this.createSampleConfig(answers.businessType, '2.0.0');
    
    // Customize based on answers
    config.company_details.company_full_name = answers.companyName;
    config.company_details.meta_information.default_language = answers.defaultLanguage;
    config.company_details.meta_information.supported_languages = answers.supportedLanguages;

    // Add multiple POS devices if requested
    const deviceCount = parseInt(answers.posDeviceCount);
    const branch = config.company_details.branches[0];
    
    for (let i = 2; i <= deviceCount; i++) {
      const device = {
        pos_device_unique_identifier: i,
        pos_device_names: {},
        pos_device_type: "DESKTOP",
        pos_device_external_number: i,
        pos_device_settings: {
          default_currency_identifier: "€",
          default_linked_drink_tax_rate_unique_identifier: 1,
          default_linked_food_tax_rate_unique_identifier: 1
        },
        categories_for_this_pos: [],
        items_for_this_pos: []
      };

      // Add multilingual names
      answers.supportedLanguages.forEach(lang => {
        device.pos_device_names[lang] = lang === 'de' ? `Kasse ${i}` : `POS ${i}`;
      });

      branch.point_of_sale_devices.push(device);
    }

    return config;
  }

  /**
   * Convert to Vectron format
   */
  convertToVectron(config) {
    // This would integrate with the existing Vectron converter
    // For now, return a placeholder
    const lines = [];
    
    // Header line
    lines.push('100,0,1,1;10,1;24,A;51,1;');
    
    // Add PLU lines from items
    config.company_details.branches?.forEach(branch => {
      branch.point_of_sale_devices?.forEach(device => {
        device.items_for_this_pos?.forEach(item => {
          const name = item.display_names?.menu?.[config.company_details.meta_information.default_language] || 'Unknown Item';
          const price = item.item_price_value || 0;
          const category = item.associated_category_unique_identifier || 1;
          
          lines.push(`101,${item.item_unique_identifier},101,TX:"${name}";201,VA:${price.toFixed(2)};301,NR:${category};9001,NR:0`);
        });
      });
    });
    
    return lines.join('\r\n') + '\r\n';
  }

  /**
   * Convert to CSV format
   */
  convertToCSV(config) {
    const lines = ['ID,Name,Price,Category,Active'];
    
    config.company_details.branches?.forEach(branch => {
      branch.point_of_sale_devices?.forEach(device => {
        device.items_for_this_pos?.forEach(item => {
          const name = item.display_names?.menu?.[config.company_details.meta_information.default_language] || 'Unknown Item';
          const price = item.item_price_value || 0;
          const category = item.associated_category_unique_identifier || 1;
          const active = item.item_flags?.is_sellable ? 'Yes' : 'No';
          
          lines.push(`${item.item_unique_identifier},"${name}",${price},${category},${active}`);
        });
      });
    });
    
    return lines.join('\n');
  }

  /**
   * Convert to XML format
   */
  convertToXML(config) {
    const company = config.company_details;
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<pos-configuration>\n';
    xml += `  <company name="${company.company_full_name}" id="${company.company_unique_identifier}">\n`;
    
    company.branches?.forEach(branch => {
      xml += `    <branch name="${branch.branch_names?.[company.meta_information.default_language]}" id="${branch.branch_unique_identifier}">\n`;
      
      branch.point_of_sale_devices?.forEach(device => {
        xml += `      <device name="${device.pos_device_names?.[company.meta_information.default_language]}" id="${device.pos_device_unique_identifier}">\n`;
        xml += '        <items>\n';
        
        device.items_for_this_pos?.forEach(item => {
          const name = item.display_names?.menu?.[company.meta_information.default_language] || 'Unknown Item';
          xml += `          <item id="${item.item_unique_identifier}" name="${name}" price="${item.item_price_value}"/>\n`;
        });
        
        xml += '        </items>\n';
        xml += '      </device>\n';
      });
      
      xml += '    </branch>\n';
    });
    
    xml += '  </company>\n';
    xml += '</pos-configuration>\n';
    
    return xml;
  }
}

// Initialize CLI if this file is run directly
if (require.main === module) {
  new EckasseCLI();
}

module.exports = EckasseCLI;