/**
 * Migration Script: OOP-POS-MDF v1.0.0 → v2.0.0
 * 
 * This script migrates the POS configuration from version 1.0.0 to 2.0.0
 * Main changes:
 * - Convert single-language strings to multilingual objects
 * - Add audit trails to all entities
 * - Add enhanced security settings
 * - Add promotion and workflow systems
 * - Add performance optimization settings
 * 
 * @author eckasse Migration Tool
 * @version 2.0.0
 */

class Migration_1_0_0_to_2_0_0 {
  constructor(options = {}) {
    this.defaultLanguage = options.defaultLanguage || 'de';
    this.supportedLanguages = options.supportedLanguages || ['de', 'en'];
    this.migrationUser = options.migrationUser || 'migration@eckasse.com';
    this.migrationTimestamp = new Date().toISOString();
    this.warnings = [];
    this.errors = [];
  }

  /**
   * Main migration function
   */
  migrate(oldConfig) {
    try {
      console.log('🚀 Starting migration from v1.0.0 to v2.0.0...');
      
      // Validate input format
      this.validateInput(oldConfig);
      
      // Create new config structure
      const newConfig = this.createNewConfigStructure(oldConfig);
      
      // Migrate core data
      this.migrateCompanyDetails(oldConfig, newConfig);
      this.migrateGlobalConfigurations(oldConfig, newConfig);
      this.migrateBranches(oldConfig, newConfig);
      
      // Add new features
      this.addEnhancedFeatures(newConfig);
      
      // Validate output
      this.validateOutput(newConfig);
      
      console.log('✅ Migration completed successfully!');
      if (this.warnings.length > 0) {
        console.warn(`⚠️  ${this.warnings.length} warnings generated during migration:`);
        this.warnings.forEach(warning => console.warn(`   - ${warning}`));
      }
      
      return {
        success: true,
        config: newConfig,
        warnings: this.warnings,
        errors: this.errors
      };
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      this.errors.push(error.message);
      return {
        success: false,
        config: null,
        warnings: this.warnings,
        errors: this.errors
      };
    }
  }

  /**
   * Validate input configuration
   */
  validateInput(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid input configuration');
    }
    
    if (!config.company_details) {
      throw new Error('Missing company_details in configuration');
    }
    
    if (!config.company_details.meta_information?.format_version) {
      throw new Error('Missing format_version in meta_information');
    }
    
    if (config.company_details.meta_information.format_version !== '1.0.0') {
      throw new Error(`Expected version 1.0.0, got ${config.company_details.meta_information.format_version}`);
    }
  }

  /**
   * Create new configuration structure
   */
  createNewConfigStructure(oldConfig) {
    return {
      "$schema": "https://schemas.eckasse.com/oop-pos-mdf/v2.0.0/schema.json",
      company_details: {
        company_unique_identifier: oldConfig.company_details.company_unique_identifier,
        company_full_name: oldConfig.company_details.company_full_name,
        meta_information: {
          format_version: "2.0.0",
          previous_versions: ["1.0.0"],
          schema_validation: {
            required_fields: ["company_unique_identifier", "branches"],
            field_constraints: {
              pos_device_external_number: {"type": "integer", "min": 1, "max": 9999},
              item_price_value: {"type": "decimal", "precision": 2, "min": 0},
              category_unique_identifier: {"type": "integer", "min": 1}
            }
          },
          migration_info: {
            from_version: "1.0.0",
            migration_scripts: [{
              from_version: "1.0.0",
              to_version: "2.0.0",
              migration_script: "/migrations/1.0.0-to-2.0.0.js",
              description: "Added multilingual support, audit trails, and enhanced security",
              breaking_changes: [
                "display_names now object instead of string",
                "added required audit_trail for items"
              ]
            }],
            backward_compatibility: ["1.0.x"],
            auto_migration: true
          },
          date_generated: this.migrationTimestamp,
          generated_by: "eckasse-migration-tool-v2.0.0",
          default_currency_symbol: oldConfig.company_details.meta_information.default_currency_symbol || "€",
          default_language: this.defaultLanguage,
          supported_languages: this.supportedLanguages,
          audit_trail: this.createAuditTrail("config_migration", "Migrated from v1.0.0 to v2.0.0")
        },
        global_configurations: {},
        branches: []
      }
    };
  }

  /**
   * Migrate company details
   */
  migrateCompanyDetails(oldConfig, newConfig) {
    // Copy over existing meta information
    const oldMeta = oldConfig.company_details.meta_information;
    Object.assign(newConfig.company_details.meta_information, {
      date_generated: oldMeta.date_generated || this.migrationTimestamp,
      default_currency_symbol: oldMeta.default_currency_symbol || "€"
    });
  }

  /**
   * Migrate global configurations
   */
  migrateGlobalConfigurations(oldConfig, newConfig) {
    const oldGlobal = oldConfig.company_details.global_configurations || {};
    const newGlobal = newConfig.company_details.global_configurations;

    // Migrate tax rates
    if (oldGlobal.tax_rates_definitions) {
      newGlobal.tax_rates_definitions = oldGlobal.tax_rates_definitions.map(tax => ({
        ...tax,
        tax_rate_names: this.convertToMultilingual(tax.tax_rate_name),
        valid_from: "2024-01-01",
        valid_until: null
      }));
    }

    // Migrate main groups
    if (oldGlobal.main_groups_definitions) {
      newGlobal.main_groups_definitions = oldGlobal.main_groups_definitions.map(group => ({
        ...group,
        main_group_names: this.convertToMultilingual(group.main_group_name)
      }));
    }

    // Migrate payment methods
    if (oldGlobal.payment_methods_definitions) {
      newGlobal.payment_methods_definitions = oldGlobal.payment_methods_definitions.map(payment => ({
        ...payment,
        payment_method_names: this.convertToMultilingual(payment.payment_method_name)
      }));
    }

    // Migrate print profiles
    if (oldGlobal.print_format_profiles_definitions) {
      newGlobal.print_format_profiles_definitions = oldGlobal.print_format_profiles_definitions.map(profile => ({
        ...profile,
        profile_names: this.convertToMultilingual(profile.profile_name)
      }));
    }

    // Migrate customer display profiles
    if (oldGlobal.customer_display_layout_profiles_definitions) {
      newGlobal.customer_display_layout_profiles_definitions = oldGlobal.customer_display_layout_profiles_definitions.map(profile => {
        const newProfile = {
          ...profile,
          profile_names: this.convertToMultilingual(profile.profile_name)
        };
        
        // Convert welcome_text to multilingual if exists
        if (profile.settings?.welcome_text) {
          newProfile.settings.welcome_texts = this.convertToMultilingual(profile.settings.welcome_text);
          delete newProfile.settings.welcome_text;
        }
        
        return newProfile;
      });
    }

    // Add default promotions (empty for now)
    newGlobal.promotions_definitions = [];
    
    // Add default workflows
    newGlobal.workflows = [
      {
        workflow_id: "daily_closing",
        name: "Täglicher Kassenschluss",
        trigger: {"type": "schedule", "time": "23:30"},
        actions: [
          {"type": "generate_z_report"},
          {"type": "backup_data"},
          {"type": "sync_to_cloud"}
        ],
        is_active: true
      }
    ];

    // Add default integrations
    newGlobal.integrations = {
      accounting_system: {
        provider: "none",
        is_enabled: false
      },
      inventory_management: {
        provider: "none",
        is_enabled: false
      },
      loyalty_program: {
        provider: "none",
        is_enabled: false
      }
    };

    // Add security settings
    newGlobal.security_settings = {
      encryption: {
        at_rest: true,
        in_transit: true,
        algorithm: "AES-256"
      },
      access_control: {
        session_timeout: 3600,
        max_failed_attempts: 3,
        lockout_duration: 900,
        require_2fa: false
      },
      data_privacy: {
        gdpr_compliance: true,
        data_retention_days: 2555,
        anonymization_rules: []
      }
    };
  }

  /**
   * Migrate branches
   */
  migrateBranches(oldConfig, newConfig) {
    if (!oldConfig.company_details.branches) {
      this.warnings.push('No branches found in old configuration');
      return;
    }

    newConfig.company_details.branches = oldConfig.company_details.branches.map(branch => {
      const newBranch = {
        branch_unique_identifier: branch.branch_unique_identifier,
        branch_names: this.convertToMultilingual(branch.branch_name),
        branch_address: branch.branch_address,
        point_of_sale_devices: []
      };

      // Migrate POS devices
      if (branch.point_of_sale_devices) {
        newBranch.point_of_sale_devices = branch.point_of_sale_devices.map(device => 
          this.migratePOSDevice(device)
        );
      }

      return newBranch;
    });
  }

  /**
   * Migrate a single POS device
   */
  migratePOSDevice(oldDevice) {
    const newDevice = {
      pos_device_unique_identifier: oldDevice.pos_device_unique_identifier,
      pos_device_names: this.convertToMultilingual(oldDevice.pos_device_name),
      pos_device_type: oldDevice.pos_device_type,
      pos_device_external_number: oldDevice.pos_device_external_number,
      pos_device_settings: {
        ...oldDevice.pos_device_settings,
        performance: {
          cache_settings: {
            items_cache_ttl: 3600,
            categories_cache_ttl: 7200,
            preload_popular_items: true,
            max_cache_size_mb: 256
          },
          ui_optimization: {
            lazy_load_images: true,
            debounce_search_ms: 300,
            virtual_scrolling: true
          }
        }
      }
    };

    // Migrate hardware interfaces
    if (oldDevice.hardware_interfaces) {
      newDevice.hardware_interfaces = oldDevice.hardware_interfaces.map(iface => ({
        ...iface,
        interface_names: this.convertToMultilingual(iface.interface_name)
      }));
    }

    // Migrate built-in displays
    if (oldDevice.built_in_displays) {
      newDevice.built_in_displays = oldDevice.built_in_displays.map(display => 
        this.migrateDisplay(display)
      );
    }

    // Migrate connected peripherals
    if (oldDevice.connected_peripherals) {
      newDevice.connected_peripherals = oldDevice.connected_peripherals.map(peripheral => ({
        ...peripheral,
        peripheral_names: this.convertToMultilingual(peripheral.peripheral_name)
      }));
    }

    // Migrate categories
    if (oldDevice.categories_for_this_pos) {
      newDevice.categories_for_this_pos = oldDevice.categories_for_this_pos.map(category => ({
        ...category,
        category_names: this.convertToMultilingual(category.category_name_full),
        audit_trail: this.createAuditTrail("category_migration", "Migrated from v1.0.0")
      }));
    }

    // Migrate items
    if (oldDevice.items_for_this_pos) {
      newDevice.items_for_this_pos = oldDevice.items_for_this_pos.map(item => 
        this.migrateItem(item)
      );
    }

    return newDevice;
  }

  /**
   * Migrate display configuration
   */
  migrateDisplay(oldDisplay) {
    const newDisplay = {
      ...oldDisplay,
      display_names: this.convertToMultilingual(oldDisplay.display_name)
    };

    // Migrate display activities
    if (oldDisplay.display_activities) {
      newDisplay.display_activities = oldDisplay.display_activities.map(activity => {
        const newActivity = {
          ...activity,
          activity_names: this.convertToMultilingual(activity.activity_name)
        };

        // Migrate UI elements
        if (activity.user_interface_elements) {
          newActivity.user_interface_elements = activity.user_interface_elements.map(element => {
            const newElement = { ...element };

            // Migrate button configurations
            if (element.button_configurations) {
              newElement.button_configurations = element.button_configurations.map(button => ({
                ...button,
                button_texts: this.convertToMultilingual(button.button_text_on_display)
              }));
            }

            // Migrate button text content
            if (element.button_text_content) {
              newElement.button_texts = this.convertToMultilingual(element.button_text_content);
              delete newElement.button_text_content;
            }

            return newElement;
          });
        }

        return newActivity;
      });
    }

    return newDisplay;
  }

  /**
   * Migrate a single item
   */
  migrateItem(oldItem) {
    const newItem = {
      item_unique_identifier: oldItem.item_unique_identifier,
      display_names: {
        menu: this.convertToMultilingual(oldItem.menu_display_name),
        button: this.convertToMultilingual(oldItem.button_display_name),
        receipt: this.convertToMultilingual(oldItem.receipt_print_name)
      },
      item_price_value: oldItem.item_price_value,
      pricing_schedules: [], // Empty for now, can be populated later
      availability_schedule: {
        always_available: true,
        schedules: []
      },
      associated_category_unique_identifier: oldItem.associated_category_unique_identifier,
      additional_item_attributes: oldItem.additional_item_attributes || {},
      item_flags: {
        ...oldItem.item_flags,
        requires_age_verification: false,
        is_organic: false
      },
      audit_trail: this.createAuditTrail("item_migration", "Migrated from v1.0.0")
    };

    return newItem;
  }

  /**
   * Add enhanced features that weren't in v1.0.0
   */
  addEnhancedFeatures(newConfig) {
    // Add sample promotion
    newConfig.company_details.global_configurations.promotions_definitions.push({
      promotion_id: "sample_promotion",
      names: this.convertToMultilingual("Sample Promotion"),
      type: "percentage_discount",
      conditions: {
        min_quantity: 1,
        applicable_categories: [],
        applicable_items: []
      },
      discount: {
        type: "percentage",
        value: 10.0,
        max_discount_amount: 5.00
      },
      validity: {
        start_date: "2024-01-01",
        end_date: "2024-12-31",
        days_of_week: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        time_range: {"start": "16:00", "end": "18:00"}
      },
      is_active: false
    });
  }

  /**
   * Convert single language string to multilingual object
   */
  convertToMultilingual(text, fallbackText = "") {
    if (typeof text !== 'string') {
      text = fallbackText || "Unnamed";
      this.warnings.push(`Invalid text value, using fallback: "${text}"`);
    }

    const result = {};
    result[this.defaultLanguage] = text;
    
    // Add other supported languages with same text for now
    this.supportedLanguages.forEach(lang => {
      if (lang !== this.defaultLanguage) {
        result[lang] = text; // In real migration, you might want translation
      }
    });
    
    return result;
  }

  /**
   * Create audit trail object
   */
  createAuditTrail(action, description = "") {
    return {
      created_at: this.migrationTimestamp,
      created_by: this.migrationUser,
      last_modified_at: this.migrationTimestamp,
      last_modified_by: this.migrationUser,
      version: 1,
      change_log: [{
        timestamp: this.migrationTimestamp,
        user: this.migrationUser,
        action: action,
        description: description,
        affected_components: ["all"]
      }]
    };
  }

  /**
   * Validate output configuration
   */
  validateOutput(config) {
    // Basic validation
    if (!config.$schema) {
      throw new Error('Missing $schema in output configuration');
    }
    
    if (config.company_details.meta_information.format_version !== '2.0.0') {
      throw new Error('Output configuration version mismatch');
    }
    
    // Validate required multilingual fields
    const branches = config.company_details.branches || [];
    branches.forEach((branch, branchIndex) => {
      if (!branch.branch_names || typeof branch.branch_names !== 'object') {
        throw new Error(`Branch ${branchIndex} missing multilingual branch_names`);
      }
      
      const devices = branch.point_of_sale_devices || [];
      devices.forEach((device, deviceIndex) => {
        if (!device.pos_device_names || typeof device.pos_device_names !== 'object') {
          throw new Error(`Device ${deviceIndex} in branch ${branchIndex} missing multilingual pos_device_names`);
        }
        
        const items = device.items_for_this_pos || [];
        items.forEach((item, itemIndex) => {
          if (!item.display_names || !item.display_names.menu || !item.display_names.button || !item.display_names.receipt) {
            throw new Error(`Item ${itemIndex} in device ${deviceIndex} missing complete multilingual display_names`);
          }
          
          if (!item.audit_trail) {
            throw new Error(`Item ${itemIndex} in device ${deviceIndex} missing audit_trail`);
          }
        });
      });
    });
    
    console.log('✅ Output validation passed');
  }
}

// Export for use in Node.js or browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Migration_1_0_0_to_2_0_0;
} else if (typeof window !== 'undefined') {
  window.Migration_1_0_0_to_2_0_0 = Migration_1_0_0_to_2_0_0;
}

// Example usage:
/*
const migrator = new Migration_1_0_0_to_2_0_0({
  defaultLanguage: 'de',
  supportedLanguages: ['de', 'en', 'fr'],
  migrationUser: 'admin@hummusandmore.de'
});

const oldConfig = // ... load your v1.0.0 config
const result = migrator.migrate(oldConfig);

if (result.success) {
  console.log('Migration successful!');
  // Save result.config
} else {
  console.error('Migration failed:', result.errors);
}
*/