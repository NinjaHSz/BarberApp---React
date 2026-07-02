const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const evolutionUrl = env.NEXT_PUBLIC_EVOLUTION_API_URL;
const evolutionKey = env.NEXT_PUBLIC_EVOLUTION_API_KEY;

async function test() {
  const testNumber = "558387468273"; // Instance owner
  console.log(`Fetching profile for ${testNumber}...`);
  
  try {
    const response = await fetch(`${evolutionUrl}/chat/fetchProfile/barbearia`, {
      method: "POST",
      headers: {
        "apikey": evolutionKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ number: testNumber })
    });
    
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response JSON:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
