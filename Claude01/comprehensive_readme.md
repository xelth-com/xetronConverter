# 🍽️ eckasse OOP-POS-MDF v2.0.0

**Enhanced Object-Oriented Point-of-Sale Master Data Format**

[![CI/CD Pipeline](https://github.com/eckasse/oop-pos-mdf/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/eckasse/oop-pos-mdf/actions)
[![NPM Version](https://img.shields.io/npm/v/@eckasse/oop-pos-mdf.svg)](https://www.npmjs.com/package/@eckasse/oop-pos-mdf)
[![Docker Pulls](https://img.shields.io/docker/pulls/eckasse/oop-pos-mdf.svg)](https://hub.docker.com/r/eckasse/oop-pos-mdf)
[![License: EUPL-1.2](https://img.shields.io/badge/License-EUPL--1.2-blue.svg)](https://opensource.org/licenses/EUPL-1.2)
[![codecov](https://codecov.io/gh/eckasse/oop-pos-mdf/branch/main/graph/badge.svg)](https://codecov.io/gh/eckasse/oop-pos-mdf)

Eine umfassende, mehrsprachige und versionierte Lösung für die Konfiguration von Point-of-Sale-Systemen mit automatischen Migrationswerkzeugen, Audit-Trails und erweiterten Sicherheitsfeatures.

## 🚀 **Hauptfeatures**

### 🌍 **Mehrsprachige Unterstützung**
- Native Unterstützung für mehrere Sprachen
- Nahtlose Lokalisierung von Menüs, Buttons und Belegen
- Automatische Spracherkennung und -umschaltung

### 📝 **Audit Trails & Versionierung**
- Vollständige Änderungshistorie für alle Konfigurationselemente
- Benutzerbasierte Nachverfolgung von Modifikationen
- Automatische Versionierung mit semantischen Updates

### 🔄 **Intelligente Migrationen**
- Automatische Datenmigration zwischen Versionen
- Rückwärtskompatibilität mit älteren Formaten
- Validierung und Fehlerbehebung während der Migration

### 🛡️ **Erweiterte Sicherheit**
- GDPR-konforme Datenschutzeinstellungen
- Verschlüsselung im Ruhezustand und während der Übertragung
- Rollenbasierte Zugriffskontrolle

### ⚡ **Performance-Optimierung**
- Intelligente Caching-Strategien
- Lazy Loading für große Konfigurationen
- Optimierte UI-Rendering-Pipeline

### 🔗 **Systemintegration**
- DATEV-Buchhaltungsintegration
- Warenwirtschaftssystem-Anbindung
- Treueprogramm-Unterstützung

## 📦 **Installation**

### NPM Package

```bash
# Globale Installation für CLI-Tools
npm install -g @eckasse/oop-pos-mdf

# Lokale Installation für Entwicklung
npm install @eckasse/oop-pos-mdf
```

### Docker

```bash
# CLI-Tools in Container ausführen
docker run --rm -v $(pwd):/data eckasse/oop-pos-mdf:2.0.0 eckasse validate /data/config.json

# Interaktive Entwicklungsumgebung
docker-compose up -d eckasse-dev
```

### Von Quellcode

```bash
git clone https://github.com/eckasse/oop-pos-mdf.git
cd oop-pos-mdf
npm install
npm run build
npm link  # Für globale CLI-Verfügbarkeit
```

## 🛠️ **CLI-Tools**

### Grundlegende Befehle

```bash
# Hilfe anzeigen
eckasse --help

# Version anzeigen
eckasse --version

# Konfiguration validieren
eckasse validate restaurant-config.json

# Zwischen Versionen migrieren
eckasse migrate old-config.json --target 2.0.0 --backup

# Beispielkonfiguration generieren
eckasse generate --type restaurant --output my-restaurant.json

# Konfigurationsinformationen anzeigen
eckasse info my-restaurant.json
```

### Erweiterte Funktionen

```bash
# Interaktiver Setup-Assistent
eckasse setup

# Zu verschiedenen Formaten konvertieren
eckasse convert config.json --format vectron --output vectron-import.txt
eckasse convert config.json --format csv --output items.csv

# Konfiguration mit Schema validieren
eckasse validate config.json --schema 2.0.0 --verbose

# Trockenlauf für Migration
eckasse migrate old-config.json --dry-run

# Migration mit benutzerdefinierten Sprachen
eckasse migrate config.json --target 2.0.0 --languages de,en,fr,es
```

## 📋 **Schnellstart**

### 1. Neue Konfiguration erstellen

```bash
# Interaktiver Setup für Restaurant
eckasse setup
```

Der Setup-Assistent führt Sie durch:
- Firmenname und Geschäftstyp
- Standardsprache und zusätzliche Sprachen
- Anzahl der Kassensysteme
- Grundlegende Steuer- und Zahlungseinstellungen

### 2. Bestehende Konfiguration migrieren

```bash
# Automatische Migration von v1.0.0 zu v2.0.0
eckasse migrate old-restaurant-config.json --backup --target 2.0.0
```

### 3. Konfiguration validieren

```bash
# JSON Schema Validierung
eckasse validate restaurant-config.json --verbose
```

### 4. Vectron-Import generieren

```bash
# Für Vectron Commander Export
eckasse convert restaurant-config.json --format vectron
```

## 📁 **Projektstruktur**

```
eckasse-oop-pos-mdf/
├── 📦 bin/                    # CLI-Einsprungspunkte
│   └── cli.js                 # Haupt-CLI-Anwendung
├── 📚 lib/                    # Kernbibliotheken
│   ├── index.js               # Hauptexport
│   ├── migrator.js            # Migrationssystem
│   ├── validator.js           # Schema-Validierung
│   └── converters/            # Format-Konverter
│       ├── vectron.js         # Vectron Commander Export
│       ├── csv.js             # CSV-Export
│       └── xml.js             # XML-Export
├── 🔄 migrations/             # Migrationsskripte
│   ├── 1.0.0-to-2.0.0.js      # v1→v2 Migration
│   └── registry.js            # Migration Registry
├── 📝 schemas/                # JSON Schemas
│   ├── v1.0.0/                # Schema v1.0.0
│   └── v2.0.0/                # Schema v2.0.0
├── 📖 examples/               # Beispielkonfigurationen
│   ├── restaurant.json        # Restaurant-Setup
│   ├── retail.json            # Einzelhandel-Setup
│   └── cafe.json              # Café-Setup
├── 🧪 tests/                  # Test-Suite
│   ├── migration.test.js      # Migrationstests
│   ├── validation.test.js     # Validierungstests
│   └── cli.test.js            # CLI-Tests
└── 📄 docs/                   # Dokumentation
    ├── api/                   # API-Dokumentation
    ├── migration-guide.md     # Migrationsleitfaden
    └── configuration-reference.md
```

## 🔄 **Migration von v1.0.0 zu v2.0.0**

### Wichtige Änderungen

| Bereich | v1.0.0 | v2.0.0 | Migration |
|---------|--------|--------|-----------|
| **Sprachen** | Einzelne Strings | Mehrsprachige Objekte | Automatisch |
| **Audit** | Nicht vorhanden | Vollständige Trails | Automatisch hinzugefügt |
| **Sicherheit** | Basis | GDPR-konform | Neue Einstellungen |
| **Performance** | Standard | Optimierte Caches | Neue Konfigurationen |

### Migrationsprozess

```javascript
// Programmatische Migration
const { Migration_1_0_0_to_2_0_0 } = require('@eckasse/oop-pos-mdf');

const migrator = new Migration_1_0_0_to_2_0_0({
  defaultLanguage: 'de',
  supportedLanguages: ['de', 'en', 'fr'],
  migrationUser: 'admin@restaurant.com'
});

const result = migrator.migrate(oldConfig);
if (result.success) {
  console.log('Migration erfolgreich!');
  fs.writeFileSync('new-config.json', JSON.stringify(result.config, null, 2));
} else {
  console.error('Migration fehlgeschlagen:', result.errors);
}
```

### Migrationsvalidierung

```bash
# Vor der Migration
eckasse validate old-config.json --schema 1.0.0

# Migration durchführen
eckasse migrate old-config.json --target 2.0.0

# Nach der Migration validieren
eckasse validate migrated-config.json --schema 2.0.0
```

## 🐳 **Docker-Deployment**

### Einfache CLI-Nutzung

```bash
# Einzelne Befehle ausführen
docker run --rm -v $(pwd):/data eckasse/oop-pos-mdf:2.0.0 \
  eckasse validate /data/restaurant-config.json
```

### Entwicklungsumgebung

```yaml
# docker-compose.yml
version: '3.8'
services:
  eckasse-dev:
    image: eckasse/oop-pos-mdf:2.0.0-dev
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run test:watch
```

### Produktionsumgebung

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  eckasse-validator:
    image: eckasse/oop-pos-mdf:2.0.0
    volumes:
      - ./configs:/app/data:ro
    command: |
      sh -c "
        for config in /app/data/*.json; do
          eckasse validate \"$$config\" --verbose
        done
      "
    
  eckasse-migrator:
    image: eckasse/oop-pos-mdf:2.0.0
    volumes:
      - ./configs:/app/data
    environment:
      - AUTO_MIGRATE=true
      - BACKUP_ENABLED=true
```

## 📚 **API-Referenz**

### Migration API

```javascript
const { Migration_1_0_0_to_2_0_0 } = require('@eckasse/oop-pos-mdf');

// Erweiterte Migrationskonfiguration
const migrator = new Migration_1_0_0_to_2_0_0({
  defaultLanguage: 'de',
  supportedLanguages: ['de', 'en', 'fr', 'es'],
  migrationUser: 'admin@company.com',
  preserveCustomFields: true,
  addMissingDefaults: true,
  validateAfterMigration: true
});

const result = migrator.migrate(oldConfig);
```

### Validierungs-API

```javascript
const { validateConfig } = require('@eckasse/oop-pos-mdf');

const validation = await validateConfig(config, {
  schemaVersion: '2.0.0',
  strictMode: true,
  reportLevel: 'detailed'
});

if (!validation.valid) {
  validation.errors.forEach(error => {
    console.error(`${error.path}: ${error.message}`);
  });
}
```

### Konvertierungs-API

```javascript
const { VectronConverter } = require('@eckasse/oop-pos-mdf/converters');

const converter = new VectronConverter({
  kassenNummer: 1,
  importModus: 'A',
  encoding: 'windows-1252'
});

const vectronData = converter.convert(config);
fs.writeFileSync('vectron-import.txt', vectronData);
```

## 🔧 **Konfigurationsbeispiele**

### Restaurant-Konfiguration

```json
{
  "$schema": "https://schemas.eckasse.com/oop-pos-mdf/v2.0.0/schema.json",
  "company_details": {
    "company_unique_identifier": 1,
    "company_full_name": "Bella Vista Restaurant",
    "meta_information": {
      "format_version": "2.0.0",
      "default_language": "de",
      "supported_languages": ["de", "en", "it"],
      "audit_trail": {
        "created_at": "2024-01-15T10:30:00Z",
        "created_by": "admin@bellavista.com"
      }
    },
    "global_configurations": {
      "promotions_definitions": [
        {
          "promotion_id": "happy_hour",
          "names": {
            "de": "Happy Hour",
            "en": "Happy Hour",
            "it": "Ora Felice"
          },
          "type": "percentage_discount",
          "discount": {
            "type": "percentage",
            "value": 20.0
          },
          "validity": {
            "days_of_week": ["monday", "tuesday", "wednesday"],
            "time_range": {"start": "16:00", "end": "18:00"}
          }
        }
      ],
      "workflows": [
        {
          "workflow_id": "daily_backup",
          "name": "Tägliche Datensicherung",
          "trigger": {"type": "schedule", "time": "02:00"},
          "actions": [
            {"type": "backup_data"},
            {"type": "sync_to_cloud"}
          ]
        }
      ]
    }
  }
}
```

### Einzelhandel-Konfiguration

```json
{
  "company_details": {
    "company_full_name": "Tech Store GmbH",
    "global_configurations": {
      "integrations": {
        "inventory_management": {
          "provider": "sap_erp",
          "real_time_sync": true,
          "is_enabled": true
        },
        "loyalty_program": {
          "provider": "payback",
          "api_key_ref": "payback_credentials",
          "is_enabled": true
        }
      },
      "security_settings": {
        "access_control": {
          "require_2fa": true,
          "session_timeout": 1800
        }
      }
    }
  }
}
```

## 🧪 **Testing**

### Test-Suite ausführen

```bash
# Alle Tests
npm test

# Tests mit Coverage
npm run test:coverage

# Migrationstests
npm run migration:test

# Performance-Tests
npm run test:performance

# E2E-Tests
npm run test:e2e
```

### Spezifische Tests

```bash
# Nur Validierungstests
npm test -- --testNamePattern="validation"

# Nur Migrationstests
npm test -- --testNamePattern="migration"

# Tests mit Debugging
npm test -- --verbose --detectOpenHandles
```

## 📊 **Performance & Skalierung**

### Benchmark-Ergebnisse

| Konfigurationsgröße | Migrationsdauer | Speicherverbrauch | Validierungszeit |
|---------------------|-----------------|-------------------|------------------|
| Klein (< 100 Items) | < 100ms | 15MB | < 50ms |
| Mittel (< 1.000 Items) | < 500ms | 45MB | < 200ms |
| Groß (< 10.000 Items) | < 2s | 120MB | < 1s |
| Enterprise (< 100.000 Items) | < 15s | 500MB | < 5s |

### Performance-Optimierung

```javascript
// Große Konfigurationen optimieren
const migrator = new Migration_1_0_0_to_2_0_0({
  batchSize: 1000,          // Items in Batches verarbeiten
  enableStreaming: true,    // Streaming für große Dateien
  memoryLimit: '512MB',     // Speicherlimit
  cacheEnabled: true        // Zwischenergebnisse cachen
});
```

## 🤝 **Beitragen**

### Entwicklungsumgebung einrichten

```bash
# Repository klonen
git clone https://github.com/eckasse/oop-pos-mdf.git
cd oop-pos-mdf

# Dependencies installieren
npm install

# Pre-commit Hooks aktivieren
npm run prepare

# Tests ausführen
npm test

# Linting
npm run lint:fix

# Dokumentation generieren
npm run docs:generate
```

### Code-Qualitätsstandards

- **ESLint**: Automatische Code-Stil-Prüfung
- **Prettier**: Konsistente Code-Formatierung
- **Husky**: Pre-commit-Hooks für Qualitätssicherung
- **Jest**: Umfassende Test-Coverage (>95%)
- **JSDoc**: Vollständige API-Dokumentation

### Pull Request Prozess

1. **Fork** das Repository
2. **Branch** für Feature erstellen (`git checkout -b feature/amazing-feature`)
3. **Commit** mit semantischen Nachrichten (`git commit -m 'feat: add amazing feature'`)
4. **Push** zum Branch (`git push origin feature/amazing-feature`)
5. **Pull Request** öffnen

## 📖 **Dokumentation**

### Offizielle Dokumentation
- 🌐 **[API Reference](https://eckasse.github.io/oop-pos-mdf/api/)**
- 📋 **[Configuration Reference](https://eckasse.github.io/oop-pos-mdf/config/)**
- 🔄 **[Migration Guide](https://eckasse.github.io/oop-pos-mdf/migration/)**
- 🛠️ **[CLI Documentation](https://eckasse.github.io/oop-pos-mdf/cli/)**

### Community-Ressourcen
- 💬 **[GitHub Discussions](https://github.com/eckasse/oop-pos-mdf/discussions)**
- 🐛 **[Issue Tracker](https://github.com/eckasse/oop-pos-mdf/issues)**
- 📺 **[Video Tutorials](https://www.youtube.com/playlist?list=PLeckasse-tutorials)**

## 🚀 **Roadmap**

### v2.1.0 (Q3 2024)
- [ ] Grafische Benutzeroberfläche (Web-UI)
- [ ] Real-time Collaboration Features
- [ ] Advanced Analytics Dashboard
- [ ] Plugin-System für Erweiterungen

### v2.2.0 (Q4 2024)
- [ ] Machine Learning für Preisoptimierung
- [ ] Erweiterte Inventory-Prognosen
- [ ] A/B Testing für Menü-Layouts
- [ ] Voice Control Integration

### v3.0.0 (Q1 2025)
- [ ] Microservices-Architektur
- [ ] Kubernetes-Native Deployment
- [ ] Event-Driven Architecture
- [ ] Blockchain-basierte Audit Trails

## 📄 **Lizenz**

Dieses Projekt ist unter der **EUPL-1.2** (European Union Public Licence) lizenziert.

Die EUPL ist eine von der Europäischen Kommission genehmigte Open-Source-Lizenz, die:
- ✅ Kommerzielle Nutzung erlaubt
- ✅ Modifikation und Verteilung erlaubt
- ✅ Private Nutzung erlaubt
- ⚠️ Copyleft (abgeleitete Werke müssen unter EUPL stehen)

**Wichtiger Hinweis für deutsche Unternehmen**: Die EUPL ist vollständig mit deutschem Recht kompatibel und bietet rechtliche Sicherheit für den Einsatz in kommerziellen Umgebungen.

Siehe [LICENSE](LICENSE) für den vollständigen Lizenztext.

## 🙏 **Danksagungen**

Wir danken allen Mitwirkenden, die diese Software möglich gemacht haben:

- **Vectron Systems AG** für die Bereitstellung von Referenzdokumentationen
- **OpenSource Community** für wertvolle Bibliotheken und Tools
- **Restaurant-Partner** für Real-World Testing und Feedback
- **Security Researchers** für Sicherheitsaudits und Verbesserungen

### Besonderer Dank an:
- [@contributor1](https://github.com/contributor1) - Mehrsprachiges System
- [@contributor2](https://github.com/contributor2) - Migration Framework
- [@contributor3](https://github.com/contributor3) - Docker Integration
- [@contributor4](https://github.com/contributor4) - Performance Optimierung

## 📞 **Support & Kontakt**

### Community Support (Kostenlos)
- 💬 **GitHub Discussions**: Allgemeine Fragen und Community-Austausch
- 🐛 **GitHub Issues**: Bug Reports und Feature Requests
- 📧 **E-Mail**: community@eckasse.com

### Enterprise Support (Kommerziell)
- 🏢 **Unternehmenskunden**: enterprise@eckasse.com
- 📞 **Telefon**: +49 (0) 30 123456789 (Mo-Fr 9-17 Uhr)
- 💼 **Professional Services**: consulting@eckasse.com

### Notfall-Support (24/7)
- 🚨 **Kritische Systeme**: emergency@eckasse.com
- 📱 **SMS/WhatsApp**: +49 (0) 172 1234567

---

<div align="center">

**Made with ❤️ in Germany**

[![GitHub stars](https://img.shields.io/github/stars/eckasse/oop-pos-mdf.svg?style=social&label=Star)](https://github.com/eckasse/oop-pos-mdf)
[![GitHub forks](https://img.shields.io/github/forks/eckasse/oop-pos-mdf.svg?style=social&label=Fork)](https://github.com/eckasse/oop-pos-mdf/fork)
[![GitHub watchers](https://img.shields.io/github/watchers/eckasse/oop-pos-mdf.svg?style=social&label=Watch)](https://github.com/eckasse/oop-pos-mdf)

[🏠 Homepage](https://eckasse.com) • [📖 Docs](https://docs.eckasse.com) • [🐛 Issues](https://github.com/eckasse/oop-pos-mdf/issues) • [💬 Discussions](https://github.com/eckasse/oop-pos-mdf/discussions)

</div>