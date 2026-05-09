/**
 * Twilio Utility for sending messages via Twilio REST API directly from the frontend.
 * NOTE: This exposes the TWILIO_AUTH_TOKEN in the client bundle.
 */

interface TwilioSendParams {
  to: string;
  body: string;
  channel: "whatsapp" | "sms";
}

export async function sendTwilioMessage({ to, body, channel }: TwilioSendParams) {
  const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
  const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
  const whatsappSender = import.meta.env.VITE_TWILIO_WHATSAPP_SENDER;
  const smsSender = import.meta.env.VITE_TWILIO_SMS_SENDER;
  const defaultPrefix = import.meta.env.VITE_DEFAULT_COUNTRY_CODE || "+91";

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not found in environment.");
  }

  const from = channel === "whatsapp" ? whatsappSender : smsSender;
  
  if (!from && channel === "sms") {
    throw new Error("Twilio SMS Sender (phone number) not configured in .env.");
  }
  
  // Format 'to' number: add prefix if it's a 10-digit number
  let formattedTo = to.trim().replace(/\D/g, "");
  if (formattedTo.length === 10) {
    formattedTo = defaultPrefix + formattedTo;
  } else if (!to.startsWith("+")) {
    // If not 10 digits but missing '+', we still try to add prefix if it's not already there
    if (!to.startsWith(defaultPrefix.replace("+", ""))) {
      formattedTo = defaultPrefix + formattedTo;
    } else {
      formattedTo = "+" + formattedTo;
    }
  } else {
    formattedTo = to; // Keep as is if it already starts with +
  }

  const recipient = channel === "whatsapp" ? `whatsapp:${formattedTo}` : formattedTo;

  console.log(`Sending ${channel} to ${recipient} from ${from}...`);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append("To", recipient);
  formData.append("From", from);
  formData.append("Body", body);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio API Error:", data);
      throw new Error(data.message || `Twilio Error ${data.code || response.status}: ${data.more_info || "Failed to send message"}`);
    }

    console.log("Twilio Message Sent Successfully:", data.sid);
    return data;
  } catch (err: any) {
    console.error("Twilio Fetch Error:", err);
    throw err;
  }
}
