const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// 1. Parse .env file manually
const envPath = path.join(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    // Remove surrounding quotes if any
    if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const evolutionUrl = env.NEXT_PUBLIC_EVOLUTION_API_URL;
const evolutionKey = env.NEXT_PUBLIC_EVOLUTION_API_KEY;

if (!supabaseUrl || !supabaseKey || !evolutionUrl || !evolutionKey) {
  console.error("Missing environment variables in .env file!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Sleep helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("Loading clients from Supabase...");
  const { data: clients, error } = await supabase
    .from("clientes")
    .select("id, nome, telefone, foto_url");

  if (error) {
    console.error("Error loading clients:", error);
    process.exit(1);
  }

  const clientsWithPhone = clients.filter(c => c.telefone && c.telefone.replace(/\D/g, "").length >= 8);
  console.log(`Found ${clients.length} total clients, ${clientsWithPhone.length} with phone numbers.`);

  let successCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < clientsWithPhone.length; i++) {
    const client = clientsWithPhone[i];
    const cleanPhoneStr = client.telefone.replace(/\D/g, "");

    console.log(`[${i + 1}/${clientsWithPhone.length}] Checking ${client.nome} (${cleanPhoneStr})...`);

    try {
      const response = await fetch(`${evolutionUrl}/chat/fetchProfile/barbearia`, {
        method: "POST",
        headers: {
          "apikey": evolutionKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ number: cleanPhoneStr })
      });

      if (!response.ok) {
        console.log(`  Evolution API error status: ${response.status}`);
        await sleep(500);
        continue;
      }

      const resData = await response.json();
      const profilePicUrl = resData.picture || resData.profilePicUrl || resData.response?.profilePicUrl;

      if (profilePicUrl) {
        console.log(`  Found avatar URL: ${profilePicUrl.substring(0, 60)}...`);
        
        // Update DB
        const { error: updateError } = await supabase
          .from("clientes")
          .update({ foto_url: profilePicUrl })
          .eq("id", client.id);

        if (updateError) {
          console.error("  Error updating DB:", updateError);
        } else {
          console.log(`  Successfully updated avatar for ${client.nome}!`);
          successCount++;
        }
      } else {
        console.log("  No profile picture URL returned.");
        skippedCount++;
      }
    } catch (err) {
      console.error(`  Fetch error:`, err.message);
    }

    // Delay to avoid overwhelming the API
    await sleep(500);
  }

  console.log(`\nSync finished!`);
  console.log(`- Updated: ${successCount}`);
  console.log(`- No photo found: ${skippedCount}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
});
