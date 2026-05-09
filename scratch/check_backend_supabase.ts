import { createClient } from "@supabase/supabase-js";

// Backend Supabase project
const supabaseUrl = "https://wglrploxsxevcewrfsmb.supabase.co";
const supabaseAnonKey = "sb_publishable_xrdTCNjS7NmZ3fV6xSuVmg_sBlWFGmN";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking BACKEND Supabase connection to:", supabaseUrl);
  
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
