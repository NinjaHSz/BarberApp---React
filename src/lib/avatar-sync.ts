import { supabase } from "@/lib/supabase";

export async function syncAvatar(clientId: number | string, phone: string): Promise<string | null> {
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length < 8) return null;

  const evolutionUrl = process.env.NEXT_PUBLIC_EVOLUTION_API_URL;
  const evolutionKey = process.env.NEXT_PUBLIC_EVOLUTION_API_KEY;

  if (!evolutionUrl || !evolutionKey) {
    console.warn("Evolution API environment variables missing!");
    return null;
  }

  try {
    const response = await fetch(`${evolutionUrl}/chat/fetchProfile/barbearia`, {
      method: "POST",
      headers: {
        "apikey": evolutionKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ number: cleanPhone })
    });

    if (!response.ok) {
      console.log(`Evolution API error status for ${cleanPhone}: ${response.status}`);
      return null;
    }

    const resData = await response.json();
    const profilePicUrl = resData.picture || resData.profilePicUrl || resData.response?.profilePicUrl;

    if (profilePicUrl) {
      // Update database
      const { error } = await supabase
        .from("clientes")
        .update({ foto_url: profilePicUrl })
        .eq("id", clientId);

      if (error) {
        console.error("Error updating avatar in Supabase:", error);
      } else {
        console.log(`Successfully updated avatar for client ${clientId}`);
        return profilePicUrl;
      }
    }
  } catch (err: any) {
    console.error("Fetch avatar error:", err.message || err);
  }
  return null;
}
