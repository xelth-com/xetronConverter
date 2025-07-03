/**
 * Test Suite for OOP-POS-MDF Migration System
 * 
 * Tests migration functionality, validation, and data integrity
 * 
 * @author eckasse Test Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const Migration_1_0_0_to_2_0_0 = require('../migrations/1.0.0-to-2.0.0.js');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

describe('OOP-POS-MDF Migration System', () => {
  let migrator;
  let ajv;
  let v1Schema;
  let v2Schema;
  let sampleV1Config;

  beforeAll(async () => {
    // Initialize AJV validator
    ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);

    // Load schemas
    try {
      const v1SchemaPath = path.join(__dirname, '../schemas/v1.0.0/schema.json');
      const v2SchemaPath = path.join(__dirname, '../schemas/v2.0.0/schema.json');
      
      if (fs.existsSync(v1SchemaPath)) {
        v1Schema = JSON.parse(fs.readFileSync(v1SchemaPath, 'utf8'));
      }
      if (fs.existsSync(v2SchemaPath)) {
        v2Schema = JSON.parse(fs.readFileSync(v2SchemaPath, 'utf8'));
      }
    } catch (error) {
      console.warn('Schema files not found, skipping schema validation tests');
    }

    // Initialize migrator
    migrator = new Migration_1_0_0_to_2_0_0({
      defaultLanguage: 'de',
      supportedLanguages: ['de', 'en', 'fr'],
      migrationUser: 'test@eckasse.com'
    });

    // Load sample v1.0.0 configuration
    sampleV1Config = {
      company_details: {
        company_unique_identifier: 1,
        company_full_name: "Test Restaurant GmbH",
        meta_information: {
          format_version: "1.0.0",
          date_generated: "2024-01-15",
          default_currency_symbol: "€"
        },
        global_configurations: {
          tax_rates_definitions: [
            {
              tax_rate_unique_identifier: 1,
              tax_rate_name: "Standard (19%)",
              rate_percentage: 19.0,
              fiscal_mapping_type: "NORMAL"
            },
            {
              tax_rate_unique_identifier: 2,
              tax_rate_name: "Reduced (7%)",
              rate_percentage: 7.0,
              fiscal_mapping_type: "REDUCED"
            }
          ],
          main_groups_definitions: [
            {
              main_group_unique_identifier: 1,
              main_group_name: "Getränke"
            },
            {
              main_group_unique_identifier: 2,
              main_group_name: "Speisen"
            }
          ],
          payment_methods_definitions: [
            {
              payment_method_unique_identifier: 1,
              payment_method_name: "Bar",
              payment_method_type: "CASH"
            }
          ]
        },
        branches: [
          {
            branch_unique_identifier: 1,
            branch_name: "Hauptfiliale",
            branch_address: "Teststraße 1, 12345 Teststadt",
            point_of_sale_devices: [
              {
                pos_device_unique_identifier: 1,
                pos_device_name: "Kasse 1",
                pos_device_type: "DESKTOP",
                pos_device_external_number: 1,
                pos_device_settings: {
                  default_currency_identifier: "€",
                  default_linked_drink_tax_rate_unique_identifier: 1,
                  default_linked_food_tax_rate_unique_identifier: 2
                },
                categories_for_this_pos: [
                  {
                    category_unique_identifier: 1,
                    category_name_full: "Getränke",
                    category_type: "drink",
                    parent_category_unique_identifier: null,
                    default_linked_main_group_unique_identifier: 1
                  },
                  {
                    category_unique_identifier: 2,
                    category_name_full: "Speisen",
                    category_type: "food",
                    parent_category_unique_identifier: null,
                    default_linked_main_group_unique_identifier: 2
                  }
                ],
                items_for_this_pos: [
                  {
                    item_unique_identifier: 1001,
                    menu_display_name: "Coca Cola",
                    button_display_name: "Cola",
                    receipt_print_name: "Coca Cola",
                    item_price_value: 2.50,
                    associated_category_unique_identifier: 1,
                    additional_item_attributes: {},
                    item_flags: {
                      is_sellable: true,
                      has_negative_price: false
                    }
                  },
                  {
                    item_unique_identifier: 2001,
                    menu_display_name: "Hamburger",
                    button_display_name: "Burger",
                    receipt_print_name: "Hamburger",
                    item_price_value: 8.50,
                    associated_category_unique_identifier: 2,
                    additional_item_attributes: {},
                    item_flags: {
                      is_sellable: true,
                      has_negative_price: false
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    };
  });

  describe('Migration Input Validation', () => {
    test('should reject null or undefined input', () => {
      expect(() => migrator.migrate(null)).toThrow('Invalid input configuration');
      expect(() => migrator.migrate(undefined)).toThrow('Invalid input configuration');
    });

    test('should reject invalid input structure', () => {
      expect(() => migrator.migrate({})).toThrow('Missing company_details');
      expect(() => migrator.migrate({ company_details: {} })).toThrow('Missing format_version');
    });

    test('should reject wrong version', () => {
      const wrongVersionConfig = {
        company_details: {
          meta_information: {
            format_version: "2.0.0"
          }
        }
      };
      expect(() => migrator.migrate(wrongVersionConfig)).toThrow('Expected version 1.0.0');
    });

    test('should accept valid v1.0.0 configuration', () => {
      expect(() => migrator.validateInput(sampleV1Config)).not.toThrow();
    });
  });

  describe('Core Migration Functionality', () => {
    let migrationResult;

    beforeAll(() => {
      migrationResult = migrator.migrate(sampleV1Config);
    });

    test('should complete migration successfully', () => {
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.config).toBeDefined();
      expect(migrationResult.errors).toHaveLength(0);
    });

    test('should update format version to 2.0.0', () => {
      const meta = migrationResult.config.company_details.meta_information;
      expect(meta.format_version).toBe('2.0.0');
      expect(meta.previous_versions).toContain('1.0.0');
    });

    test('should add schema reference', () => {
      expect(migrationResult.config.$schema).toBe('https://schemas.eckasse.com/oop-pos-mdf/v2.0.0/schema.json');
    });

    test('should preserve core company data', () => {
      const company = migrationResult.config.company_details;
      expect(company.company_unique_identifier).toBe(1);
      expect(company.company_full_name).toBe("Test Restaurant GmbH");
    });

    test('should add migration metadata', () => {
      const meta = migrationResult.config.company_details.meta_information;
      expect(meta.migration_info).toBeDefined();
      expect(meta.migration_info.from_version).toBe('1.0.0');
      expect(meta.migration_info.auto_migration).toBe(true);
    });

    test('should add audit trail to configuration', () => {
      const meta = migrationResult.config.company_details.meta_information;
      expect(meta.audit_trail).toBeDefined();
      expect(meta.audit_trail.created_at).toBeDefined();
      expect(meta.audit_trail.version).toBe(1);
    });
  });

  describe('Multilingual Support Migration', () => {
    let migrationResult;

    beforeAll(() => {
      migrationResult = migrator.migrate(sampleV1Config);
    });

    test('should convert tax rate names to multilingual', () => {
      const taxRates = migrationResult.config.company_details.global_configurations.tax_rates_definitions;
      expect(taxRates[0].tax_rate_names).toBeDefined();
      expect(taxRates[0].tax_rate_names.de).toBe("Standard (19%)");
      expect(taxRates[0].tax_rate_names.en).toBeDefined();
      expect(taxRates[0].tax_rate_name).toBeUndefined();
    });

    test('should convert main group names to multilingual', () => {
      const mainGroups = migrationResult.config.company_details.global_configurations.main_groups_definitions;
      expect(mainGroups[0].main_group_names).toBeDefined();
      expect(mainGroups[0].main_group_names.de).toBe("Getränke");
      expect(mainGroups[0].main_group_name).toBeUndefined();
    });

    test('should convert payment method names to multilingual', () => {
      const paymentMethods = migrationResult.config.company_details.global_configurations.payment_methods_definitions;
      expect(paymentMethods[0].payment_method_names).toBeDefined();
      expect(paymentMethods[0].payment_method_names.de).toBe("Bar");
      expect(paymentMethods[0].payment_method_name).toBeUndefined();
    });

    test('should convert branch names to multilingual', () => {
      const branches = migrationResult.config.company_details.branches;
      expect(branches[0].branch_names).toBeDefined();
      expect(branches[0].branch_names.de).toBe("Hauptfiliale");
      expect(branches[0].branch_name).toBeUndefined();
    });

    test('should convert category names to multilingual', () => {
      const categories = migrationResult.config.company_details.branches[0].point_of_sale_devices[0].categories_for_this_pos;
      expect(categories[0].category_names).toBeDefined();
      expect(categories[0].category_names.de).toBe("Getränke");
      expect(categories[0].category_name_full).toBeUndefined();
    });

    test('should convert item display names to multilingual structure', () => {
      const items = migrationResult.config.company_details.branches[0].point_of_sale_devices[0].items_for_this_pos;
      const item = items[0];
      
      expect(item.display_names).toBeDefined();
      expect(item.display_names.menu).toBeDefined();
      expect(item.display_names.button).toBeDefined();
      expect(item.display_names.receipt).toBeDefined();
      
      expect(item.display_names.menu.de).toBe("Coca Cola");
      expect(item.display_names.button.de).toBe("Cola");
      expect(item.display_names.receipt.de).toBe("Coca Cola");
      
      // Old fields should be removed
      expect(item.menu_display_name).toBeUndefined();
      expect(item.button_display_name).toBeUndefined();
      expect(item.receipt_print_name).toBeUndefined();
    });
  });

  describe('Enhanced Features Migration', () => {
    let migrationResult;

    beforeAll(() => {
      migrationResult = migrator.migrate(sampleV1Config);
    });

    test('should add audit trails to categories', () => {
      const categories = migrationResult.config.company_details.branches[0].point_of_sale_devices[0].categories_for_this_pos;
      categories.forEach(category => {
        expect(category.audit_trail).toBeDefined();
        expect(category.audit_trail.created_at).toBeDefined();
        expect(category.audit_trail.created_by).toBe('test@eckasse.com');
        expect(category.audit_trail.version).toBe(1);
      });
    });

    test('should add audit trails to items', () => {
      const items = migrationResult.config.company_details.branches[0].point_of_sale_devices[0].items_for_this_pos;
      items.forEach(item => {
        expect(item.audit_trail).toBeDefined();
        expect(item.audit_trail.created_at).toBeDefined();
        expect(item.audit_trail.created_by).toBe('test@eckasse.com');
        expect(item.audit_trail.version).toBe(1);
      });
    });

    test('should add pricing schedules to items', () => {
      const items = migrationResult.config.company_details.branches[0].point_of_sale_devices[0].items_for_this_pos;
      items.forEach(item => {
        expect(item.pricing_schedules).toBeDefined();
        expect(Array.isArray(item.pricing_schedules)).toBe(true);
      });
    });

    test('should add availability schedules to items', () => {
      const items = migrationResult.config.company_details.branches[0].point_of_sale_devices[0].items_for_this_pos;
      items.forEach(item => {
        expect(item.availability_schedule).toBeDefined();
        expect(item.availability_schedule.always_available).toBe(true);
      });
    });

    test('should add performance settings to POS devices', () => {
      const device = migrationResult.config.company_details.branches[0].point_of_sale_devices[0];
      expect(device.pos_device_settings.performance).toBeDefined();
      expect(device.pos_device_settings.performance.cache_settings).toBeDefined();
      expect(device.pos_device_settings.performance.ui_optimization).toBeDefined();
    });

    test('should add security settings', () => {
      const security = migrationResult.config.company_details.global_configurations.security_settings;
      expect(security).toBeDefined();
      expect(security.encryption).toBeDefined();
      expect(security.access_control).toBeDefined();
      expect(security.data_privacy).toBeDefined();
      expect(security.data_privacy.gdpr_compliance).toBe(true);
    });

    test('should add workflows', () => {
      const workflows = migrationResult.config.company_details.global_configurations.workflows;
      expect(workflows).toBeDefined();
      expect(Array.isArray(workflows)).toBe(true);
      expect(workflows.length).toBeGreaterThan(0);
    });

    test('should add integrations', () => {
      const integrations = migrationResult.config.company_details.global_configurations.integrations;
      expect(integrations).toBeDefined();
      expect(integrations.accounting_system).toBeDefined();
      expect(integrations.inventory_management).toBeDefined();
      expect(integrations.loyalty_program).toBeDefined();
    });
  });

  describe('Data Integrity', () => {
    test('should preserve all original items', () => {
      const result = migrator.migrate(sampleV1Config);
      const originalItems = sampleV1Config.company_details.branches[0].point_of_sale_devices[0].items_for_this_pos;
      const migratedItems = result.config.company_details.branches[0].point_of_sale_devices[0].items_for_this_pos;
      
      expect(migratedItems).toHaveLength(originalItems.length);
      
      originalItems.forEach((originalItem, index) => {
        const migratedItem = migratedItems[index];
        expect(migratedItem.item_unique_identifier).toBe(originalItem.item_unique_identifier);
        expect(migratedItem.item_price_value).toBe(originalItem.item_price_value);
        expect(migratedItem.associated_category_unique_identifier).toBe(originalItem.associated_category_unique_identifier);
      });
    });

    test('should preserve all original categories', () => {
      const result = migrator.migrate(sampleV1Config);
      const originalCategories = sampleV1Config.company_details.branches[0].point_of_sale_devices[0].categories_for_this_pos;
      const migratedCategories = result.config.company_details.branches[0].point_of_sale_devices[0].categories_for_this_pos;
      
      expect(migratedCategories).toHaveLength(originalCategories.length);
      
      originalCategories.forEach((originalCategory, index) => {
        const migratedCategory = migratedCategories[index];
        expect(migratedCategory.category_unique_identifier).toBe(originalCategory.category_unique_identifier);
        expect(migratedCategory.category_type).toBe(originalCategory.category_type);
      });
    });

    test('should maintain referential integrity', () => {
      const result = migrator.migrate(sampleV1Config);
      const device = result.config.company_details.branches[0].point_of_sale_devices[0];
      const categories = device.categories_for_this_pos;
      const items = device.items_for_this_pos;
      
      // Check that all item categories exist
      items.forEach(item => {
        const categoryExists = categories.some(cat => 
          cat.category_unique_identifier === item.associated_category_unique_identifier
        );
        expect(categoryExists).toBe(true);
      });
    });
  });

  describe('Schema Validation', () => {
    test('should produce v2.0.0 schema-compliant output', () => {
      if (!v2Schema) {
        console.warn('v2.0.0 schema not available, skipping validation test');
        return;
      }

      const result = migrator.migrate(sampleV1Config);
      const validate = ajv.compile(v2Schema);
      const valid = validate(result.config);
      
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      
      expect(valid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing optional fields gracefully', () => {
      const minimalConfig = {
        company_details: {
          company_unique_identifier: 1,
          company_full_name: "Minimal Company",
          meta_information: {
            format_version: "1.0.0"
          },
          branches: [
            {
              branch_unique_identifier: 1,
              branch_name: "Branch 1",
              point_of_sale_devices: [
                {
                  pos_device_unique_identifier: 1,
                  pos_device_name: "POS 1",
                  pos_device_type: "DESKTOP",
                  pos_device_external_number: 1,
                  categories_for_this_pos: [],
                  items_for_this_pos: []
                }
              ]
            }
          ]
        }
      };

      const result = migrator.migrate(minimalConfig);
      expect(result.success).toBe(true);
    });

    test('should collect warnings for problematic data', () => {
      const problematicConfig = JSON.parse(JSON.stringify(sampleV1Config));
      
      // Add some problematic data
      problematicConfig.company_details.branches[0].point_of_sale_devices[0].items_for_this_pos[0].menu_display_name = null;
      
      const result = migrator.migrate(problematicConfig);
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility', () => {
    test('should include backward compatibility information', () => {
      const result = migrator.migrate(sampleV1Config);
      const migration = result.config.company_details.meta_information.migration_info;
      
      expect(migration.backward_compatibility).toContain('1.0.x');
    });

    test('should document breaking changes', () => {
      const result = migrator.migrate(sampleV1Config);
      const migration = result.config.company_details.meta_information.migration_info;
      
      expect(migration.migration_scripts[0].breaking_changes).toBeDefined();
      expect(migration.migration_scripts[0].breaking_changes.length).toBeGreaterThan(0);
    });
  });
});

describe('Migration Performance', () => {
  test('should handle large configurations efficiently', () => {
    // Create a large configuration
    const largeConfig = JSON.parse(JSON.stringify(sampleV1Config));
    const device = largeConfig.company_details.branches[0].point_of_sale_devices[0];
    
    // Add many categories
    for (let i = 3; i <= 100; i++) {
      device.categories_for_this_pos.push({
        category_unique_identifier: i,
        category_name_full: `Category ${i}`,
        category_type: i % 2 === 0 ? 'food' : 'drink',
        parent_category_unique_identifier: null,
        default_linked_main_group_unique_identifier: i % 2 === 0 ? 2 : 1
      });
    }
    
    // Add many items
    for (let i = 3000; i <= 5000; i++) {
      device.items_for_this_pos.push({
        item_unique_identifier: i,
        menu_display_name: `Item ${i}`,
        button_display_name: `Item ${i}`,
        receipt_print_name: `Item ${i}`,
        item_price_value: Math.random() * 20 + 1,
        associated_category_unique_identifier: Math.floor(Math.random() * 100) + 1,
        additional_item_attributes: {},
        item_flags: {
          is_sellable: true,
          has_negative_price: false
        }
      });
    }

    const migrator = new Migration_1_0_0_to_2_0_0();
    const startTime = Date.now();
    const result = migrator.migrate(largeConfig);
    const endTime = Date.now();
    
    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  }, 10000); // 10 second timeout
});