const fs = require('fs');
const iconv = require('iconv-lite'); // Для кодировки Windows-1252 (ANSI)

// --- Внутренняя "База Данных" Известных Vectron Команд и Маппингов ---
// Это имитирует знание конвертера о том, что Vectron понимает.
// Конвертер выводит только эти известные команды.
const VECTRON_COMMANDS = {
  HEADER_LINE_TYPE: 100,
  WARENGRUPPE_LINE_TYPE: 102,
  PLU_LINE_TYPE: 101,
  AUSWAHLFENSTER_LINE_TYPE: 152,

  // Общие поля
  FIELD_ID_NAME1: 101, // Name 1 (PLU, WG, Auswahlfenster)
  FIELD_ID_NAME2: 102, // Name 2 (PLU Kurzname / button_display_name)
  FIELD_ID_PRICE1: 201, // Preis 1
  FIELD_ID_WARENGRUPPE_LINK: 301, // Verknüpfung zur Warengruppe
  FIELD_ID_HAUPTGRUPPE_LINK: 311, // Verknüpfung zur Hauptgruppe 1
  FIELD_ID_STEUER_LINK: 401, // Verknüpfung zur Steuer
  FIELD_ID_INAKTIV_FLAG: 9001, // "Inaktiv"-Flag (0=aktiv, 1=inaktiv)
  FIELD_ID_KEIN_VERKAUF_FLAG: 1003, // "Kein Verkauf"-Flag (1=kein Verkauf)
  FIELD_ID_NEGATIV_FLAG: 901, // "Negativ"-Flag (0=nicht negativ, 1=negativ)

  // Header-специфичные поля
  HEADER_FIELD_ID_INTERFACE_VERSION: 1, // Datenschnittstellenversion (всегда 1)
  HEADER_FIELD_ID_KASSEN_NUMMER: 10, // Kassennummer
  HEADER_FIELD_ID_IMPORT_MODUS: 24, // Importmodus (A=Add/Update)
  HEADER_FIELD_ID_CHAR_ENCODING: 51, // Zeichenkodierung (1=ANSI/Windows-1252)

  // Значения по умолчанию для Vectron-полей
  DEFAULT_IMPORT_MODE: 'A', // Add/Update
  DEFAULT_CHAR_ENCODING: 1, // ANSI (Windows-1252)
  DEFAULT_PLU_ACTIVE: 0, // 0 = активен
  DEFAULT_PLU_INACTIVE: 1, // 1 = неактивен
  DEFAULT_PLU_NOT_NEGATIVE: 0, // 0 = не отрицателен
  DEFAULT_PLU_IS_NEGATIVE: 1, // 1 = отрицателен
  DEFAULT_PLU_CAN_BE_SOLD: 0, // 0 = продается
  DEFAULT_PLU_CANNOT_BE_SOLD: 1, // 1 = не продается
};

function generateVectronImportFile(oopPosMdfJson) {
  const vectronLines = [];

  // Проверяем, что необходимые данные существуют
  const companyDetails = oopPosMdfJson.company_details;
  if (!companyDetails || !companyDetails.branches || companyDetails.branches.length === 0) {
    throw new Error("Invalid OOP-POS-MDF structure: No company or branches found.");
  }
  const branch = companyDetails.branches[0];
  if (!branch.point_of_sale_devices || branch.point_of_sale_devices.length === 0) {
    throw new Error("Invalid OOP-POS-MDF structure: No POS devices found in the first branch.");
  }
  const posDevice = branch.point_of_sale_devices[0];

  // --- 1. Header-Zeile ---
  const kassenNummer = posDevice.pos_device_external_number;
  const header = `${VECTRON_COMMANDS.HEADER_LINE_TYPE},0,` +
                 `${VECTRON_COMMANDS.HEADER_FIELD_ID_INTERFACE_VERSION},1;` +
                 `${VECTRON_COMMANDS.HEADER_FIELD_ID_KASSEN_NUMMER},${kassenNummer};` +
                 `${VECTRON_COMMANDS.HEADER_FIELD_ID_IMPORT_MODUS},${VECTRON_COMMANDS.DEFAULT_IMPORT_MODE};` +
                 `${VECTRON_COMMANDS.HEADER_FIELD_ID_CHAR_ENCODING},${VECTRON_COMMANDS.DEFAULT_CHAR_ENCODING};`;
  vectronLines.push(header);

  // --- 2. Warengruppen (LineType 102) ---
  for (const category of posDevice.categories_for_this_pos) {
    const wgLine = `${VECTRON_COMMANDS.WARENGRUPPE_LINE_TYPE},${category.category_unique_identifier},` +
                   `${VECTRON_COMMANDS.FIELD_ID_NAME1},TX:"${category.category_name_full}";`;
    vectronLines.push(wgLine);
  }

  // --- 3. Items (PLUs) (LineType 101) ---
  for (const item of posDevice.items_for_this_pos) {
    const category = posDevice.categories_for_this_pos.find(
      cat => cat.category_unique_identifier === item.associated_category_unique_identifier
    );
    if (!category) {
      console.warn(`WARN: Item ${item.item_unique_identifier} has no matching category. Skipping PLU import for this item.`);
      continue;
    }

    const mainGroup = category.default_linked_main_group_unique_identifier;
    let taxRate = '';
    if (category.category_type === 'drink') {
      taxRate = posDevice.pos_device_settings.default_linked_drink_tax_rate_unique_identifier;
    } else if (category.category_type === 'food') {
      taxRate = posDevice.pos_device_settings.default_linked_food_tax_rate_unique_identifier;
    } else {
      // Fallback, if category type is unknown or 'other', assume food tax
      taxRate = posDevice.pos_device_settings.default_linked_food_tax_rate_unique_identifier;
    }

    let itemLine = `${VECTRON_COMMANDS.PLU_LINE_TYPE},${item.item_unique_identifier},` +
                   `${VECTRON_COMMANDS.FIELD_ID_NAME1},TX:"${item.menu_display_name}";` +
                   `${VECTRON_COMMANDS.FIELD_ID_NAME2},TX:"${item.button_display_name}";` +
                   `${VECTRON_COMMANDS.FIELD_ID_PRICE1},VA:${item.item_price_value.toFixed(2)};` +
                   `${VECTRON_COMMANDS.FIELD_ID_WARENGRUPPE_LINK},NR:${category.category_unique_identifier};` +
                   `${VECTRON_COMMANDS.FIELD_ID_HAUPTGRUPPE_LINK},NR:${mainGroup};` +
                   `${VECTRON_COMMANDS.FIELD_ID_STEUER_LINK},NR:${taxRate};`;

    // Flags
    if (!item.item_flags.is_sellable) {
      itemLine += `${VECTRON_COMMANDS.FIELD_ID_KEIN_VERKAUF_FLAG},NR:${VECTRON_COMMANDS.DEFAULT_PLU_CANNOT_BE_SOLD};`;
    } else {
      // If sellable, explicitly set it to default active flag
      itemLine += `${VECTRON_COMMANDS.FIELD_ID_KEIN_VERKAUF_FLAG},NR:${VECTRON_COMMANDS.DEFAULT_PLU_CAN_BE_SOLD};`;
    }
    itemLine += `${VECTRON_COMMANDS.FIELD_ID_INAKTIV_FLAG},NR:${VECTRON_COMMANDS.DEFAULT_PLU_ACTIVE}`; // Assume active by default for all imported items

    if (item.item_flags.has_negative_price) {
        itemLine += `;${VECTRON_COMMANDS.FIELD_ID_NEGATIV_FLAG},NR:${VECTRON_COMMANDS.DEFAULT_PLU_IS_NEGATIVE}`;
    } else {
        itemLine += `;${VECTRON_COMMANDS.FIELD_ID_NEGATIV_FLAG},NR:${VECTRON_COMMANDS.DEFAULT_PLU_NOT_NEGATIVE}`;
    }

    // Note: receipt_print_name is not directly mapped to a specific Field ID (e.g., 103)
    // in this "dumb" converter, as Vectron's handling of multiple names can vary
    // or rely on default print formats associated with PLU Name 1 or 2.
    // For now, we rely on Name 1 (menu_display_name) and Name 2 (button_display_name).

    vectronLines.push(itemLine);
  }

  // --- 4. Display Layouts (Auswahlfenster) (LineType 152) ---
  // This section only maps the main menu buttons to LineType 152 for their names and IDs.
  // The actual visual layout and linking logic within Vectron's UI is complex and
  // not covered by simple LineType imports; it would require manual configuration
  // in Vectron Commander's Layout/Button programming or a highly specialized converter.
  const mainLayout = posDevice.pos_device_display_layouts.find(
    layout => layout.display_layout_type === 'MAIN_MENU'
  );

  if (mainLayout) {
    for (const buttonConfig of mainLayout.category_button_configurations) {
        let buttonLine = `${VECTRON_COMMANDS.AUSWAHLFENSTER_LINE_TYPE},${buttonConfig.display_button_unique_identifier},` +
                         `${VECTRON_COMMANDS.FIELD_ID_NAME1},TX:"${buttonConfig.button_text_on_display}";`;
        vectronLines.push(buttonLine);
    }
  }

  // --- Завершаем файл и кодируем ---
  // Каждая строка должна заканчиваться CR+LF, включая последнюю.
  const outputContent = vectronLines.join('\r\n') + '\r\n';
  return iconv.encode(outputContent, 'windows-1252');
}

// --- Использование программы ---
const inputFilePath = './oop_pos_mdf.json'; // Путь к вашему JSON файлу
const outputFilePath = './vectron_import.txt';

try {
  const oopPosMdfData = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));
  const vectronImportBuffer = generateVectronImportFile(oopPosMdfData);
  fs.writeFileSync(outputFilePath, vectronImportBuffer);
  console.log(`Successfully converted ${inputFilePath} to ${outputFilePath} (Windows-1252/ANSI encoding).`);
  console.log(`\n--- IMPORTANT: MANUAL STEPS REQUIRED IN VECTRON COMMANDER ---`);
  console.log(`1. Ensure Tax Rates (IDs: 1, 2) are defined in Konfiguration -> Berichte -> Steuersätze.`);
  console.log(`2. Ensure Main Groups (IDs: 1, 2) are defined in Konfiguration -> Einstellungen -> Hauptgruppen.`);
  console.log(`3. Ensure Warengruppen (IDs: 1-9) are defined in Konfiguration -> Einstellungen -> Warengruppen.`);
  console.log(`4. Ensure the POS device (Kasse external number: ${oopPosMdfData.company_details.branches[0].point_of_sale_devices[0].pos_device_external_number}) exists.`);
  console.log(`5. For display buttons (Auswahlfenster, LineType 152), you'll need to manually link them to categories/items within Vectron Commander's Layout or Button programming.`);
  console.log(`6. Hardware Interfaces, Built-in Displays, and Peripherals (Printers, Customer Displays) must be configured manually in Vectron Commander.`);
  console.log(`\nBefore importing, ALWAYS make a full backup of your Vectron Commander database and close all relevant programming windows!`);

} catch (error) {
  console.error('Error during conversion:', error);
  if (error.code === 'ENOENT') {
    console.error(`Error: Input file not found at ${inputFilePath}. Please ensure 'oop_pos_mdf.json' exists in the same directory.`);
  } else if (error instanceof SyntaxError) {
    console.error(`Error: Invalid JSON in input file: ${error.message}. Please check your 'oop_pos_mdf.json' for syntax errors.`);
  } else if (error.message.includes("Invalid OOP-POS-MDF structure")) {
    console.error(`Error: The JSON structure is incomplete or invalid. Please ensure it follows the defined OOP-POS-MDF format.`);
  }
}