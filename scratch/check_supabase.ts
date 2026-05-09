import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(".env");
const envContent = fs.readFileSync(envPath, "utf8");
const env: Record<string, string> = {};
envContent.split("\n").forEach((line) => {
  const [key, ...val] = line.split("=");
  if (key && val) env[key.trim()] = val.join("=").trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking Supabase connection to:", supabaseUrl);
  
  const { data: members, error: membersError } = await supabase.from("members").select("*").limit(5);
  if (membersError) {
    console.error("Error fetching members:", membersError);
  } else {
    console.log("Members fetched success:", members);
  }

  const { data: users, error: usersError } = await supabase.from("users").select("*").limit(5);
  if (usersError) {
    console.error("Error fetching users:", usersError);
  } else {
    console.log("Users fetched success:", users);
  }
}

check();
