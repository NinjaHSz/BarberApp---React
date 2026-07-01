const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read local .env file
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error("Arquivo .env não encontrado.");
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Variáveis de ambiente do Supabase não encontradas no arquivo .env.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runBackup() {
  const tables = ['clientes', 'barbeiros', 'procedimentos', 'agendamentos_lucas', 'agendamentos_joao_lucas'];
  const backupData = {};

  console.log("Iniciando backup das tabelas...");

  for (const table of tables) {
    console.log(`Baixando dados da tabela: ${table}...`);
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`Erro ao baixar tabela ${table}:`, error.message);
      continue;
    }
    backupData[table] = data;
  }

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const today = new Date();
  const dateFormatted = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const fileName = `backup_${dateFormatted}.json`;
  const filePath = path.join(backupDir, fileName);

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
  console.log(`\n✔ Backup finalizado com sucesso!`);
  console.log(`Salvo em: ${filePath}`);
}

runBackup();
