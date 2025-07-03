/**
 * eckasse OOP-POS-MDF API Server
 * 
 * RESTful API for configuration management, validation, and migration
 * 
 * Features:
 * - Configuration CRUD operations
 * - Real-time validation
 * - Migration services
 * - Audit trail management
 * - Multi-tenant support
 * 
 * @author eckasse Development Team
 * @version 2.0.0
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const multer = require('multer');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Redis = require('redis');
const fs = require('fs').promises;
const path = require('path');

// Import our migration and validation modules
const Migration_1_0_0_to_2_0_0 = require('../migrations/1.0.0-to-2.0.0.js');

class EckasseAPIServer {
  constructor(options = {}) {
    this.port = options.port || process.env.PORT || 3000;
    this.host = options.host || process.env.HOST || '0.0.0.0';
    this.env = process.env.NODE_ENV || 'development';
    
    this.app = express();
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/eckasse-api.log' })
      ]
    });

    // Initialize Redis client for caching
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD
    });

    this.migrations = new Map();
    this.schemas = new Map();
    this.auditLog = [];

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    
    // Register migrations
    this.migrations.set('1.0.0->2.0.0', Migration_1_0_0_to_2_0_0);
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      }
    });
    this.app.use(limiter);

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // File upload handling
    const upload = multer({
      dest: 'uploads/',
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
          cb(null, true);
        } else {
          cb(new Error('Only JSON files are allowed'), false);
        }
      }
    });
    this.upload = upload;

    // Request logging
    this.app.use((req, res, next) => {
      const requestId = uuidv4();
      req.requestId = requestId;
      res.setHeader('X-Request-ID', requestId);
      
      this.logger.info('Request received', {
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      next();
    });

    // Authentication middleware
    this.app.use('/api/protected', this.authenticateToken.bind(this));
  }

  setupRoutes() {
    // Health checks
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        uptime: process.uptime(),
        environment: this.env
      });
    });

    this.app.get('/ready', async (req, res) => {
      try {
        // Check Redis connection
        await this.redis.ping();
        
        res.json({
          status: 'ready',
          services: {
            redis: 'connected',
            migrations: 'loaded',
            schemas: 'loaded'
          }
        });
      } catch (error) {
        res.status(503).json({
          status: 'not ready',
          error: error.message
        });
      }
    });

    // Metrics endpoint for Prometheus
    this.app.get('/metrics', (req, res) => {
      // Basic metrics - in production, use prometheus-client
      const metrics = {
        requests_total: this.auditLog.length,
        uptime_seconds: process.uptime(),
        memory_usage_bytes: process.memoryUsage(),
        migrations_completed: this.auditLog.filter(log => log.action === 'migration').length
      };
      
      res.set('Content-Type', 'text/plain');
      res.send(Object.entries(metrics)
        .map(([key, value]) => `${key} ${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join('\n'));
    });

    // API routes
    this.setupConfigurationRoutes();
    this.setupValidationRoutes();
    this.setupMigrationRoutes();
    this.setupAuditRoutes();
    this.setupUtilityRoutes();
  }

  setupConfigurationRoutes() {
    const router = express.Router();

    // Get all configurations
    router.get('/', async (req, res) => {
      try {
        const { page = 1, limit = 10, search, version } = req.query;
        
        // Implementation would connect to database
        // For now, return sample data
        const configurations = [
          {
            id: 'conf_001',
            name: 'Restaurant Main',
            version: '2.0.0',
            lastModified: new Date().toISOString(),
            status: 'active'
          }
        ];

        res.json({
          data: configurations,
          meta: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: configurations.length
          }
        });
      } catch (error) {
        this.handleError(res, error, 'Failed to fetch configurations');
      }
    });

    // Get specific configuration
    router.get('/:id', async (req, res) => {
      try {
        const { id } = req.params;
        
        // Check cache first
        const cached = await this.redis.get(`config:${id}`);
        if (cached) {
          return res.json(JSON.parse(cached));
        }

        // Load from storage
        const configPath = path.join('data', 'configurations', `${id}.json`);
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);

        // Cache for 1 hour
        await this.redis.setex(`config:${id}`, 3600, JSON.stringify(config));

        res.json(config);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({ error: 'Configuration not found' });
        }
        this.handleError(res, error, 'Failed to fetch configuration');
      }
    });

    // Create new configuration
    router.post('/', async (req, res) => {
      try {
        const config = req.body;
        const configId = uuidv4();
        
        // Validate configuration
        const validation = await this.validateConfiguration(config);
        if (!validation.valid) {
          return res.status(400).json({
            error: 'Configuration validation failed',
            details: validation.errors
          });
        }

        // Add metadata
        config.id = configId;
        config.createdAt = new Date().toISOString();
        config.version = config.company_details?.meta_information?.format_version || '2.0.0';

        // Save to storage
        const configPath = path.join('data', 'configurations', `${configId}.json`);
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        // Invalidate cache
        await this.redis.del(`config:${configId}`);

        // Log audit event
        this.logAuditEvent('configuration_created', req.user?.id || 'anonymous', {
          configId,
          name: config.company_details?.company_full_name
        });

        res.status(201).json({
          id: configId,
          message: 'Configuration created successfully',
          config
        });
      } catch (error) {
        this.handleError(res, error, 'Failed to create configuration');
      }
    });

    // Update configuration
    router.put('/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        // Load existing configuration
        const configPath = path.join('data', 'configurations', `${id}.json`);
        const existingData = await fs.readFile(configPath, 'utf8');
        const existingConfig = JSON.parse(existingData);

        // Merge updates
        const updatedConfig = { ...existingConfig, ...updates };
        updatedConfig.lastModified = new Date().toISOString();
        
        // Update version in audit trail
        if (updatedConfig.company_details?.meta_information?.audit_trail) {
          updatedConfig.company_details.meta_information.audit_trail.version += 1;
          updatedConfig.company_details.meta_information.audit_trail.last_modified_at = new Date().toISOString();
          updatedConfig.company_details.meta_information.audit_trail.last_modified_by = req.user?.email || 'api@eckasse.com';
        }

        // Validate updated configuration
        const validation = await this.validateConfiguration(updatedConfig);
        if (!validation.valid) {
          return res.status(400).json({
            error: 'Updated configuration validation failed',
            details: validation.errors
          });
        }

        // Save updates
        await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2));

        // Invalidate cache
        await this.redis.del(`config:${id}`);

        // Log audit event
        this.logAuditEvent('configuration_updated', req.user?.id || 'anonymous', {
          configId: id,
          changes: Object.keys(updates)
        });

        res.json({
          message: 'Configuration updated successfully',
          config: updatedConfig
        });
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({ error: 'Configuration not found' });
        }
        this.handleError(res, error, 'Failed to update configuration');
      }
    });

    // Delete configuration
    router.delete('/:id', async (req, res) => {
      try {
        const { id } = req.params;
        
        const configPath = path.join('data', 'configurations', `${id}.json`);
        await fs.unlink(configPath);

        // Invalidate cache
        await this.redis.del(`config:${id}`);

        // Log audit event
        this.logAuditEvent('configuration_deleted', req.user?.id || 'anonymous', { configId: id });

        res.json({ message: 'Configuration deleted successfully' });
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({ error: 'Configuration not found' });
        }
        this.handleError(res, error, 'Failed to delete configuration');
      }
    });

    this.app.use('/api/configurations', router);
  }

  setupValidationRoutes() {
    const router = express.Router();

    // Validate configuration against schema
    router.post('/validate', async (req, res) => {
      try {
        const { configuration, schemaVersion = '2.0.0' } = req.body;
        
        const validation = await this.validateConfiguration(configuration, schemaVersion);
        
        res.json({
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          schemaVersion,
          validatedAt: new Date().toISOString()
        });
      } catch (error) {
        this.handleError(res, error, 'Validation failed');
      }
    });

    // Validate uploaded file
    router.post('/validate-file', this.upload.single('config'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const configData = await fs.readFile(req.file.path, 'utf8');
        const configuration = JSON.parse(configData);
        
        const validation = await this.validateConfiguration(configuration);
        
        // Cleanup uploaded file
        await fs.unlink(req.file.path);

        res.json({
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          filename: req.file.originalname,
          validatedAt: new Date().toISOString()
        });
      } catch (error) {
        // Cleanup on error
        if (req.file) {
          await fs.unlink(req.file.path).catch(() => {});
        }
        this.handleError(res, error, 'File validation failed');
      }
    });

    // Get available schemas
    router.get('/schemas', (req, res) => {
      res.json({
        schemas: [
          { version: '1.0.0', status: 'legacy' },
          { version: '2.0.0', status: 'current' }
        ]
      });
    });

    this.app.use('/api/validation', router);
  }

  setupMigrationRoutes() {
    const router = express.Router();

    // Get available migrations
    router.get('/available', (req, res) => {
      const migrations = Array.from(this.migrations.keys()).map(key => {
        const [from, to] = key.split('->');
        return { from, to, key };
      });

      res.json({ migrations });
    });

    // Migrate configuration
    router.post('/migrate', async (req, res) => {
      try {
        const { configuration, targetVersion, options = {} } = req.body;
        
        if (!configuration) {
          return res.status(400).json({ error: 'Configuration is required' });
        }

        const currentVersion = configuration.company_details?.meta_information?.format_version;
        if (!currentVersion) {
          return res.status(400).json({ error: 'Unable to detect current version' });
        }

        const migrationKey = `${currentVersion}->${targetVersion}`;
        const MigrationClass = this.migrations.get(migrationKey);

        if (!MigrationClass) {
          return res.status(400).json({
            error: `No migration available from ${currentVersion} to ${targetVersion}`
          });
        }

        // Run migration
        const migrator = new MigrationClass({
          defaultLanguage: options.defaultLanguage || 'de',
          supportedLanguages: options.supportedLanguages || ['de', 'en'],
          migrationUser: req.user?.email || 'api@eckasse.com'
        });

        const result = migrator.migrate(configuration);

        if (!result.success) {
          return res.status(400).json({
            error: 'Migration failed',
            details: result.errors
          });
        }

        // Log audit event
        this.logAuditEvent('migration_completed', req.user?.id || 'anonymous', {
          fromVersion: currentVersion,
          toVersion: targetVersion,
          warnings: result.warnings.length
        });

        res.json({
          success: true,
          migratedConfiguration: result.config,
          warnings: result.warnings,
          fromVersion: currentVersion,
          toVersion: targetVersion,
          migratedAt: new Date().toISOString()
        });
      } catch (error) {
        this.handleError(res, error, 'Migration failed');
      }
    });

    // Migrate uploaded file
    router.post('/migrate-file', this.upload.single('config'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const { targetVersion = '2.0.0' } = req.body;
        
        const configData = await fs.readFile(req.file.path, 'utf8');
        const configuration = JSON.parse(configData);
        
        const currentVersion = configuration.company_details?.meta_information?.format_version;
        const migrationKey = `${currentVersion}->${targetVersion}`;
        const MigrationClass = this.migrations.get(migrationKey);

        if (!MigrationClass) {
          await fs.unlink(req.file.path);
          return res.status(400).json({
            error: `No migration available from ${currentVersion} to ${targetVersion}`
          });
        }

        const migrator = new MigrationClass();
        const result = migrator.migrate(configuration);

        // Cleanup uploaded file
        await fs.unlink(req.file.path);

        if (!result.success) {
          return res.status(400).json({
            error: 'Migration failed',
            details: result.errors
          });
        }

        res.json({
          success: true,
          migratedConfiguration: result.config,
          warnings: result.warnings,
          filename: req.file.originalname,
          fromVersion: currentVersion,
          toVersion: targetVersion
        });
      } catch (error) {
        if (req.file) {
          await fs.unlink(req.file.path).catch(() => {});
        }
        this.handleError(res, error, 'File migration failed');
      }
    });

    this.app.use('/api/migration', router);
  }

  setupAuditRoutes() {
    const router = express.Router();

    // Get audit log
    router.get('/log', (req, res) => {
      const { page = 1, limit = 50, action, userId } = req.query;
      
      let filteredLog = this.auditLog;
      
      if (action) {
        filteredLog = filteredLog.filter(entry => entry.action === action);
      }
      
      if (userId) {
        filteredLog = filteredLog.filter(entry => entry.userId === userId);
      }

      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedLog = filteredLog.slice(startIndex, endIndex);

      res.json({
        data: paginatedLog,
        meta: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredLog.length
        }
      });
    });

    // Get audit statistics
    router.get('/stats', (req, res) => {
      const stats = {
        total_events: this.auditLog.length,
        events_by_action: {},
        events_by_user: {},
        recent_activity: this.auditLog.slice(-10)
      };

      this.auditLog.forEach(entry => {
        stats.events_by_action[entry.action] = (stats.events_by_action[entry.action] || 0) + 1;
        stats.events_by_user[entry.userId] = (stats.events_by_user[entry.userId] || 0) + 1;
      });

      res.json(stats);
    });

    this.app.use('/api/audit', router);
  }

  setupUtilityRoutes() {
    const router = express.Router();

    // Convert configuration to different formats
    router.post('/convert/:format', async (req, res) => {
      try {
        const { format } = req.params;
        const { configuration } = req.body;

        if (!configuration) {
          return res.status(400).json({ error: 'Configuration is required' });
        }

        let convertedData;
        let contentType;
        let filename;

        switch (format.toLowerCase()) {
          case 'vectron':
            convertedData = this.convertToVectron(configuration);
            contentType = 'text/plain';
            filename = 'vectron-import.txt';
            break;
          case 'csv':
            convertedData = this.convertToCSV(configuration);
            contentType = 'text/csv';
            filename = 'items.csv';
            break;
          case 'xml':
            convertedData = this.convertToXML(configuration);
            contentType = 'application/xml';
            filename = 'config.xml';
            break;
          default:
            return res.status(400).json({ error: `Unsupported format: ${format}` });
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(convertedData);
      } catch (error) {
        this.handleError(res, error, 'Conversion failed');
      }
    });

    // Generate sample configuration
    router.post('/generate', (req, res) => {
      try {
        const { type = 'restaurant', version = '2.0.0', language = 'de' } = req.body;
        
        const sampleConfig = this.generateSampleConfiguration(type, version, language);
        
        res.json({
          configuration: sampleConfig,
          type,
          version,
          language,
          generatedAt: new Date().toISOString()
        });
      } catch (error) {
        this.handleError(res, error, 'Sample generation failed');
      }
    });

    this.app.use('/api/utils', router);
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        requestId: req.requestId,
        url: req.url,
        method: req.method
      });

      res.status(500).json({
        error: 'Internal server error',
        requestId: req.requestId,
        ...(this.env === 'development' && { details: error.message })
      });
    });
  }

  // Authentication middleware
  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'default-secret', (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = user;
      next();
    });
  }

  // Helper methods
  async validateConfiguration(config, schemaVersion = '2.0.0') {
    try {
      // Load schema if not cached
      if (!this.schemas.has(schemaVersion)) {
        const schemaPath = path.join(__dirname, '..', 'schemas', `v${schemaVersion}`, 'schema.json');
        const schemaData = await fs.readFile(schemaPath, 'utf8');
        const schema = JSON.parse(schemaData);
        this.schemas.set(schemaVersion, schema);
      }

      const schema = this.schemas.get(schemaVersion);
      const validate = this.ajv.compile(schema);
      const valid = validate(config);

      return {
        valid,
        errors: validate.errors || [],
        warnings: [] // Custom warnings logic can be added here
      };
    } catch (error) {
      throw new Error(`Schema validation failed: ${error.message}`);
    }
  }

  logAuditEvent(action, userId, metadata = {}) {
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      action,
      userId,
      metadata
    };

    this.auditLog.push(auditEntry);
    
    // Keep only last 10000 entries in memory
    if (this.auditLog.length > 10000) {
      this.auditLog.shift();
    }

    this.logger.info('Audit event', auditEntry);
  }

  handleError(res, error, message) {
    this.logger.error(message, {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: message,
      details: this.env === 'development' ? error.message : undefined
    });
  }

  // Format conversion methods (simplified implementations)
  convertToVectron(config) {
    const lines = ['100,0,1,1;10,1;24,A;51,1;'];
    
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

  generateSampleConfiguration(type, version, language) {
    // Simplified sample generation
    return {
      "$schema": `https://schemas.eckasse.com/oop-pos-mdf/v${version}/schema.json`,
      company_details: {
        company_unique_identifier: 1,
        company_full_name: `Sample ${type} Configuration`,
        meta_information: {
          format_version: version,
          default_language: language,
          supported_languages: [language],
          date_generated: new Date().toISOString()
        }
      }
    };
  }

  async start() {
    try {
      // Connect to Redis
      await this.redis.connect();
      this.logger.info('Connected to Redis');

      // Create necessary directories
      await fs.mkdir('data/configurations', { recursive: true });
      await fs.mkdir('logs', { recursive: true });
      await fs.mkdir('uploads', { recursive: true });

      // Start server
      this.server = this.app.listen(this.port, this.host, () => {
        this.logger.info(`eckasse API server running on ${this.host}:${this.port}`, {
          environment: this.env,
          version: '2.0.0'
        });
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      this.logger.error('Failed to start server', { error: error.message });
      process.exit(1);
    }
  }

  async shutdown() {
    this.logger.info('Shutting down server...');
    
    if (this.server) {
      this.server.close();
    }
    
    if (this.redis) {
      await this.redis.disconnect();
    }
    
    process.exit(0);
  }
}

// Export for use as module or start directly
if (require.main === module) {
  const server = new EckasseAPIServer();
  server.start();
}

module.exports = EckasseAPIServer;